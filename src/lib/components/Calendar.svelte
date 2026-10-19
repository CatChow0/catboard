<script lang="ts">
	import { t, intlLocale } from '$lib/i18n';
	import type { CalendarConfig, ArrCalendarEntry } from '$lib/types';
	import { isEditing, arrCalendarData } from '$lib/stores/dashboard';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';

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

	const monthName = now.toLocaleString(intlLocale(), { month: 'long' });
	const dayName = now.toLocaleString(intlLocale(), { weekday: 'long' });

	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const firstDayOfWeek = new Date(year, month, 1).getDay();
	const weekDays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleString(intlLocale(), { weekday: 'short' }).slice(0, 2));

	const calendarDays: (number | null)[] = [];
	for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
	for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

	const showFull = $derived(colSpan >= 3 && rowSpan >= 2);
	const showMini = $derived(colSpan >= 2 || rowSpan >= 2);

	let showEditModal = $state(false);
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

	// Close day popup on outside click or Escape
	$effect(() => {
		if (selectedDay === null) return;
		function handleClick(e: MouseEvent) {
			const target = e.target as HTMLElement;
			if (!target.closest('.day-popup') && !target.closest('.calendar-day')) {
				selectedDay = null;
			}
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === 'Escape') selectedDay = null;
		}
		setTimeout(() => document.addEventListener('click', handleClick), 0);
		document.addEventListener('keydown', handleKey);
		return () => {
			document.removeEventListener('click', handleClick);
			document.removeEventListener('keydown', handleKey);
		};
	});

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
		return entries.slice(0, 5).map(e => `${e.title}${e.subtitle ? ` — ${e.subtitle}` : ''}`).join('\n') + (entries.length > 5 ? `\n${$t('calendar.more', { n: entries.length - 5 })}` : '');
	}
</script>

<div class="calendar-tile" class:full={showFull} class:mini={showMini && !showFull} class:compact={!showMini && !showFull}>
	{#if showFull}
		<div class="calendar-header">
			<span class="calendar-month">{monthName} {year}</span>
			{#if fetchLoading}
				<span class="calendar-loading" title={$t('calendar.loading')}>...</span>
			{:else if fetchError}
				<span class="calendar-error" title={$t('calendar.failed')}>!</span>
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
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title={$t('calendar.remove')}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); showEditModal = true; }} onpointerdown={(e) => e.stopPropagation()} title={$t('calendar.edit')}>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
			</svg>
		</button>
	{/if}
</div>

{#if selectedDay !== null}
	<div class="day-popup" style={popupStyle} role="dialog" aria-label={$t('calendar.dayReleases')}>
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
	<WidgetEditModal type="calendar" {itemid} {config} onclose={() => (showEditModal = false)} />
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
</style>
