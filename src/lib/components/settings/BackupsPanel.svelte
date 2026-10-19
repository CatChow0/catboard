<script lang="ts">
	// Settings > Export > Backups (admin): the automatic config backups
	// (daily, before an import or a restore) and manual ones; download one, or
	// put it back (the current config is backed up first).
	import { t, errorText, intlLocale, type Key } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { currentUser, refreshActiveDashboard } from '$lib/stores/dashboard';

	type Backup = { id: string; reason: 'daily' | 'before-import' | 'before-restore' | 'manual'; date: string; files: string[]; size: number };

	const REASONS: Record<Backup['reason'], Key> = {
		daily: 'backups.daily',
		'before-import': 'backups.beforeImport',
		'before-restore': 'backups.beforeRestore',
		manual: 'backups.manual'
	};

	let backups = $state<Backup[] | null>(null);
	let error = $state('');
	let busy = $state(false);
	let confirming = $state<string | null>(null);
	let message = $state('');

	const isAdmin = $derived($currentUser?.role === 'admin');

	async function load() {
		try {
			const res = await fetch('/api/backups');
			const body = await res.json();
			if (!res.ok) throw new Error(errorText(body, res.status));
			backups = body.backups;
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function backupNow() {
		busy = true;
		message = '';
		const res = await fetch('/api/backups', { method: 'POST' }).catch(() => null);
		busy = false;
		message = res?.ok ? $t('backups.made') : $t('backups.failed');
		await load();
	}

	async function restore(id: string) {
		confirming = null;
		busy = true;
		message = '';
		const res = await fetch(`/api/backups/${encodeURIComponent(id)}/restore`, { method: 'POST' }).catch(() => null);
		const body = await res?.json().catch(() => null);
		busy = false;
		if (res?.ok) {
			message = $t('backups.restored', { count: body.restored.length });
			await refreshActiveDashboard().catch(() => {});
		} else message = body ? errorText(body, res?.status) : $t('backups.restoreFailed');
		await load();
	}

	const when = (iso: string) => new Date(iso).toLocaleString(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' });
	const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`);

	onMount(() => {
		if (isAdmin) load();
	});
</script>

{#if isAdmin}
	<div class="settings-section backups">
		<div class="section-header">
			<h3>{$t('backups.title')}</h3>
			<button class="btn-reset" onclick={backupNow} disabled={busy}>{$t('backups.now')}</button>
		</div>
		<p class="section-hint">{$t('backups.hint')}</p>
		{#if message}<p class="bk-msg">{message}</p>{/if}
		{#if error}
			<p class="bk-msg err">{error}</p>
		{:else if !backups}
			<p class="section-hint">{$t('common.loading')}</p>
		{:else if backups.length === 0}
			<p class="section-hint">{$t('backups.none')}</p>
		{:else}
			<ul class="bk-list">
				{#each backups as b (b.id)}
					<li>
						<span class="bk-date">{when(b.date)}</span>
						<span class="bk-tag" class:auto={b.reason === 'daily'}>{$t(REASONS[b.reason])}</span>
						<span class="bk-size" title={b.files.join(', ')}>{$t('backups.files', { count: b.files.length })} · {kb(b.size)}</span>
						<a class="btn-reset" href="/api/backups/{encodeURIComponent(b.id)}" download>{$t('backups.download')}</a>
						{#if confirming === b.id}
							<button class="btn-reset danger" onclick={() => restore(b.id)} disabled={busy}>{$t('backups.confirm')}</button>
							<button class="btn-reset" onclick={() => (confirming = null)}>{$t('common.cancel')}</button>
						{:else}
							<button class="btn-reset" onclick={() => (confirming = b.id)} disabled={busy}>{$t('backups.restore')}</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.bk-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bk-list li {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
	}

	.bk-date {
		font-variant-numeric: tabular-nums;
	}

	.bk-tag {
		padding: 0 6px;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 600;
		background: var(--accent-bg);
		color: var(--accent);
	}

	.bk-tag.auto {
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
		color: var(--text-secondary);
	}

	.bk-size {
		margin-right: auto;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.btn-reset {
		padding: 4px 10px;
		font-size: 0.78rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		text-decoration: none;
	}

	.btn-reset:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.btn-reset.danger {
		border-color: var(--danger);
		color: var(--danger);
	}

	.btn-reset:disabled {
		opacity: 0.5;
	}

	.bk-msg {
		margin: 0 0 8px;
		font-size: 0.8rem;
		color: var(--success, #22c55e);
	}

	.bk-msg.err {
		color: var(--danger);
	}
</style>
