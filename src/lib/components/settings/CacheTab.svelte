<script lang="ts">
	// Settings > Cache: icon cache stats for everyone, rebuild / clear for
	// admins. Styles: settings.css.
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/stores/dashboard';
	import { clearBrowserIconCache } from '$lib/stores/icons';

	const isAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');

	let stats = $state({ count: 0, size: 0, uploads: 0, misses: 0 });
	let clearing = $state(false);
	let rebuilding = $state(false);
	let rebuildResult = $state<{ rebuilt: number; errors: string[] } | null>(null);

	async function loadStats() {
		try {
			const data = await (await fetch('/api/cache')).json();
			stats = { count: data.count, size: data.size, uploads: data.uploads ?? 0, misses: data.misses ?? 0 };
		} catch {
			// keep the previous numbers
		}
	}

	async function clearCache() {
		clearing = true;
		rebuildResult = null;
		try {
			await fetch('/api/cache', { method: 'DELETE' });
			await clearBrowserIconCache();
			await loadStats();
		} catch {
			// stats show what is left
		}
		clearing = false;
	}

	async function rebuildCache() {
		rebuilding = true;
		rebuildResult = null;
		try {
			rebuildResult = await (await fetch('/api/cache', { method: 'POST' })).json();
			// Tiles fetch the rebuilt icons again.
			await clearBrowserIconCache();
			await loadStats();
		} catch {
			// stats show what is left
		}
		rebuilding = false;
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / 1024 ** i).toFixed(1)} ${['B', 'KB', 'MB', 'GB'][i]}`;
	}

	onMount(loadStats);
</script>

<div class="settings-section">
	<h3>{$t('cache.title')}</h3>
	<p class="cache-desc">{$t('cache.desc')}</p>
	<div class="cache-stats">
		<div class="cache-stat">
			<span class="cache-stat-label">{$t('cache.cached')}</span>
			<span class="cache-stat-value">{stats.count}</span>
		</div>
		<div class="cache-stat">
			<span class="cache-stat-label">{$t('cache.uploaded')}</span>
			<span class="cache-stat-value">{stats.uploads}</span>
		</div>
		<div class="cache-stat">
			<span class="cache-stat-label">{$t('cache.misses')}</span>
			<span class="cache-stat-value">{stats.misses}</span>
		</div>
		<div class="cache-stat">
			<span class="cache-stat-label">{$t('cache.size')}</span>
			<span class="cache-stat-value">{formatBytes(stats.size)}</span>
		</div>
	</div>
	{#if rebuildResult}
		<div class="cache-result">
			{$t('cache.rebuilt', { count: rebuildResult.rebuilt })}
			{#if rebuildResult.errors.length > 0}
				<span class="cache-errors"> — {$t('cache.failedList', { count: rebuildResult.errors.length, list: rebuildResult.errors.join(', ') })}</span>
			{/if}
		</div>
	{/if}
	{#if isAdmin}
		<div class="cache-actions">
			<button class="btn-rebuild-cache" onclick={rebuildCache} disabled={rebuilding}>{rebuilding ? $t('cache.rebuilding') : $t('cache.rebuild')}</button>
			<button class="btn-clear-cache" onclick={clearCache} disabled={clearing || stats.count === 0}>{clearing ? $t('cache.clearing') : $t('cache.clear')}</button>
		</div>
	{/if}
</div>
