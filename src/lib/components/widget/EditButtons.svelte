<script lang="ts">
	// Delete / edit buttons shown on a widget tile in dashboard edit mode.
	// The parent tile must be position: relative.
	import { isEditing } from '$lib/stores/dashboard';

	let { label, ondelete, onedit }: { label: string; ondelete?: () => void; onedit?: () => void } = $props();
</script>

{#if $isEditing}
	{#if ondelete}
		<button class="eb eb-delete" onclick={(e) => { e.stopPropagation(); ondelete(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove {label}" aria-label="Remove {label}">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
		</button>
	{/if}
	{#if onedit}
		<button class="eb eb-edit" onclick={(e) => { e.stopPropagation(); onedit(); }} onpointerdown={(e) => e.stopPropagation()} title="Edit {label}" aria-label="Edit {label}">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
{/if}

<style>
	.eb {
		position: absolute;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		color: white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
		z-index: 10;
	}

	.eb-delete {
		top: -8px;
		background: var(--danger);
	}

	.eb-edit {
		bottom: -8px;
		background: var(--accent);
	}
</style>
