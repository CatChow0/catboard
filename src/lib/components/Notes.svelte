<script lang="ts">
	// Markdown notepad. Edit in place (no need for dashboard edit mode);
	// checklist boxes can be ticked directly in the rendered note. The note is
	// part of the dashboard: users who may not change it get it read-only.
	import type { NotesConfig } from '$lib/types';
	import { updateDashboardItem, currentUser } from '$lib/stores/dashboard';
	import { renderMarkdown, toggleTask } from '$lib/utils/markdown';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';

	let { config, ondelete, itemid }: { config?: NotesConfig; colSpan?: number; rowSpan?: number; ondelete?: () => void; itemid: string } = $props();

	// Optimistic value shown while the layout save is in flight.
	let pending = $state<string | null>(null);
	const content = $derived(pending ?? config?.content ?? '');

	const canEdit = $derived(!!$currentUser?.canEdit);
	// Read-only: checklist boxes are shown but cannot be ticked.
	const html = $derived(canEdit ? renderMarkdown(content) : renderMarkdown(content).replace(/<input type="checkbox"/g, '<input type="checkbox" disabled'));

	let editing = $state(false);
	let draft = $state('');
	let textarea = $state<HTMLTextAreaElement>();

	function startEdit() {
		if (!canEdit) return;
		draft = content;
		editing = true;
		queueMicrotask(() => textarea?.focus());
	}

	async function save(next: string) {
		pending = next;
		try {
			await updateDashboardItem(itemid, { config: { ...config, content: next } } as any);
		} finally {
			pending = null;
		}
	}

	function finishEdit() {
		editing = false;
		if (draft !== content) save(draft);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			editing = false;
		} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			finishEdit();
		}
	}

	// Checklist boxes carry the source line they come from; the change bubbles here.
	function onNoteChange(e: Event) {
		const box = e.target as HTMLInputElement;
		if (!canEdit || box.type !== 'checkbox' || box.dataset.line == null) return;
		save(toggleTask(content, Number(box.dataset.line)));
	}

	// --- Title (dashboard edit mode) ---
	let showEdit = $state(false);
</script>

<div class="nt-tile" class:editing>
	<div class="nt-inner">
		<div class="nt-head">
			{#if config?.title}<span class="nt-title">{config.title}</span>{/if}
			{#if editing}
				<span class="nt-hint">Markdown · Ctrl+Enter to save · Esc to cancel</span>
				<button class="nt-btn primary" onclick={finishEdit} onpointerdown={(e) => e.stopPropagation()}>Save</button>
			{:else if canEdit}
				<button class="nt-btn" onclick={startEdit} onpointerdown={(e) => e.stopPropagation()} aria-label="Edit note">Edit</button>
			{/if}
		</div>
		{#if editing}
			<textarea
				bind:this={textarea}
				bind:value={draft}
				onkeydown={onKey}
				onpointerdown={(e) => e.stopPropagation()}
				spellcheck="true"
				placeholder={'# Title\n\n- [ ] Something to do\n- **bold**, *italic*, [link](https://…)'}
			></textarea>
		{:else if content.trim()}
			<div class="nt-body" onchange={onNoteChange}>
				<!-- Safe: renderMarkdown escapes all user text before adding its own tags. -->
				{@html html}
			</div>
		{:else if canEdit}
			<button class="nt-empty" onclick={startEdit} onpointerdown={(e) => e.stopPropagation()}>Empty note. Click to write something.</button>
		{:else}
			<p class="nt-readonly">Empty note.</p>
		{/if}
	</div>
	<EditButtons label="note" {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="notes" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.nt-readonly {
		margin: auto;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.nt-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.nt-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.nt-head {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 22px;
	}

	.nt-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nt-hint {
		font-size: 0.68rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nt-btn {
		margin-left: auto;
		font-size: 0.72rem;
		padding: 2px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-secondary);
		opacity: 0;
		transition: opacity var(--transition);
	}

	.nt-tile:hover .nt-btn,
	.nt-btn:focus-visible,
	.nt-btn.primary {
		opacity: 1;
	}

	/* No hover on touch screens (or phones): the button is always shown, with a finger-sized target. */
	@media (hover: none), (max-width: 640px) {
		.nt-btn {
			opacity: 1;
			padding: 6px 12px;
		}
	}

	.nt-btn.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	textarea {
		flex: 1;
		min-height: 0;
		resize: none;
		padding: 8px;
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font: 0.82rem/1.5 ui-monospace, 'Cascadia Mono', Consolas, monospace;
		outline: none;
	}

	textarea:focus {
		border-color: var(--accent);
	}

	.nt-empty {
		margin: auto;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.nt-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--text-secondary);
		overflow-wrap: anywhere;
	}

	.nt-body :global(h1),
	.nt-body :global(h2),
	.nt-body :global(h3),
	.nt-body :global(h4) {
		margin: 0.4em 0 0.25em;
		color: var(--text-primary);
		line-height: 1.25;
	}

	.nt-body :global(h1) { font-size: 1.15rem; }
	.nt-body :global(h2) { font-size: 1.02rem; }
	.nt-body :global(h3),
	.nt-body :global(h4) { font-size: 0.92rem; }

	.nt-body :global(p),
	.nt-body :global(ul),
	.nt-body :global(ol),
	.nt-body :global(pre),
	.nt-body :global(blockquote) {
		margin: 0 0 0.5em;
	}

	.nt-body :global(ul),
	.nt-body :global(ol) {
		padding-left: 1.3em;
	}

	.nt-body :global(ul.tasks) {
		list-style: none;
		padding-left: 0.1em;
	}

	.nt-body :global(li.task label) {
		display: flex;
		gap: 6px;
		align-items: baseline;
		cursor: pointer;
	}

	.nt-body :global(li.task input) {
		accent-color: var(--accent);
		cursor: pointer;
	}

	.nt-body :global(li.task.done span) {
		text-decoration: line-through;
		color: var(--text-muted);
	}

	.nt-body :global(a) {
		color: var(--accent);
	}

	.nt-body :global(code) {
		font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
		font-size: 0.85em;
		padding: 0.1em 0.35em;
		border-radius: 4px;
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
	}

	.nt-body :global(pre) {
		padding: 8px;
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		overflow-x: auto;
	}

	.nt-body :global(pre code) {
		padding: 0;
		background: none;
	}

	.nt-body :global(blockquote) {
		padding-left: 10px;
		border-left: 3px solid var(--border-light);
		color: var(--text-muted);
	}

	.nt-body :global(hr) {
		border: 0;
		border-top: 1px solid var(--border);
		margin: 0.6em 0;
	}

	.nt-body :global(strong) {
		color: var(--text-primary);
	}
</style>
