<script lang="ts">
	import type { ArrReleasesConfig, ArrCalendarEntry } from '$lib/types';
	import { isEditing, settings, updateDashboardItem, getIntegrations } from '$lib/stores/dashboard';
	import { onMount, onDestroy } from 'svelte';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: ArrReleasesConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const sources = $derived(
		(['radarr', 'sonarr', 'lidarr'] as const).filter((s) => config?.integrations?.[s]).join(',')
	);
	const days = $derived(config?.days || 14);
	const limit = $derived(config?.limit || 10);
	const onlyDownloaded = $derived(!!config?.onlyDownloaded);
	const cells = $derived(colSpan * rowSpan);
	const isCompact = $derived(rowSpan === 1);
	const displayLimit = $derived(cells < 4 ? Math.min(limit, 3) : limit);
	const animLevel = $derived($settings?.animations || 'subtle');

	let entries = $state<ArrCalendarEntry[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// Edit modal state
	let showEditModal = $state(false);
	let closing = $state(false);
	let radarrEnabled = $state(false);
	let sonarrEnabled = $state(false);
	let lidarrEnabled = $state(false);
	let editDays = $state(14);
	let editLimit = $state(10);
	let editOnlyDownloaded = $state(false);
	let hasRadarr = $state(false);
	let hasSonarr = $state(false);
	let hasLidarr = $state(false);

	async function fetchData() {
		if (!sources) {
			entries = [];
			error = null;
			loading = false;
			return;
		}
		try {
			const params = new URLSearchParams({
				sources,
				days: String(days),
				limit: String(displayLimit),
				onlyDownloaded: String(onlyDownloaded)
			});
			const res = await fetch(`/api/integrations/arr/releases?${params}`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				error = err.error || `HTTP ${res.status}`;
				return;
			}
			const data = await res.json();
			entries = data.entries || [];
			error = entries.length === 0 && data.errors?.length
				? data.errors.map((e: { source: string; message: string }) => `${e.source}: ${e.message}`).join(', ')
				: null;
		} catch {
			error = 'Failed to fetch';
		} finally {
			loading = false;
		}
	}

	// Refetch whenever the query inputs change (also covers the initial load)
	$effect(() => {
		void sources;
		void days;
		void displayLimit;
		void onlyDownloaded;
		fetchData();
	});

	onMount(() => {
		intervalId = setInterval(fetchData, 60000);
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});

	async function openEditModal() {
		radarrEnabled = !!config?.integrations?.radarr;
		sonarrEnabled = !!config?.integrations?.sonarr;
		lidarrEnabled = !!config?.integrations?.lidarr;
		editDays = days;
		editLimit = limit;
		editOnlyDownloaded = onlyDownloaded;
		closing = false;
		try {
			const integrations = await getIntegrations();
			hasRadarr = !!integrations.radarr?.url;
			hasSonarr = !!integrations.sonarr?.url;
			hasLidarr = !!integrations.lidarr?.url;
		} catch {
			hasRadarr = false;
			hasSonarr = false;
			hasLidarr = false;
		}
		showEditModal = true;
	}

	function closeModal() {
		closing = true;
		setTimeout(() => { showEditModal = false; closing = false; }, 180);
	}

	async function handleSaveEdit() {
		showEditModal = false;
		closing = false;
		await updateDashboardItem(itemid, {
			config: {
				integrations: {
					radarr: radarrEnabled,
					sonarr: sonarrEnabled,
					lidarr: lidarrEnabled
				},
				days: Math.min(90, Math.max(1, Math.round(editDays) || 14)),
				limit: Math.min(50, Math.max(1, Math.round(editLimit) || 10)),
				onlyDownloaded: editOnlyDownloaded
			}
		} as any);
	}

	const SOURCE_META: Record<ArrCalendarEntry['type'], { label: string; color: string }> = {
		radarr: { label: 'Movie', color: '#FF9800' },
		sonarr: { label: 'Episode', color: '#2196F3' },
		lidarr: { label: 'Album', color: '#4CAF50' }
	};

	function relativeDate(date: string): string {
		const [y, m, d] = date.split('-').map(Number);
		const then = new Date(y, m - 1, d);
		const now = new Date();
		const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const diff = Math.round((todayMidnight.getTime() - then.getTime()) / 86_400_000);
		if (diff <= 0) return 'Today';
		if (diff === 1) return 'Yesterday';
		if (diff < 7) return `${diff} days ago`;
		return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function truncate(text: string | undefined, maxLen: number): string {
		if (!text) return '';
		return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
	}
</script>

<div class="releases-tile" class:compact={isCompact} style:--anim="{animLevel === 'none' ? '0s' : animLevel === 'subtle' ? '0.2s' : '0.3s'}">
	{#if !sources}
		<div class="releases-placeholder">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<rect x="2" y="4" width="20" height="16" rx="2" />
				<path d="M2 8h20M7 4v4M17 4v4" />
			</svg>
			<span>No sources selected</span>
		</div>
	{:else if loading && entries.length === 0}
		<div class="releases-placeholder">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<rect x="2" y="4" width="20" height="16" rx="2" />
				<path d="M2 8h20M7 4v4M17 4v4" />
			</svg>
			<span>Loading...</span>
		</div>
	{:else if error && entries.length === 0}
		<div class="releases-placeholder">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<circle cx="12" cy="12" r="10" />
				<path d="M12 8v4M12 16h.01" />
			</svg>
			<span>{error}</span>
		</div>
	{:else if entries.length === 0}
		<div class="releases-placeholder">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<rect x="2" y="4" width="20" height="16" rx="2" />
				<path d="M2 8h20M7 4v4M17 4v4" />
			</svg>
			<span>No releases in the last {days} days</span>
		</div>
	{:else}
		<div class="releases-list">
			{#each entries as entry (entry.type + entry.id)}
				<div class="releases-card" style:background-image={entry.posterUrl ? `url(${entry.posterUrl})` : undefined} class:no-image={!entry.posterUrl}>
					<div class="releases-gradient"></div>
					<div class="releases-content">
						<div class="releases-header">
							<span class="releases-badge" style:background={SOURCE_META[entry.type].color}>{SOURCE_META[entry.type].label}</span>
							<span class="releases-title">{truncate(entry.title, 40)}</span>
							<span class="releases-status" class:downloaded={entry.hasFile} title={entry.hasFile ? 'Downloaded' : 'Missing'}></span>
						</div>
						{#if !isCompact}
							{#if entry.subtitle}
								<p class="releases-subtitle">{truncate(entry.subtitle, 80)}</p>
							{/if}
							<span class="releases-date">Released {relativeDate(entry.date)} · {entry.hasFile ? 'Downloaded' : 'Missing'}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove Arr Releases">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); openEditModal(); }} onpointerdown={(e) => e.stopPropagation()} title="Edit releases widget">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
			</svg>
		</button>
	{/if}
</div>

{#if showEditModal}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div class="edit-overlay" class:closing onclick={() => closeModal()} onpointerdown={(e) => e.stopPropagation()}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="edit-modal" class:closing onpointerdown={(e) => e.stopPropagation()}>
		<h3>New Releases</h3>
		<div class="edit-fields">
			<label class="source-check" class:disabled={!hasRadarr}>
				<input type="checkbox" class="toggle-switch" bind:checked={radarrEnabled} disabled={!hasRadarr} />
				<span>Radarr</span>
				{#if !hasRadarr}
					<span class="source-hint">(not configured)</span>
				{/if}
			</label>
			<label class="source-check" class:disabled={!hasSonarr}>
				<input type="checkbox" class="toggle-switch" bind:checked={sonarrEnabled} disabled={!hasSonarr} />
				<span>Sonarr</span>
				{#if !hasSonarr}
					<span class="source-hint">(not configured)</span>
				{/if}
			</label>
			<label class="source-check" class:disabled={!hasLidarr}>
				<input type="checkbox" class="toggle-switch" bind:checked={lidarrEnabled} disabled={!hasLidarr} />
				<span>Lidarr</span>
				{#if !hasLidarr}
					<span class="source-hint">(not configured)</span>
				{/if}
			</label>
			<label class="source-check">
				<input type="checkbox" class="toggle-switch" bind:checked={editOnlyDownloaded} />
				<span>Downloaded only</span>
			</label>
			<div class="number-row">
				<label>
					<span>Last days</span>
					<input type="number" min="1" max="90" bind:value={editDays} />
				</label>
				<label>
					<span>Max items</span>
					<input type="number" min="1" max="50" bind:value={editLimit} />
				</label>
			</div>
		</div>
		<div class="edit-actions">
			<button class="btn-cancel" onclick={() => closeModal()}>Cancel</button>
			<button class="btn-save" onclick={() => handleSaveEdit()}>Save</button>
		</div>
	</div>
{/if}

<style>
	.releases-tile {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: 8px;
		gap: 6px;
	}

	.releases-tile.compact {
		padding: 4px;
		gap: 4px;
	}

	.releases-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.75rem;
		text-align: center;
		height: 100%;
	}

	.releases-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		overflow-x: hidden;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.releases-tile.compact .releases-list {
		gap: 4px;
	}

	/* Cards size to their content; the list scrolls when items exceed the tile height */
	.releases-card {
		position: relative;
		flex: 0 0 auto;
		min-height: 72px;
		border-radius: var(--radius-sm);
		background-size: cover;
		background-position: center 25%;
		overflow: hidden;
		display: flex;
		align-items: flex-end;
		outline: 1px solid transparent;
		outline-offset: -1px;
		transition: outline-color var(--anim) ease;
	}

	.releases-tile.compact .releases-card {
		min-height: 0;
	}

	.releases-card:hover {
		outline-color: var(--accent);
	}

	.releases-card.no-image {
		background: var(--bg-card-hover);
		border: 1px solid var(--border);
	}

	.releases-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 100%);
		pointer-events: none;
		z-index: 1;
	}

	.releases-card.no-image .releases-gradient {
		background: linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.05) 100%);
	}

	.releases-content {
		position: relative;
		z-index: 2;
		padding: 10px 12px;
		width: 100%;
		min-width: 0;
	}

	.releases-tile.compact .releases-content {
		padding: 6px 8px;
	}

	.releases-header {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.releases-badge {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 6px;
		border-radius: 4px;
		color: white;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.releases-title {
		font-weight: 700;
		font-size: 0.85rem;
		color: white;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		flex: 1;
	}

	.releases-tile.compact .releases-title {
		font-size: 0.75rem;
	}

	.releases-status {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--warning);
		box-shadow: 0 0 6px var(--warning);
	}

	.releases-status.downloaded {
		background: var(--success);
		box-shadow: 0 0 6px var(--success);
	}

	.releases-subtitle {
		font-size: 0.7rem;
		color: rgba(255,255,255,0.8);
		margin: 4px 0 0;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.releases-date {
		font-size: 0.65rem;
		color: rgba(255,255,255,0.6);
		margin-top: 4px;
		display: block;
	}

	.btn-delete,
	.btn-edit {
		position: absolute;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.btn-delete {
		top: -8px;
		background: var(--danger);
	}

	.btn-edit {
		bottom: -8px;
		background: var(--accent);
	}

	.releases-tile:hover .btn-delete,
	.releases-tile:hover .btn-edit {
		opacity: 1;
	}

	.btn-delete:hover {
		background: #c0392b;
	}

	.btn-edit:hover {
		background: var(--accent-hover);
	}

	/* Edit modal */
	.edit-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
		animation: fadeIn 0.15s ease;
	}

	.edit-overlay.closing {
		animation: fadeOut 0.18s ease forwards;
	}

	.edit-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 20px;
		width: 320px;
		z-index: 201;
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.edit-modal.closing {
		animation: slideDown 0.18s ease forwards;
	}

	.edit-modal h3 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 12px;
		color: var(--text-primary);
	}

	.edit-fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.source-check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		color: var(--text-primary);
		cursor: pointer;
	}

	.source-check.disabled {
		color: var(--text-muted);
		cursor: not-allowed;
	}

	.source-check input {
		cursor: pointer;
	}

	.source-check.disabled input {
		cursor: not-allowed;
	}

	.source-hint {
		font-size: 0.7rem;
		color: var(--text-muted);
		margin-left: auto;
	}

	.number-row {
		display: flex;
		gap: 12px;
		margin-top: 4px;
	}

	.number-row label {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.number-row input {
		width: 100%;
		padding: 6px 8px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.85rem;
	}

	.number-row input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.edit-actions button {
		padding: 6px 14px;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
	}

	.btn-cancel {
		background: var(--bg-card);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	.btn-cancel:hover {
		background: var(--bg-card-hover);
	}

	.btn-save {
		background: var(--accent);
		color: white;
	}

	.btn-save:hover {
		background: var(--accent-hover);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes fadeOut {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}

	@keyframes slideDown {
		from { opacity: 1; transform: translate(-50%, -50%); }
		to { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
	}

	/* Toggle switch */
	.toggle-switch {
		appearance: none;
		width: 36px;
		height: 20px;
		background: var(--border);
		border-radius: 20px;
		position: relative;
		cursor: pointer;
		outline: none;
		flex-shrink: 0;
		transition: background var(--transition);
	}

	.toggle-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		transition: transform var(--transition);
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
	}

	.toggle-switch:checked {
		background: var(--accent);
	}

	.toggle-switch:checked::after {
		transform: translateX(16px);
	}

	.toggle-switch:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
