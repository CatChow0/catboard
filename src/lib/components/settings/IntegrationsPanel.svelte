<script lang="ts">
	// Settings > Integrations: the connections as a searchable list (status dot
	// per connection) and the form of the selected one, with Test connection
	// and Save. Forms are generated from the registry (integrations/registry.ts).
	import { t, errorText, locale } from '$lib/i18n';
	import { categoryLabel, localIntegration } from '$lib/i18n/catalog';
	import { onMount, untrack } from 'svelte';
	import { uid } from '$lib/utils/uid';
	import { currentUser } from '$lib/stores/dashboard';
	import { integrations, loadIntegrations } from '$lib/stores/integrations';
	import { isPhone } from '$lib/stores/viewport';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import {
		INTEGRATIONS, INTEGRATION_CATEGORIES, integrationDef, itemsOf, isConfigured, cleanValue,
		type IntegrationDef, type IntegrationKey
	} from '$lib/integrations/registry';

	let { initial }: { initial?: string } = $props();

	type Item = Record<string, string>;
	type TestState = { state: 'testing' | 'ok' | 'error'; message: string; items?: Record<string, { ok: boolean; message: string }> };

	const canEdit = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');

	let query = $state('');
	let selected = $state<IntegrationKey>(untrack(() => integrationDef(initial as IntegrationKey)?.key ?? INTEGRATIONS[0].key));
	// On phones the list and the form are two screens.
	let showDetail = $state(untrack(() => !!initial));
	let drafts = $state<Partial<Record<IntegrationKey, Item[]>>>({});
	let tests = $state<Partial<Record<IntegrationKey, TestState>>>({});
	let saving = $state(false);
	let saveMessage = $state<{ ok: boolean; text: string } | null>(null);
	let detect = $state<Record<string, string>>({});
	let revealed = $state<Record<string, boolean>>({});

	onMount(() => {
		loadIntegrations(true);
	});

	const def = $derived(localIntegration($locale, integrationDef(selected)!));

	/** Saved items as editable copies (list items get an id when missing). */
	function savedItems(d: IntegrationDef): Item[] {
		const items = itemsOf(d, $integrations).map((it) => ({ ...it }));
		if (d.kind === 'single') return items.length ? items : [{}];
		return items.map((it) => (it.id ? it : { ...it, id: uid() }));
	}

	const items = $derived(drafts[selected] ?? savedItems(def));

	function edit(index: number, field: string, value: string) {
		const next = items.map((it, i) => (i === index ? { ...it, [field]: value } : it));
		drafts[selected] = next;
		saveMessage = null;
	}

	function addItem() {
		drafts[selected] = [...items, { id: uid() }];
	}

	function removeItem(index: number) {
		drafts[selected] = items.filter((_, i) => i !== index);
	}

	const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
	function isDirty(key: IntegrationKey): boolean {
		const d = integrationDef(key)!;
		const draft = drafts[key];
		return !!draft && !same(cleanValue(d, draft), cleanValue(d, savedItems(d)));
	}

	function status(key: IntegrationKey): 'off' | 'on' | 'ok' | 'error' {
		const t = tests[key];
		if (t?.state === 'ok') return 'ok';
		if (t?.state === 'error') return 'error';
		return isConfigured(key, $integrations) ? 'on' : 'off';
	}

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const all = INTEGRATIONS.map((d) => localIntegration($locale, d));
		const list = q ? all.filter((d) => `${d.name} ${d.description} ${categoryLabel($locale, d.category)}`.toLowerCase().includes(q)) : all;
		return INTEGRATION_CATEGORIES.map((c) => ({ category: c, defs: list.filter((d) => d.category === c) })).filter((g) => g.defs.length);
	});

	function select(key: IntegrationKey) {
		selected = key;
		showDetail = true;
		saveMessage = null;
	}

	const ready = (it: Item) => String(it[def.requiredField] ?? '').trim() !== '';

	async function testOne(key: IntegrationKey, value: Item): Promise<{ ok: boolean; message: string }> {
		try {
			const res = await fetch('/api/integrations/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key, value })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) return { ok: false, message: errorText(body, res.status) };
			return { ok: !!body.ok, message: body.code ? errorText(body) : body.message || '' };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e) };
		}
	}

	async function test() {
		const key = selected;
		const list = items.filter(ready);
		if (!list.length) return;
		tests[key] = { state: 'testing', message: $t('integrations.testing') };
		const results = await Promise.all(list.map((it) => testOne(key, it)));
		const failed = results.filter((r) => !r.ok).length;
		const perItem: Record<string, { ok: boolean; message: string }> = {};
		list.forEach((it, i) => (perItem[it.id ?? String(i)] = results[i]));
		tests[key] =
			def.kind === 'single'
				? { state: results[0].ok ? 'ok' : 'error', message: results[0].message }
				: {
						state: failed ? 'error' : 'ok',
						message: $t(failed ? 'integrations.someFailed' : 'integrations.allAnswered', { failed, count: list.length, item: def.itemName ?? '' }),
						items: perItem
					};
	}

	async function save() {
		const key = selected;
		const value = cleanValue(def, items);
		saving = true;
		saveMessage = null;
		try {
			const res = await fetch('/api/integrations', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [key]: value ?? null })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(errorText(body, res.status));
			await loadIntegrations(true);
			delete drafts[key];
			saveMessage = { ok: true, text: $t('common.saved') };
		} catch (e) {
			saveMessage = { ok: false, text: $t('integrations.notSaved', { reason: e instanceof Error ? e.message : String(e) }) };
		} finally {
			saving = false;
		}
	}

	function revert() {
		delete drafts[selected];
		saveMessage = null;
	}

	/** Elegoo: ask the printer for its serial number and name (UDP discovery on the server). */
	async function detectPrinter(index: number) {
		const it = items[index];
		const id = it.id ?? String(index);
		detect[id] = $t('integrations.detecting');
		try {
			const res = await fetch('/api/integrations/elegoo/discover', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ host: (it.host ?? '').trim() })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(errorText(body, res.status));
			edit(index, 'serial', body.sn);
			if (!it.name) edit(index, 'name', body.name || body.model || '');
			detect[id] = $t('integrations.found', { model: body.model || $t('integrations.printer'), serial: body.sn, code: $t(body.tokenStatus === 1 ? 'integrations.codeSet' : 'integrations.noCode') });
		} catch (e) {
			detect[id] = e instanceof Error ? e.message : String(e);
		}
	}

	const basicFields = $derived(def.fields.filter((f) => !f.advanced));
	const advancedFields = $derived(def.fields.filter((f) => f.advanced));
	const testState = $derived(tests[selected]);
</script>

{#snippet fieldInput(index: number, item: Item, f: IntegrationDef['fields'][number])}
	{@const rid = `${selected}-${item.id ?? index}-${f.id}`}
	{#if f.type === 'toggle'}
		<label class="toggle-switch" for={rid}>
			<input id={rid} type="checkbox" checked={item[f.id] === 'true'} onchange={(e) => edit(index, f.id, e.currentTarget.checked ? 'true' : '')} disabled={!canEdit} />
			<span class="toggle-slider"></span>
			<span class="toggle-label">{f.label}</span>
		</label>
	{:else}
	<label class="field" for={rid}>
		<span>{f.label}</span>
		{#if f.type === 'secret'}
			<div class="secret">
				<input
					id={rid}
					type={revealed[rid] ? 'text' : 'password'}
					value={item[f.id] ?? ''}
					oninput={(e) => edit(index, f.id, e.currentTarget.value)}
					placeholder={f.placeholder}
					autocomplete="new-password"
					disabled={!canEdit}
				/>
				<button type="button" class="reveal" onclick={() => (revealed[rid] = !revealed[rid])} aria-label={$t(revealed[rid] ? 'integrations.hide' : 'integrations.show')} title={$t(revealed[rid] ? 'integrations.hide' : 'integrations.show')}>
					{#if revealed[rid]}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" /></svg>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
					{/if}
				</button>
			</div>
		{:else}
			<input
				id={rid}
				type={f.type === 'url' ? 'url' : 'text'}
				value={item[f.id] ?? ''}
				oninput={(e) => edit(index, f.id, e.currentTarget.value)}
				placeholder={f.placeholder}
				autocomplete="off"
				disabled={!canEdit}
			/>
		{/if}
		{#if f.hint}<span class="hint">{f.hint}</span>{/if}
	</label>
	{/if}
{/snippet}

{#snippet itemFields(index: number, item: Item)}
	<div class="fields">
		{#each basicFields as f (f.id)}
			{@render fieldInput(index, item, f)}
		{/each}
	</div>
	{#if def.key === 'elegoo'}
		<div class="detect-row">
			<button type="button" class="btn-ghost" onclick={() => detectPrinter(index)} disabled={!canEdit || !String(item.host ?? '').trim()}>{$t('integrations.detect')}</button>
			{#if detect[item.id ?? String(index)]}<span class="hint">{detect[item.id ?? String(index)]}</span>{/if}
		</div>
	{/if}
	{#if advancedFields.length}
		<details class="advanced" open={advancedFields.some((f) => item[f.id])}>
			<summary>{advancedFields[0].hint ?? $t('integrations.advanced')}</summary>
			<div class="fields">
				{#each advancedFields as f (f.id)}
					{@render fieldInput(index, item, { ...f, hint: undefined })}
				{/each}
			</div>
		</details>
	{/if}
{/snippet}

<div class="ip" class:detail={showDetail}>
	<aside class="ip-list">
		<div class="ip-search">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
			<input type="search" bind:value={query} placeholder={$t('integrations.search')} aria-label={$t('integrations.search')} />
		</div>
		{#each filtered as group (group.category)}
			<p class="ip-cat">{categoryLabel($locale, group.category)}</p>
			{#each group.defs as d (d.key)}
				<button class="ip-row" class:active={d.key === selected && (showDetail || !$isPhone)} onclick={() => select(d.key)}>
					<span class="ip-icon"><Glyph name={d.icon} size={18} /></span>
					<span class="ip-name">{d.name}</span>
					{#if isDirty(d.key)}<span class="ip-dirty" title={$t('integrations.unsaved')}>•</span>{/if}
					<span class="dot {status(d.key)}" title={$t(({ off: 'integrations.notSetUp', on: 'integrations.setUp', ok: 'integrations.testPassed', error: 'integrations.testFailed' } as const)[status(d.key)])}></span>
				</button>
			{/each}
		{:else}
			<p class="ip-empty">{$t('integrations.noMatch', { query })}</p>
		{/each}
	</aside>

	<section class="ip-detail cb-form">
		<header class="ip-head">
			{#if $isPhone}
				<button class="ip-back" onclick={() => (showDetail = false)} aria-label={$t('integrations.backToList')}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
				</button>
			{/if}
			<span class="ip-head-icon"><Glyph name={def.icon} size={24} /></span>
			<div class="ip-head-text">
				<h3>{def.name}</h3>
				<p>{def.description}</p>
			</div>
			<span class="pill {status(selected)}">{$t(({ off: 'integrations.notSetUp', on: 'integrations.setUp', ok: 'integrations.connected', error: 'integrations.error' } as const)[status(selected)])}</span>
		</header>

		{#if !canEdit}
			<p class="banner">{$t('integrations.adminOnly')}</p>
		{/if}

		{#if def.kind === 'single'}
			{@render itemFields(0, items[0] ?? {})}
		{:else}
			{#each items as item, i (item.id ?? i)}
				{@const r = testState?.items?.[item.id ?? String(i)]}
				<div class="ip-item">
					<div class="ip-item-head">
						<span class="ip-item-title">{item.name || $t('integrations.newItem', { item: def.itemName ?? '' })}</span>
						{#if r}<span class="ip-item-test" class:ok={r.ok} class:err={!r.ok}>{r.ok ? '✓' : '✕'} {r.message}</span>{/if}
						<button type="button" class="ip-remove" onclick={() => removeItem(i)} disabled={!canEdit} aria-label={$t('integrations.removeItem', { item: def.itemName ?? '' })} title={$t('common.remove')}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
						</button>
					</div>
					{@render itemFields(i, item)}
				</div>
			{:else}
				<p class="hint">{$t('integrations.noItems', { item: def.itemName ?? '' })}</p>
			{/each}
			<button type="button" class="btn-add" onclick={addItem} disabled={!canEdit}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
				{$t('integrations.addItem', { item: def.itemName ?? '' })}
			</button>
		{/if}

		{#if def.help}<p class="hint help">{def.help}</p>{/if}

		{#if testState && (def.kind === 'single' || testState.state !== 'ok' || !testState.items)}
			<p class="result {testState.state}">
				{testState.state === 'ok' ? '✓' : testState.state === 'error' ? '✕' : ''}
				{testState.message}
			</p>
		{/if}
		{#if saveMessage}<p class="result {saveMessage.ok ? 'ok' : 'error'}">{saveMessage.text}</p>{/if}

		<div class="ip-actions">
			<button type="button" class="btn-secondary" onclick={test} disabled={!canEdit || !items.some(ready) || testState?.state === 'testing'}>
				{testState?.state === 'testing' ? $t('integrations.testing') : $t('integrations.testConnection')}
			</button>
			<span class="spacer"></span>
			{#if isDirty(selected)}
				<button type="button" class="btn-secondary" onclick={revert} disabled={saving}>{$t('integrations.revert')}</button>
			{/if}
			<button type="button" class="btn-primary" onclick={save} disabled={!canEdit || saving || !isDirty(selected)}>
				{saving ? $t('integrations.saving') : $t('common.save')}
			</button>
		</div>
	</section>
</div>

<style>
	.ip {
		display: flex;
		height: 100%;
		min-height: 0;
	}

	.ip-list {
		width: 230px;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		padding: 12px 8px;
		overflow-y: auto;
	}

	.ip-search {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 4px 8px;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-muted);
	}

	.ip-search:focus-within {
		border-color: var(--accent);
	}

	.ip-search input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		outline: none;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.ip-cat {
		margin: 12px 8px 4px;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.ip-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 7px 8px;
		border-radius: var(--radius-sm);
		font-size: 0.88rem;
		color: var(--text-secondary);
		text-align: left;
		transition: background var(--transition), color var(--transition);
	}

	.ip-row:hover {
		background: var(--bg-card-hover);
		color: var(--text-primary);
	}

	.ip-row.active {
		background: var(--accent-bg);
		color: var(--text-primary);
	}

	.ip-icon {
		display: flex;
		color: var(--text-muted);
	}

	.ip-row.active .ip-icon {
		color: var(--accent);
	}

	.ip-name {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ip-dirty {
		color: var(--accent);
		font-weight: 700;
	}

	.dot {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--border);
	}

	.dot.on {
		background: var(--accent);
	}

	.dot.ok {
		background: var(--success, #22c55e);
	}

	.dot.error {
		background: var(--danger);
	}

	.ip-empty {
		padding: 12px 8px;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.ip-detail {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 18px 22px;
	}

	.ip-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 18px;
	}

	.ip-head-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		background: var(--accent-bg);
		color: var(--accent);
	}

	.ip-head-text {
		flex: 1;
		min-width: 0;
	}

	.ip-head h3 {
		font-size: 1.05rem;
	}

	.ip-head p {
		margin-top: 2px;
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.ip-back {
		display: flex;
		padding: 6px;
		margin-left: -6px;
		border-radius: var(--radius-sm);
	}

	.pill {
		flex-shrink: 0;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 600;
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
		color: var(--text-muted);
	}

	.pill.on {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.pill.ok {
		background: color-mix(in srgb, var(--success, #22c55e) 16%, transparent);
		color: var(--success, #22c55e);
	}

	.pill.error {
		background: color-mix(in srgb, var(--danger) 16%, transparent);
		color: var(--danger);
	}

	.banner {
		margin-bottom: 14px;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--warning, #f59e0b) 12%, transparent);
		font-size: 0.82rem;
		color: var(--text-secondary);
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		column-gap: 12px;
	}

	.secret {
		display: flex;
		gap: 6px;
	}

	.secret input {
		flex: 1;
		min-width: 0;
	}

	.reveal {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		flex-shrink: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
	}

	.reveal:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.detect-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: -4px 0 14px;
	}

	.detect-row .hint {
		margin: 0;
	}

	.advanced {
		margin-bottom: 12px;
	}

	.advanced summary {
		margin-bottom: 10px;
		font-size: 0.8rem;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.ip-item {
		margin-bottom: 12px;
		padding: 12px 14px 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
	}

	.ip-item-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	.ip-item-title {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.ip-item-test {
		flex: 1;
		min-width: 0;
		font-size: 0.76rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ip-item-test.ok {
		color: var(--success, #22c55e);
	}

	.ip-item-test.err {
		color: var(--danger);
	}

	.ip-remove {
		display: flex;
		margin-left: auto;
		padding: 6px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
	}

	.ip-remove:hover:not(:disabled) {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 12%, transparent);
	}

	.btn-add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		margin-bottom: 14px;
		padding: 9px;
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.btn-add:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.help {
		margin-top: 2px;
	}

	.result {
		margin: 0 0 10px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		background: color-mix(in srgb, var(--text-muted) 10%, transparent);
		color: var(--text-secondary);
		overflow-wrap: anywhere;
	}

	.result.ok {
		background: color-mix(in srgb, var(--success, #22c55e) 12%, transparent);
		color: var(--success, #22c55e);
	}

	.result.error {
		background: color-mix(in srgb, var(--danger) 12%, transparent);
		color: var(--danger);
	}

	.ip-actions {
		position: sticky;
		bottom: -18px;
		display: flex;
		align-items: center;
		gap: 8px;
		/* Bottom of the pane when the form is short, sticky when it scrolls. */
		margin: auto -22px -18px;
		padding: 12px 22px;
		border-top: 1px solid var(--border);
		background: var(--bg-modal);
	}

	.spacer {
		flex: 1;
	}

	.btn-primary,
	.btn-secondary {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		font-size: 0.88rem;
		font-weight: 500;
	}

	.btn-primary {
		background: var(--accent);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-secondary {
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.btn-secondary:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.btn-primary:disabled,
	.btn-secondary:disabled,
	.btn-add:disabled,
	.ip-remove:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Phone: the list, then the form of the tapped connection. */
	@media (max-width: 640px) {
		.ip-list {
			width: 100%;
			border-right: none;
		}

		.ip-detail {
			padding: 14px 16px;
		}

		.ip:not(.detail) .ip-detail,
		.ip.detail .ip-list {
			display: none;
		}

		.ip-actions {
			bottom: -14px;
			margin: auto -16px -14px;
			padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
			flex-wrap: wrap;
		}

		.ip-actions .btn-primary,
		.ip-actions .btn-secondary {
			flex: 1;
		}

		.ip-actions .spacer {
			display: none;
		}
	}
</style>
