<script lang="ts">
	let {
		placeholder = 'Search services...',
		onsearch
	}: {
		placeholder?: string;
		onsearch?: (query: string, isEnter: boolean) => void;
	} = $props();

	let searchQuery = $state('');

	function handleInput() {
		onsearch?.(searchQuery, false);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			onsearch?.(searchQuery, true);
		}
	}
</script>

<div class="search-box">
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<circle cx="11" cy="11" r="8" />
		<path d="M21 21l-4.35-4.35" />
	</svg>
	<input type="text" {placeholder} bind:value={searchQuery} oninput={handleInput} onkeydown={handleKeyDown} />
</div>

<style>
	.search-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: border-color var(--transition);
		width: 100%;
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
		color: var(--text-primary);
		font-size: 0.9rem;
	}
</style>
