<script lang="ts">
	import type { CalendarConfig, ArrCalendarEntry } from '$lib/types';
	import { isEditing, updateDashboardItem, getIntegrations, arrCalendarData } from '$lib/stores/dashboard';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: CalendarConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();
	const today = now.getDate();

	const monthName = now.toLocaleString('default', { month: 'long' });
	const dayName = now.toLocaleString('default', { weekday: 'long' });

	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const firstDayOfWeek = new Date(year, month, 1).getDay();
	const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	const calendarDays: (number | null)[] = [];
	for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
	for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

	const showFull = $derived(colSpan >= 3 && rowSpan >= 2);
	const showMini = $derived(colSpan >= 2 || rowSpan >= 2);

	// Edit modal state
	let showEditModal = $state(false);
	let closing = $state(false);
	let radarrEnabled = $state(false);
	let sonarrEnabled = $state(false);
	let lidarrEnabled = $state(false);
	let hasRadarr = $state(false);
	let hasSonarr = $state(false);
	let hasLidarr = $state(false);
	let fetchError = $state(false);
	let fetchLoading = $state(false);

	// Map of day -> entries for current month
	const dayEntries = $derived(() => {
		const map = new Map<number, ArrCalendarEntry[]>();
		for (const entry of $arrCalendarData.entries) {
			if (!entry.date) continue;
			const [y, m, dStr] = entry.date.split('-').map(Number);
			if (y === year && m === month + 1) {
				const day = dStr;
				if (!map.has(day)) map.set(day, []);
				map.get(day)!.push(entry);
			}
		}
		return map;
	});
	let compactTodayEntries = $derived(dayEntries().get(today) || []);

	// Day popup state
	let selectedDay = $state<number | null>(null);
	let selectedDayEntries = $derived(selectedDay !== null ? (dayEntries().get(selectedDay) || []) : []);
	let popupStyle = $state('');

	$effect(() => {
		const sources = [];
		if (config?.integrations?.radarr) sources.push('radarr');
		if (config?.integrations?.sonarr) sources.push('sonarr');
		if (config?.integrations?.lidarr) sources.push('lidarr');

		if (sources.length === 0) {
			arrCalendarData.set({ entries: [], updatedAt: 0 });
			return;
		}

		fetchLoading = true;
		fetchError = false;

		const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
		const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

		fetch(`/api/integrations/arr/calendar?sources=${sources.join(',')}&start=${start}&end=${end}`)
			.then((res) => res.json())
			.then((data) => {
				arrCalendarData.set(data);
				fetchLoading = false;
			})
			.catch(() => {
				fetchError = true;
				fetchLoading = false;
			});
	});

	// Close day popup on outside click
	$effect(() => {
		if (selectedDay === null) return;
		function handleClick(e: MouseEvent) {
			const target = e.target as HTMLElement;
			if (!target.closest('.day-popup') && !target.closest('.calendar-day')) {
				selectedDay = null;
			}
		}
		setTimeout(() => document.addEventListener('click', handleClick), 0);
		return () => document.removeEventListener('click', handleClick);
	});

	async function openEditModal() {
		radarrEnabled = !!config?.integrations?.radarr;
		sonarrEnabled = !!config?.integrations?.sonarr;
		lidarrEnabled = !!config?.integrations?.lidarr;
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
				}
			}
		} as any);
	}

	function toggleDay(day: number, e: MouseEvent) {
		if (selectedDay === day) {
			selectedDay = null;
			popupStyle = '';
			return;
		}
		selectedDay = day;
		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		const popupW = 280;
		const entriesForDay = dayEntries().get(day) || [];
		const popupH = Math.min(entriesForDay.length * 96 + 20, 340);
		const pad = 8;

		let left = rect.left + rect.width / 2 - popupW / 2;
		let top = rect.top - popupH - pad;

		if (left < pad) left = pad;
		if (left + popupW > window.innerWidth - pad) left = window.innerWidth - popupW - pad;
		if (top < pad) top = rect.bottom + pad;

		popupStyle = `position:fixed;left:${left}px;top:${top}px;width:${popupW}px;z-index:50;`;
	}

	function dotColor(type: string): string {
		if (type === 'sonarr') return '#2196F3';
		if (type === 'radarr') return '#FF9800';
		return '#4CAF50';
	}

	function formatTooltip(entries: ArrCalendarEntry[]): string {
		return entries.slice(0, 5).map(e => `${e.title}${e.subtitle ? ` — ${e.subtitle}` : ''}`).join('\n') + (entries.length > 5 ? `\n+${entries.length - 5} more` : '');
	}
</script>

<div class="calendar-tile" class:full={showFull} class:mini={showMini && !showFull} class:compact={!showMini && !showFull}>
	{#if showFull}
		<div class="calendar-header">
			<span class="calendar-month">{monthName} {year}</span>
			{#if fetchLoading}
				<span class="calendar-loading" title="Loading releases...">...</span>
			{:else if fetchError}
				<span class="calendar-error" title="Failed to load releases">!</span>
			{/if}
		</div>
		<div class="calendar-grid">
			{#each weekDays as day}
				<div class="calendar-weekday">{day}</div>
			{/each}
			{#each calendarDays as day}
				{@const entries = day !== null ? (dayEntries().get(day) || []) : []}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="calendar-day" class:today={day === today} class:empty={day === null} class:has-entries={entries.length > 0} title={entries.length > 0 ? formatTooltip(entries) : undefined} onclick={(e) => entries.length > 0 && day !== null && toggleDay(day, e)} role="button" tabindex="0">
					{day ?? ''}
					{#if entries.length > 0}
						<div class="entry-dots">
							{#each entries.slice(0, 3) as entry}
								<span class="entry-dot" style="background: {dotColor(entry.type)};"></span>
							{/each}
							{#if entries.length > 3}
								<span class="entry-more">+{entries.length - 3}</span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else if showMini}
		<div class="calendar-mini-header">
			<span class="calendar-month-short">{monthName}</span>
			<span class="calendar-today-num">{today}</span>
		</div>
		<div class="calendar-grid mini">
			{#each weekDays as day}
				<div class="calendar-weekday">{day}</div>
			{/each}
			{#each calendarDays as day}
				{@const entries = day !== null ? (dayEntries().get(day) || []) : []}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="calendar-day" class:today={day === today} class:empty={day === null} class:has-entries={entries.length > 0} title={entries.length > 0 ? formatTooltip(entries) : undefined} onclick={(e) => entries.length > 0 && day !== null && toggleDay(day, e)} role="button" tabindex="0">
					{day ?? ''}
					{#if entries.length > 0}
						<div class="entry-dots mini">
							<span class="entry-dot" style="background: {dotColor(entries[0].type)};"></span>
							{#if entries.length > 1}
								<span class="entry-more">+{entries.length - 1}</span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="calendar-compact">
			<div class="compact-day">{dayName}</div>
			<div class="compact-date">{today}</div>
			<div class="compact-month">{monthName}</div>
			{#if compactTodayEntries.length > 0}
				<div class="compact-dots">
					{#each compactTodayEntries.slice(0, 3) as entry}
						<span class="entry-dot" style="background: {dotColor(entry.type)};"></span>
					{/each}
					{#if compactTodayEntries.length > 3}
						<span class="entry-more">+{compactTodayEntries.length - 3}</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove calendar">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); openEditModal(); }} onpointerdown={(e) => e.stopPropagation()} title="Edit calendar sources">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
			</svg>
		</button>
	{/if}
</div>

{#if selectedDay !== null}
	<div class="day-popup" style={popupStyle} onclick={(e) => e.stopPropagation()}>
		{#each selectedDayEntries as entry}
			<div class="day-popup-entry">
				{#if entry.posterUrl}
					<img src={entry.posterUrl} alt={entry.title} class="popup-poster" loading="lazy" />
				{:else}
					<div class="popup-poster placeholder">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<rect x="3" y="3" width="18" height="18" rx="2" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<path d="M21 15l-5-5L5 21" />
						</svg>
					</div>
				{/if}
				<div class="popup-info">
					<span class="popup-title">{entry.title}</span>
					{#if entry.subtitle}
						<span class="popup-subtitle">{entry.subtitle}</span>
					{/if}
					<span class="popup-type">{entry.type}</span>
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if showEditModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="edit-overlay" class:closing onclick={() => closeModal()} onpointerdown={(e) => e.stopPropagation()}></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="edit-modal" class:closing onpointerdown={(e) => e.stopPropagation()}>
		<h3>Calendar Sources</h3>
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
		</div>
		<div class="edit-actions">
			<button class="btn-cancel" onclick={() => closeModal()}>Cancel</button>
			<button class="btn-save" onclick={() => handleSaveEdit()}>Save</button>
		</div>
	</div>
{/if}

<style>
	.calendar-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 12px;
		display: flex;
		flex-direction: column;
		overflow: visible;
	}

	.calendar-tile.full {
		padding: 12px 14px;
	}

	.calendar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.calendar-month {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.calendar-loading {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.calendar-error {
		font-size: 0.75rem;
		color: var(--danger);
		font-weight: 700;
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		flex: 1;
	}

	.calendar-grid.mini {
		gap: 1px;
	}

	.calendar-weekday {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-align: center;
		font-weight: 600;
		padding: 2px 0;
	}

	.calendar-day {
		font-size: 0.75rem;
		text-align: center;
		padding: 4px 2px;
		border-radius: 4px;
		color: var(--text-secondary);
		line-height: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		position: relative;
	}

	.calendar-day.today {
		background: var(--accent);
		color: white;
		font-weight: 700;
	}

	.calendar-day.empty {
		visibility: hidden;
	}

	.calendar-day.has-entries {
		cursor: pointer;
	}

	.entry-dots {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.entry-dots.mini {
		gap: 1px;
	}

	.entry-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 0 1px var(--bg-card);
	}

	.entry-more {
		font-size: 0.55rem;
		color: var(--text-muted);
		font-weight: 600;
		line-height: 1;
	}

	/* Day popup (positioned via inline fixed style) */
	.day-popup {
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 10px;
		z-index: 50;
		box-shadow: 0 4px 16px rgba(0,0,0,0.35);
		display: flex;
		flex-direction: column;
		gap: 8px;
		pointer-events: auto;
		max-height: 340px;
		overflow-y: auto;
	}

	.day-popup-entry {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		background: var(--bg-card);
		border-radius: var(--radius);
		border: 1px solid var(--border);
	}

	.popup-poster {
		width: 48px;
		height: 72px;
		object-fit: cover;
		border-radius: 4px;
		flex-shrink: 0;
		background: var(--bg-secondary);
	}

	.popup-poster.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.popup-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.popup-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.popup-subtitle {
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.popup-type {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-transform: capitalize;
		font-weight: 500;
	}

	.calendar-mini-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 4px;
	}

	.calendar-month-short {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.calendar-today-num {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent);
	}

	.calendar-compact {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 2px;
	}

	.compact-day {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.compact-date {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.1;
	}

	.compact-month {
		font-size: 0.7rem;
		color: var(--text-secondary);
	}

	.compact-dots {
		display: flex;
		align-items: center;
		gap: 3px;
		margin-top: 2px;
	}

	.btn-delete {
		position: absolute;
		top: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--danger);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.calendar-tile:hover .btn-delete {
		opacity: 1;
	}

	.btn-delete:hover {
		background: #c0392b;
	}

	.btn-edit {
		position: absolute;
		bottom: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--accent);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.calendar-tile:hover .btn-edit {
		opacity: 1;
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
