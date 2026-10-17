<script lang="ts" module>
	export interface MenuItem {
		label: string;
		/** Small grey text on the right (e.g. "current"). */
		hint?: string;
		danger?: boolean;
		disabled?: boolean;
		onselect?: () => void;
		children?: MenuItem[];
	}
</script>

<script lang="ts">
	// Right-click menu with nested submenus. Opens at (x, y), stays inside the
	// window (submenus flip to the left when needed), closes on an outside click,
	// Escape, scroll or resize. Keyboard: ↑ ↓ move, → / Enter open a submenu,
	// ← goes back, Enter picks. On phones it is a bottom sheet where submenus
	// replace the list (with a back row) instead of opening beside it.
	import { isPhone } from '$lib/stores/viewport';
	import BottomSheet from './BottomSheet.svelte';

	let { x, y, title = '', items, onclose }: { x: number; y: number; title?: string; items: MenuItem[]; onclose: () => void } = $props();

	/** Index whose submenu is open, per level. */
	let expanded = $state<number[]>([]);
	let focus = $state<{ level: number; index: number }>({ level: 0, index: -1 });

	function listAt(level: number): MenuItem[] {
		let list = items;
		for (let l = 0; l < level; l++) list = list[expanded[l]]?.children ?? [];
		return list;
	}

	function hover(level: number, index: number, item: MenuItem) {
		focus = { level, index };
		expanded = item.children && !item.disabled ? [...expanded.slice(0, level), index] : expanded.slice(0, level);
	}

	function activate(level: number, index: number) {
		const item = listAt(level)[index];
		if (!item || item.disabled) return;
		if (item.children) {
			expanded = [...expanded.slice(0, level), index];
			focus = { level: level + 1, index: 0 };
			return;
		}
		onclose();
		item.onselect?.();
	}

	function onKey(e: KeyboardEvent) {
		const { level, index } = focus;
		const list = listAt(level);
		const step = (dir: 1 | -1) => {
			if (!list.length) return;
			let i = index;
			for (let n = 0; n < list.length; n++) {
				i = (i + dir + list.length) % list.length;
				if (!list[i].disabled) break;
			}
			hover(level, i, list[i]);
			focus = { level, index: i };
			if (!list[i].children) expanded = expanded.slice(0, level);
		};
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowDown') step(1);
		else if (e.key === 'ArrowUp') step(-1);
		else if (e.key === 'ArrowRight' && list[index]?.children) activate(level, index);
		else if (e.key === 'ArrowLeft' && level > 0) {
			focus = { level: level - 1, index: expanded[level - 1] };
			expanded = expanded.slice(0, level - 1);
		} else if (e.key === 'Enter' && index >= 0) activate(level, index);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	/** Keep a panel inside the window: the root shifts, submenus flip to the left. */
	function fit(node: HTMLElement, root: boolean) {
		const r = node.getBoundingClientRect();
		if (root) {
			node.style.left = `${Math.max(6, Math.min(x, window.innerWidth - r.width - 6))}px`;
			node.style.top = `${Math.max(6, Math.min(y, window.innerHeight - r.height - 6))}px`;
		} else {
			if (r.right > window.innerWidth - 6) {
				node.style.left = 'auto';
				node.style.right = 'calc(100% - 4px)';
			}
			if (r.bottom > window.innerHeight - 6) node.style.top = `${window.innerHeight - 6 - r.bottom}px`;
		}
	}

	$effect(() => {
		// The phone sheet closes itself (backdrop, Escape, swipe down) and must survive scrolling.
		if ($isPhone) return;
		const close = () => onclose();
		const outside = (e: PointerEvent) => {
			if (!(e.target as HTMLElement).closest?.('.cm-root')) onclose();
		};
		window.addEventListener('keydown', onKey, true);
		window.addEventListener('pointerdown', outside, true);
		window.addEventListener('resize', close);
		window.addEventListener('scroll', close, true);
		return () => {
			window.removeEventListener('keydown', onKey, true);
			window.removeEventListener('pointerdown', outside, true);
			window.removeEventListener('resize', close);
			window.removeEventListener('scroll', close, true);
		};
	});

	// --- Phone: drill-down ---
	const sheetLevel = $derived(expanded.length);
	const sheetList = $derived(listAt(sheetLevel));
	const sheetParent = $derived(sheetLevel > 0 ? listAt(sheetLevel - 1)[expanded[sheetLevel - 1]] : null);

	function sheetBack() {
		expanded = expanded.slice(0, -1);
	}
</script>

{#snippet panel(list: MenuItem[], level: number)}
	<div class="cm-panel" class:cm-sub={level > 0} role="menu" use:fit={level === 0}>
		{#if level === 0 && title}<div class="cm-title">{title}</div>{/if}
		{#each list as item, i (i)}
			<div class="cm-row">
				<button
					type="button"
					role="menuitem"
					class="cm-item"
					class:danger={item.danger}
					class:focused={focus.level === level && focus.index === i}
					class:open={expanded[level] === i && !!item.children}
					disabled={item.disabled}
					aria-haspopup={item.children ? 'menu' : undefined}
					aria-expanded={item.children ? expanded[level] === i : undefined}
					onpointerenter={() => hover(level, i, item)}
					onclick={() => activate(level, i)}
				>
					<span class="cm-label">{item.label}</span>
					{#if item.hint}<span class="cm-hint">{item.hint}</span>{/if}
					{#if item.children}<span class="cm-arrow" aria-hidden="true">›</span>{/if}
				</button>
				{#if item.children && expanded[level] === i}
					{@render panel(item.children, level + 1)}
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#if $isPhone}
	<BottomSheet label={title || 'Menu'} title={sheetParent ? sheetParent.label : title} {onclose}>
		<div class="cm-sheet" role="menu">
			{#if sheetLevel > 0}
				<button type="button" class="cm-sheet-item back" onclick={sheetBack}>
					<span class="cm-arrow" aria-hidden="true">‹</span>
					<span class="cm-label">Back</span>
				</button>
			{/if}
			{#each sheetList as item, i (i)}
				<button
					type="button"
					role="menuitem"
					class="cm-sheet-item"
					class:danger={item.danger}
					disabled={item.disabled}
					onclick={() => activate(sheetLevel, i)}
				>
					<span class="cm-label">{item.label}</span>
					{#if item.hint}<span class="cm-hint">{item.hint}</span>{/if}
					{#if item.children}<span class="cm-arrow" aria-hidden="true">›</span>{/if}
				</button>
			{/each}
		</div>
	</BottomSheet>
{:else}
	<div class="cm-root" oncontextmenu={(e) => e.preventDefault()} role="presentation">
		{@render panel(items, 0)}
	</div>
{/if}

<style>
	.cm-root {
		position: fixed;
		inset: 0 auto auto 0;
		z-index: 2000;
	}

	.cm-panel {
		position: fixed;
		min-width: 190px;
		max-width: 280px;
		padding: 4px;
		border-radius: var(--radius);
		background: var(--bg-modal);
		border: 1px solid var(--border);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
		animation: cm-in 0.12s ease;
	}

	.cm-sub {
		position: absolute;
		left: calc(100% - 4px);
		top: -5px;
	}

	.cm-title {
		padding: 6px 10px 4px;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.cm-row {
		position: relative;
	}

	.cm-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 10px;
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		text-align: left;
		color: var(--text-primary);
		background: none;
	}

	.cm-item.focused:not(:disabled),
	.cm-item.open {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.cm-item.danger {
		color: var(--danger);
	}

	.cm-item.danger.focused:not(:disabled) {
		color: white;
		background: var(--danger);
	}

	.cm-item:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.cm-label {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cm-hint {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.cm-arrow {
		font-size: 0.95rem;
		color: var(--text-muted);
	}

	.cm-sheet {
		display: flex;
		flex-direction: column;
		padding: 0 8px;
	}

	.cm-sheet-item {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 0 12px;
		border-radius: var(--radius-sm);
		font-size: 1rem;
		text-align: left;
		color: var(--text-primary);
		background: none;
	}

	.cm-sheet-item:active:not(:disabled) {
		background: var(--bg-card-hover);
	}

	.cm-sheet-item.danger {
		color: var(--danger);
	}

	.cm-sheet-item.back {
		color: var(--accent);
		font-weight: 600;
	}

	.cm-sheet-item .cm-hint {
		font-size: 0.8rem;
	}

	.cm-sheet-item .cm-arrow {
		font-size: 1.3rem;
	}

	.cm-sheet-item:disabled {
		opacity: 0.45;
	}

	@keyframes cm-in {
		from { opacity: 0; transform: translateY(-3px); }
		to { opacity: 1; transform: none; }
	}
</style>
