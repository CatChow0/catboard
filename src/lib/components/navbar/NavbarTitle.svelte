<script lang="ts">
	// Navbar title + dashboard switcher. One small square per dashboard under the
	// title (the active one is wider and accent-coloured); click a square or use
	// the mouse wheel over the widget to switch. In edit mode a "+" square adds a
	// dashboard, and clicking the active square opens rename / move / delete.
	import {
		settings, isEditing, dashboards, activeDashboardId,
		switchDashboard, createDashboard, renameDashboard, moveDashboard, deleteDashboard
	} from '$lib/stores/dashboard';
	import NavbarPopover from './NavbarPopover.svelte';

	const WHEEL_LOCK_MS = 450;

	let root = $state<HTMLDivElement>();
	let activeDot = $state<HTMLButtonElement>();
	let menuOpen = $state(false);
	let editName = $state('');
	let error = $state('');
	let busy = $state(false);

	const list = $derived($dashboards);
	const activeIndex = $derived(list.findIndex((d) => d.id === $activeDashboardId));
	const active = $derived(list[activeIndex]);
	const showDots = $derived(list.length > 1 || $isEditing);

	// Wheel over the widget switches dashboards: one switch per gesture, and the
	// page must not scroll meanwhile (non-passive listener).
	$effect(() => {
		const el = root;
		if (!el) return;
		let lockedUntil = 0;
		const onWheel = (e: WheelEvent) => {
			if ($dashboards.length < 2) return;
			e.preventDefault();
			const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
			if (Math.abs(delta) < 4 || Date.now() < lockedUntil) return;
			lockedUntil = Date.now() + WHEEL_LOCK_MS;
			menuOpen = false;
			void switchDashboard(delta > 0 ? 'next' : 'prev');
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	});

	// Leaving edit mode closes the management menu.
	$effect(() => {
		if (!$isEditing) menuOpen = false;
	});

	function clickDot(id: string) {
		if (id === $activeDashboardId) {
			if (!$isEditing) return;
			editName = active?.name ?? '';
			error = '';
			menuOpen = !menuOpen;
			return;
		}
		menuOpen = false;
		void switchDashboard(id);
	}

	async function run(fn: () => Promise<void>) {
		busy = true;
		error = '';
		try {
			await fn();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	const add = () => run(async () => { menuOpen = false; await createDashboard(); });
	const saveName = () => active && editName.trim() && editName.trim() !== active.name && run(() => renameDashboard(active.id, editName));
	const move = (dir: -1 | 1) => active && run(() => moveDashboard(active.id, dir));
	const remove = () =>
		active &&
		confirm(`Delete the dashboard "${active.name}" with its tiles and navbar? This cannot be undone.`) &&
		run(async () => { menuOpen = false; await deleteDashboard(active.id); });

	// Squares sit inside a draggable navbar item: never start a navbar drag from them.
	const stop = (e: PointerEvent) => e.stopPropagation();
</script>

<div class="nt" class:editing={$isEditing} bind:this={root}>
	<h1 class="navbar-title">{$settings.title || 'Dashboard'}</h1>
	{#if showDots}
		<div class="nt-dots" role="tablist" aria-label="Dashboards">
			{#each list as d (d.id)}
				{#if d.id === $activeDashboardId}
					<button
						bind:this={activeDot}
						class="nt-dot active"
						data-dashboard-id={d.id}
						role="tab"
						aria-selected="true"
						aria-label="Dashboard {d.name}{$isEditing ? ' (manage)' : ''}"
						title={$isEditing ? `${d.name}: click to rename, move or delete` : d.name}
						onpointerdown={stop}
						onclick={() => clickDot(d.id)}
					></button>
				{:else}
					<button
						class="nt-dot"
						data-dashboard-id={d.id}
						role="tab"
						aria-selected="false"
						aria-label="Dashboard {d.name}"
						title={d.name}
						onpointerdown={stop}
						onclick={() => clickDot(d.id)}
					></button>
				{/if}
			{/each}
			{#if $isEditing}
				<button class="nt-dot nt-add" disabled={busy} onpointerdown={stop} onclick={add} title="New dashboard" aria-label="New dashboard">
					<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 2v6M2 5h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
				</button>
			{/if}
		</div>
	{/if}
	{#if error && !menuOpen}<p class="nt-error">{error}</p>{/if}
</div>

{#if menuOpen && activeDot && active}
	<NavbarPopover anchor={activeDot} label="Manage dashboard {active.name}" width={260} onclose={() => (menuOpen = false)}>
		<div class="nt-menu">
			<label class="nt-field">
				<span>Name</span>
				<input type="text" maxlength="40" bind:value={editName} onkeydown={(e) => e.key === 'Enter' && saveName()} onblur={saveName} />
			</label>
			<div class="nt-row">
				<button class="nt-btn" disabled={busy || activeIndex <= 0} onclick={() => move(-1)} aria-label="Move left">← Move</button>
				<button class="nt-btn" disabled={busy || activeIndex >= list.length - 1} onclick={() => move(1)} aria-label="Move right">Move →</button>
			</div>
			<button class="nt-btn danger" disabled={busy || list.length <= 1} onclick={remove} title={list.length <= 1 ? 'The last dashboard cannot be deleted' : undefined}>Delete dashboard</button>
			{#if error}<p class="nt-error">{error}</p>{/if}
		</div>
	</NavbarPopover>
{/if}

<style>
	.nt {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: calc(4px * var(--nb-text, 1));
		min-width: 0;
		height: 100%;
	}

	.navbar-title {
		font-size: calc(1.2rem * var(--nb-text, 1));
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.15;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nt-dots {
		display: flex;
		align-items: center;
		gap: calc(5px * var(--nb-icon, 1));
		min-width: 0;
		overflow: hidden;
	}

	/* Edit mode: the navbar item's edit button sits at the bottom-left corner. */
	.nt.editing .nt-dots {
		padding-left: 16px;
	}

	.nt-dot {
		flex-shrink: 0;
		width: calc(8px * var(--nb-icon, 1));
		height: calc(8px * var(--nb-icon, 1));
		padding: 0;
		border: 0;
		border-radius: 2px;
		background: color-mix(in srgb, var(--text-muted) 32%, transparent);
		cursor: pointer;
		transition: width var(--transition), background var(--transition), transform var(--transition);
	}

	.nt-dot:hover {
		background: color-mix(in srgb, var(--text-muted) 60%, transparent);
	}

	.nt-dot.active {
		width: calc(18px * var(--nb-icon, 1));
		background: var(--accent);
	}

	.nt-dot:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.nt-add {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
		background: transparent;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-muted) 55%, transparent);
	}

	.nt-add svg {
		width: 100%;
		height: 100%;
	}

	.nt-add:hover {
		color: var(--accent);
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	.nt-menu {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
	}

	.nt-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.nt-field input {
		padding: 7px 9px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.85rem;
		outline: none;
	}

	.nt-field input:focus {
		border-color: var(--accent);
	}

	.nt-row {
		display: flex;
		gap: 8px;
	}

	.nt-row .nt-btn {
		flex: 1;
	}

	.nt-btn {
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-primary);
		background: color-mix(in srgb, var(--text-muted) 16%, transparent);
		transition: background var(--transition), color var(--transition);
	}

	.nt-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.nt-btn.danger:hover:not(:disabled) {
		color: white;
		background: var(--danger);
	}

	.nt-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.nt-error {
		margin: 0;
		font-size: 0.72rem;
		color: var(--danger);
	}
</style>
