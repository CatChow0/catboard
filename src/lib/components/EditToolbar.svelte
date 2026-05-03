<script lang="ts">
	import { isEditing, settings } from '$lib/stores/dashboard';
	import OptionsDropdown from './OptionsDropdown.svelte';

	let { searchQuery = '', onadd, onsettings, onlogout }: { searchQuery?: string; onadd?: () => void; onsettings: () => void; onlogout: () => void } = $props();

	function toggleEdit() {
		isEditing.update((v) => !v);
	}
</script>

<header class="toolbar">
	<div class="toolbar-left">
		<h1 class="title">Dashboard</h1>
	</div>
	{#if $settings.navbar?.showSearch !== false}
		<div class="toolbar-center">
			<div class="search-box">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8" />
					<path d="M21 21l-4.35-4.35" />
				</svg>
				<input type="text" placeholder="Search services..." bind:value={searchQuery} />
			</div>
		</div>
	{/if}
	<div class="toolbar-right">
		{#if $isEditing}
			<button class="btn-add" onclick={() => onadd?.()} title="Add service or widget">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				<span>Add</span>
			</button>
		{/if}
		<button class="btn-edit-toggle" class:active={$isEditing} onclick={toggleEdit} title="Toggle edit mode">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
			<span>Edit</span>
		</button>
		<OptionsDropdown {onsettings} {onlogout} />
	</div>
</header>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		gap: 16px;
		flex-wrap: wrap;
	}

	.toolbar-left {
		flex-shrink: 0;
	}

	.title {
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.toolbar-center {
		flex: 1;
		max-width: 400px;
		min-width: 180px;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: border-color var(--transition);
	}

	.search-box:focus-within {
		border-color: var(--accent);
	}

	.search-box svg {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.search-box input {
		background: none;
		border: none;
		outline: none;
		width: 100%;
		padding: 0;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.btn-add {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-size: 0.9rem;
		transition: background var(--transition);
	}

	.btn-add:hover {
		background: var(--accent-hover);
	}

	.btn-edit-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-size: 0.9rem;
		transition: all var(--transition);
	}

	.btn-edit-toggle:hover {
		border-color: var(--accent);
	}

	.btn-edit-toggle.active {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	@media (max-width: 640px) {
		.toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.toolbar-center {
			max-width: 100%;
		}

		.toolbar-right {
			justify-content: flex-end;
		}
	}
</style>