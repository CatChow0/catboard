<script lang="ts">
	// PsiTransfer: drop files on the tile (or click it to pick them), choose how
	// long they are kept and an optional password, send, and get the share link.
	// Files go through CatBoard in small chunks; the last links are remembered
	// by this browser.
	import { onMount } from 'svelte';
	import type { PsiTransferConfig } from '$lib/types';
	import { isEditing } from '$lib/stores/dashboard';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import Glyph from '$lib/widgets/Glyph.svelte';

	let { config, rowSpan = 2, ondelete, itemid }: {
		config?: PsiTransferConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	type PsiInfo = { retentions: Record<string, string>; defaultRetention: string; requireBucketPassword: boolean; maxFileSize: number | null; linkBase: string; chunkSize: number };
	type Link = { url: string; label: string; at: number; retention: string };

	const HISTORY_KEY = 'catboard:psitransfer-history';
	const compact = $derived(rowSpan <= 1);
	const askOptions = $derived(config?.askOptions ?? true);
	const historySize = $derived(Math.max(0, Math.min(10, config?.history ?? 5)));

	let info = $state<PsiInfo | null>(null);
	let infoError = $state('');
	let phase = $state<'idle' | 'review' | 'sending' | 'done'>('idle');
	let files = $state<File[]>([]);
	let retention = $state('');
	let password = $state('');
	let sent = $state(0);
	let total = $state(0);
	let speed = $state(0);
	let error = $state('');
	let link = $state('');
	let copied = $state(false);
	let dragging = $state(0);
	let history = $state<Link[]>([]);
	let input = $state<HTMLInputElement>();
	let linkInput = $state<HTMLInputElement>();
	let cancel: AbortController | null = null;
	let showEdit = $state(false);

	onMount(() => {
		loadInfo();
		history = readHistory();
	});

	async function loadInfo() {
		try {
			const res = await fetch('/api/integrations/psitransfer/config');
			const body = await res.json();
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			info = body;
			infoError = '';
		} catch (e) {
			infoError = e instanceof Error ? e.message : String(e);
		}
	}

	const defaultRetention = $derived(info ? (config?.retention && config.retention in info.retentions ? config.retention : info.defaultRetention) : '');

	// --- History (per browser) ---
	const expiresAt = (l: Link) => (/^\d+$/.test(l.retention) ? l.at + Number(l.retention) * 1000 : null);
	function readHistory(): Link[] {
		try {
			const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as Link[];
			return list.filter((l) => {
				const exp = expiresAt(l);
				return exp === null ? Date.now() - l.at < 75 * 86400_000 : exp > Date.now();
			});
		} catch {
			return [];
		}
	}
	function remember(l: Link) {
		history = [l, ...readHistory().filter((h) => h.url !== l.url)].slice(0, 10);
		try {
			localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
		} catch {
			// storage unavailable: the link stays on screen
		}
	}
	function expiryLabel(l: Link): string {
		const exp = expiresAt(l);
		if (exp === null) return info?.retentions[l.retention] ?? 'one-time download';
		const left = exp - Date.now();
		if (left < 3600_000) return `expires in ${Math.max(1, Math.round(left / 60_000))} min`;
		if (left < 86400_000) return `expires in ${Math.round(left / 3600_000)} h`;
		return `expires in ${Math.round(left / 86400_000)} d`;
	}

	// --- Picking files ---
	function pick(list: FileList | File[] | null | undefined) {
		const picked = Array.from(list ?? []).filter((f) => f.size > 0 || f.type !== '');
		if (!picked.length) return;
		files = phase === 'review' ? [...files, ...picked] : picked;
		error = '';
		link = '';
		retention = defaultRetention;
		password = '';
		if (askOptions) phase = 'review';
		else send();
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragging = 0;
		if ($isEditing || phase === 'sending' || !info) return;
		pick(e.dataTransfer?.files);
	}

	function onDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = $isEditing || !info ? 'none' : 'copy';
	}

	function openPicker() {
		if ($isEditing || !info || phase === 'sending') return;
		input?.click();
	}

	function reset() {
		phase = 'idle';
		files = [];
		error = '';
	}

	// --- Sending ---
	const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);
	const totalSize = $derived(files.reduce((s, f) => s + f.size, 0));
	const tooBig = $derived(!!info?.maxFileSize && files.some((f) => f.size > info!.maxFileSize!));
	const needsPassword = $derived(!!info?.requireBucketPassword && !password);

	function randomSid(): string {
		const b = crypto.getRandomValues(new Uint8Array(6));
		return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
	}

	async function api<T>(url: string, init: RequestInit): Promise<T> {
		const res = await fetch(url, { ...init, signal: cancel?.signal });
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
		return body as T;
	}

	async function send() {
		if (!info || !files.length) return;
		const sid = randomSid();
		const ret = retention || defaultRetention;
		const chunk = info.chunkSize;
		cancel = new AbortController();
		phase = 'sending';
		error = '';
		sent = 0;
		total = totalSize;
		const started = Date.now();
		try {
			for (const file of files) {
				const { id } = await api<{ id: string }>('/api/integrations/psitransfer/upload', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sid, name: file.name, size: file.size, type: file.type, retention: ret, password })
				});
				let offset = 0;
				while (offset < file.size) {
					const piece = file.slice(offset, offset + chunk);
					const r = await api<{ offset: number }>(`/api/integrations/psitransfer/upload/${id}`, {
						method: 'PATCH',
						headers: { 'Upload-Offset': String(offset), 'Content-Type': 'application/octet-stream' },
						body: piece
					});
					sent += r.offset - offset;
					offset = r.offset;
					speed = sent / Math.max(0.001, (Date.now() - started) / 1000);
				}
			}
			const { url } = await api<{ url: string }>('/api/integrations/psitransfer/done', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sid })
			});
			link = url;
			copied = false;
			if (historySize > 0) remember({ url, label: files.length === 1 ? files[0].name : `${files.length} files`, at: Date.now(), retention: ret });
			phase = 'done';
			files = [];
		} catch (e) {
			error = cancel?.signal.aborted ? 'Cancelled' : e instanceof Error ? e.message : String(e);
			phase = askOptions ? 'review' : 'idle';
		} finally {
			cancel = null;
		}
	}

	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
		} catch {
			// No clipboard (plain HTTP): select the text so Ctrl+C works.
			linkInput?.select();
		}
	}

	const pct = $derived(total ? Math.round((sent / total) * 100) : 0);
	const shownHistory = $derived(history.slice(0, historySize).filter((h) => h.url !== link));
</script>

<div class="ps-tile" class:drag={dragging > 0 && !$isEditing}
	ondragenter={(e) => { if (e.dataTransfer?.types.includes('Files')) dragging++; }}
	ondragleave={() => (dragging = Math.max(0, dragging - 1))}
	ondragover={onDragOver}
	ondrop={onDrop}
	role="region"
	aria-label="PsiTransfer: drop files to share them"
>
	<input bind:this={input} type="file" multiple hidden onchange={(e) => { pick(e.currentTarget.files); e.currentTarget.value = ''; }} />

	<div class="ps-inner">
		{#if phase === 'review'}
			<div class="ps-head">
				<span class="ps-title">{files.length} file{files.length > 1 ? 's' : ''} · {fmtSize(totalSize)}</span>
				<button class="ps-link-btn" onclick={openPicker} onpointerdown={(e) => e.stopPropagation()}>Add</button>
			</div>
			<ul class="ps-files">
				{#each files as f, i (i + f.name)}
					<li>
						<span class="ps-fname" title={f.name}>{f.name}</span>
						<span class="ps-fsize">{fmtSize(f.size)}</span>
						<button class="ps-x" onclick={() => (files = files.filter((_, j) => j !== i))} onpointerdown={(e) => e.stopPropagation()} aria-label="Remove {f.name}">✕</button>
					</li>
				{/each}
			</ul>
			<div class="ps-opts cb-form">
				<label class="field">
					<span>Keep for</span>
					<select bind:value={retention} onpointerdown={(e) => e.stopPropagation()}>
						{#each Object.entries(info?.retentions ?? {}) as [key, label] (key)}<option value={key}>{label}</option>{/each}
					</select>
				</label>
				<label class="field">
					<span>Password{info?.requireBucketPassword ? '' : ' (optional)'}</span>
					<input type="password" bind:value={password} autocomplete="new-password" onpointerdown={(e) => e.stopPropagation()} />
				</label>
			</div>
			{#if tooBig}<p class="ps-err">A file is larger than PsiTransfer accepts ({fmtSize(info?.maxFileSize ?? 0)}).</p>{/if}
			{#if error}<p class="ps-err">{error}</p>{/if}
			<div class="ps-actions">
				<button class="ps-btn" onclick={reset} onpointerdown={(e) => e.stopPropagation()}>Cancel</button>
				<button class="ps-btn primary" onclick={send} onpointerdown={(e) => e.stopPropagation()} disabled={!files.length || tooBig || needsPassword}>Send</button>
			</div>
		{:else if phase === 'sending'}
			<div class="ps-sending">
				<span class="ps-title">Sending {files.length > 1 ? `${files.length} files` : files[0]?.name}…</span>
				<div class="ps-bar"><div class="ps-fill" style:width="{pct}%"></div></div>
				<span class="ps-meta">{pct}% · {fmtSize(sent)} of {fmtSize(total)} · {fmtSize(speed)}/s</span>
				<button class="ps-btn" onclick={() => cancel?.abort()} onpointerdown={(e) => e.stopPropagation()}>Cancel</button>
			</div>
		{:else}
			{#if phase === 'done' && link}
				<div class="ps-done">
					<span class="ps-ok">✓ Shared</span>
					<div class="ps-linkrow">
						<input bind:this={linkInput} class="ps-url" value={link} readonly onpointerdown={(e) => e.stopPropagation()} onfocus={(e) => e.currentTarget.select()} />
						<button class="ps-btn primary" onclick={() => copy(link)} onpointerdown={(e) => e.stopPropagation()}>{copied ? 'Copied' : 'Copy'}</button>
						<a class="ps-btn" href={link} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()}>Open</a>
					</div>
				</div>
			{/if}
			<button class="ps-zone" class:small={compact || (phase === 'done' && !!link)} onclick={openPicker} onpointerdown={(e) => !$isEditing && e.stopPropagation()} disabled={!info} aria-label="Choose files to share">
				<Glyph name="upload" size={compact ? 18 : 26} />
				<span class="ps-zone-text">
					{#if infoError}{infoError}{:else if !info}Connecting to PsiTransfer…{:else if $isEditing}Leave edit mode to share files{:else}<b>Drop files here</b>{#if !compact}{' or click to choose'}{/if}{/if}
				</span>
				{#if error && !compact}<span class="ps-err">{error}</span>{/if}
			</button>
			{#if shownHistory.length && !compact}
				<ul class="ps-history">
					{#each shownHistory as h (h.url)}
						<li>
							<a href={h.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()} title={h.url}>{h.label}</a>
							<span class="ps-meta">{expiryLabel(h)}</span>
							<button class="ps-link-btn" onclick={() => copy(h.url)} onpointerdown={(e) => e.stopPropagation()}>Copy</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
	<EditButtons label="PsiTransfer widget" {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="psitransfer" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.ps-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		transition: border-color var(--transition), background var(--transition);
	}

	.ps-tile.drag {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, var(--bg-card));
	}

	.ps-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.ps-zone {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px;
		border: 1.5px dashed var(--border-light, var(--border));
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		text-align: center;
		transition: border-color var(--transition), color var(--transition), background var(--transition);
	}

	.ps-zone:hover:not(:disabled),
	.drag .ps-zone {
		border-color: var(--accent);
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 6%, transparent);
	}

	.ps-zone:disabled {
		cursor: default;
	}

	.ps-zone.small {
		flex-direction: row;
		flex: 0 0 auto;
		padding: 6px 10px;
	}

	.ps-zone-text {
		font-size: 0.82rem;
	}

	.ps-zone-text b {
		color: var(--text-primary);
	}

	.ps-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.ps-title {
		font-size: 0.85rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ps-files {
		list-style: none;
		margin: 0;
		padding: 0;
		flex: 1;
		min-height: 24px;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.ps-files li,
	.ps-history li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 0;
		font-size: 0.8rem;
	}

	.ps-fname {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ps-fsize,
	.ps-meta {
		font-size: 0.72rem;
		color: var(--text-muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.ps-x {
		padding: 0 4px;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.ps-x:hover {
		color: var(--danger);
	}

	.ps-opts {
		display: flex;
		gap: 10px;
	}

	.ps-opts .field {
		flex: 1;
		margin-bottom: 0;
	}

	.ps-actions,
	.ps-linkrow {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}

	.ps-btn {
		padding: 5px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 0.78rem;
		color: var(--text-secondary);
		text-decoration: none;
		white-space: nowrap;
	}

	.ps-btn:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.ps-btn.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	.ps-btn.primary:hover:not(:disabled) {
		background: var(--accent-hover);
		color: white;
	}

	.ps-btn:disabled {
		opacity: 0.5;
	}

	.ps-link-btn {
		font-size: 0.74rem;
		color: var(--accent);
	}

	.ps-sending {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
	}

	.ps-sending .ps-btn {
		align-self: flex-end;
	}

	.ps-bar {
		height: 6px;
		border-radius: 3px;
		background: var(--border);
		overflow: hidden;
	}

	.ps-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.3s ease;
	}

	.ps-done {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.ps-ok {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--success, #22c55e);
	}

	.ps-url {
		flex: 1;
		min-width: 0;
		padding: 5px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.78rem;
	}

	.ps-history {
		list-style: none;
		margin: 0;
		padding: 6px 0 0;
		border-top: 1px solid var(--border);
		max-height: 40%;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.ps-history a {
		flex: 1;
		min-width: 0;
		color: var(--text-primary);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ps-history a:hover {
		color: var(--accent);
	}

	.ps-err {
		margin: 0;
		font-size: 0.75rem;
		color: var(--danger);
	}
</style>
