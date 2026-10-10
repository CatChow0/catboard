<script lang="ts">
	// City search through /api/geocode, with the current choice and a Clear
	// button. Used by the navbar Weather widget's add and edit forms.
	import type { WeatherLocation } from '$lib/types';

	let { location = $bindable(null) }: { location?: WeatherLocation | null } = $props();

	type Result = { name: string; latitude: number; longitude: number; country: string; zipcode: string; admin1: string };

	let query = $state('');
	let results = $state<Result[]>([]);
	let loading = $state(false);
	let searched = $state(false);

	async function search() {
		if (query.trim().length < 2) return;
		loading = true;
		try {
			const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
			const data = await res.json();
			results = data.results || [];
		} catch {
			results = [];
		}
		searched = true;
		loading = false;
	}

	function select(r: Result) {
		location = { name: r.name, latitude: r.latitude, longitude: r.longitude, zipcode: r.zipcode, country: r.country };
		query = '';
		results = [];
		searched = false;
	}
</script>

<div class="location-search">
	<div class="search-row">
		<input type="text" bind:value={query} placeholder="Search city..." aria-label="Search city" onkeydown={(e) => e.key === 'Enter' && search()} />
		<button type="button" class="btn-search" onclick={search} disabled={loading || query.trim().length < 2}>
			{loading ? '...' : 'Search'}
		</button>
	</div>
	{#if results.length > 0}
		<div class="search-results">
			{#each results as r (`${r.latitude},${r.longitude}`)}
				<button type="button" class="result-item" onclick={() => select(r)}>
					<span class="result-name">{r.name}</span>
					<span class="result-detail">{r.admin1}{r.admin1 && r.country ? ', ' : ''}{r.country}</span>
				</button>
			{/each}
		</div>
	{:else if searched && !loading}
		<p class="no-results">No city found for “{query}”.</p>
	{/if}
	{#if location}
		<div class="current-location">
			<span class="location-label">{location.name}{location.zipcode ? ` ${location.zipcode}` : ''}{location.country ? `, ${location.country}` : ''}</span>
			<button type="button" class="btn-clear" onclick={() => (location = null)}>Clear</button>
		</div>
	{/if}
</div>

<style>
	.location-search {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.search-row {
		display: flex;
		gap: 6px;
	}

	.search-row input {
		flex: 1;
		min-width: 0;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.search-row input:focus {
		border-color: var(--accent);
	}

	.btn-search {
		padding: 8px 14px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.btn-search:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-search:disabled {
		opacity: 0.5;
	}

	.search-results {
		max-height: 160px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.result-item {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 8px 10px;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-light);
		text-align: left;
		cursor: pointer;
		transition: background var(--transition);
	}

	.result-item:last-child {
		border-bottom: none;
	}

	.result-item:hover {
		background: var(--bg-card-hover);
	}

	.result-name {
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.result-detail {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.no-results {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.current-location {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.location-label {
		font-size: 0.85rem;
		color: var(--text-primary);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.btn-clear {
		font-size: 0.8rem;
		color: var(--danger);
		flex-shrink: 0;
	}
</style>
