<script lang="ts">
	// Service icon picker. Values:
	//   ""                 Auto: icon found by the service name, else its favicon
	//   "selfhst:<name>"   selfh.st icon library
	//   "homarr:<name>"    homarr dashboard-icons library
	//   "url:<https://…>"  custom image URL (downloaded once by the server)
	//   "custom:<file>"    uploaded image
	// The chosen icon is served (and cached) by CatBoard through /api/icon.
	import { iconSrc, describeIcon } from '$lib/utils/icons';

	let { value = '', onchange, name = '', url = '' }: {
		value?: string;
		onchange?: (icon: string) => void;
		/** Service name and URL, for the "Auto" preview. */
		name?: string;
		url?: string;
	} = $props();

	type Catalog = { n: string; s: 'selfhst' | 'homarr'; p?: string; f?: 'svg' | 'png' | 'webp'; t?: string }[];

	const CDN = { selfhst: 'https://cdn.jsdelivr.net/gh/selfhst/icons', homarr: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons' };
	/** Previews come straight from the CDN (fast, cached by the browser); the icon finally picked is cached by CatBoard. */
	const cdnPreview = (ic: Catalog[number]) => `${CDN[ic.s]}/${ic.f ?? 'svg'}/${ic.n}.${ic.f ?? 'svg'}`;
	type Tab = 'library' | 'url' | 'upload';

	const PAGE = 60;
	let open = $state(false);
	let tab = $state<Tab>('library');
	let search = $state('');
	let source = $state<'all' | 'selfhst' | 'homarr'>('all');
	let catalog = $state<Catalog>([]);
	let loading = $state(false);
	let error = $state('');
	let showCount = $state(PAGE);
	let customUrl = $state('');
	let uploading = $state(false);
	let previewFailed = $state(false);

	const preview = $derived(iconSrc({ icon: value, name, url }));
	$effect(() => {
		void preview;
		previewFailed = false;
	});

	async function loadCatalog() {
		if (catalog.length || loading) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/icons/catalog');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			catalog = await res.json();
			if (!catalog.length) error = 'Icon libraries unreachable (no Internet access from CatBoard?)';
		} catch {
			error = 'Failed to load the icon libraries';
		} finally {
			loading = false;
		}
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const list = catalog.filter((i) => source === 'all' || i.s === source);
		if (!q) return list;
		// Name matches first, then display names / aliases / tags.
		const direct = list.filter((i) => i.n.includes(q) || i.p?.toLowerCase().includes(q));
		const other = list.filter((i) => !direct.includes(i) && i.t?.toLowerCase().includes(q));
		return [...direct, ...other];
	});
	const visible = $derived(filtered.slice(0, showCount));

	function pick(next: string) {
		onchange?.(next);
		open = false;
		search = '';
		showCount = PAGE;
	}

	function toggleOpen() {
		open = !open;
		if (open) {
			customUrl = value.startsWith('url:') ? value.slice(4) : '';
			tab = value.startsWith('url:') ? 'url' : value.startsWith('custom:') ? 'upload' : 'library';
			void loadCatalog();
		}
	}

	function useUrl() {
		const u = customUrl.trim();
		if (!/^https?:\/\//i.test(u)) {
			error = 'Enter an http(s) image URL';
			return;
		}
		error = '';
		pick(`url:${u}`);
	}

	async function upload(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 1024 * 1024) {
			error = 'Image too large (max 1 MB)';
			return;
		}
		uploading = true;
		error = '';
		try {
			const res = await fetch('/api/icons/upload', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			pick(body.icon);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			uploading = false;
		}
	}
</script>

<div class="icon-picker">
	<div class="selected-icon" onclick={toggleOpen} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleOpen()}>
		<span class="sel-preview">
			{#if !previewFailed && (value || name || url)}
				<img src={preview} alt="" width="24" height="24" onerror={() => (previewFailed = true)} />
			{:else}
				<span class="sel-initial">{(name || '?').charAt(0).toUpperCase()}</span>
			{/if}
		</span>
		<span class="icon-name" class:placeholder={!value}>{describeIcon(value)}</span>
		<svg class="chevron" class:rotated={open} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M6 9l6 6 6-6" />
		</svg>
	</div>

	{#if open}
		<!-- Clicks and keys stay in the picker; Escape closes it, not the dialog around it. -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="dropdown"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				e.stopPropagation();
				if (e.key === 'Escape') open = false;
			}}
		>
			<div class="tabs" role="tablist">
				<button type="button" class="tab" class:active={tab === 'library'} role="tab" aria-selected={tab === 'library'} onclick={() => (tab = 'library')}>Libraries</button>
				<button type="button" class="tab" class:active={tab === 'url'} role="tab" aria-selected={tab === 'url'} onclick={() => (tab = 'url')}>URL</button>
				<button type="button" class="tab" class:active={tab === 'upload'} role="tab" aria-selected={tab === 'upload'} onclick={() => (tab = 'upload')}>Upload</button>
				<button type="button" class="tab auto" class:active={!value} onclick={() => pick('')} title="Find the icon by the service name, else use its favicon">Auto</button>
			</div>

			{#if tab === 'library'}
				<div class="search-row">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" />
						<path d="M21 21l-4.35-4.35" />
					</svg>
					<!-- svelte-ignore a11y_autofocus -->
					<input type="text" placeholder="Search icons, tags, categories…" bind:value={search} oninput={() => (showCount = PAGE)} autofocus />
					<select bind:value={source} onchange={() => (showCount = PAGE)} aria-label="Library">
						<option value="all">All</option>
						<option value="selfhst">selfh.st</option>
						<option value="homarr">homarr</option>
					</select>
					{#if catalog.length}<span class="count">{filtered.length}</span>{/if}
				</div>
				{#if loading}
					<div class="loading-state"><div class="spinner"></div><span>Loading icon libraries…</span></div>
				{:else if error && !catalog.length}
					<div class="error-state">{error}</div>
				{:else if visible.length}
					<div class="icon-grid">
						{#each visible as ic (ic.s + ':' + ic.n)}
							{@const v = `${ic.s}:${ic.n}`}
							<button type="button" class="icon-option" class:active={value === v || value === ic.n} onclick={() => pick(v)} title="{ic.p ?? ic.n} · {ic.s === 'selfhst' ? 'selfh.st' : 'homarr'}">
								<img src={cdnPreview(ic)} alt="" width="28" height="28" loading="lazy" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.2')} />
								<span class="icon-label">{ic.n}</span>
								<span class="src {ic.s}">{ic.s === 'selfhst' ? 'S' : 'H'}</span>
							</button>
						{/each}
					</div>
					{#if filtered.length > showCount}
						<button type="button" class="load-more" onclick={() => (showCount += PAGE)}>Show more ({filtered.length - showCount} remaining)</button>
					{/if}
				{:else}
					<p class="no-results">No icons found</p>
				{/if}
			{:else if tab === 'url'}
				<div class="pane">
					<label for="icon-url">Image URL (PNG, SVG, WebP, JPEG, ICO)</label>
					<div class="url-row">
						<input id="icon-url" type="url" placeholder="https://example.com/logo.png" bind:value={customUrl} onkeydown={(e) => e.key === 'Enter' && useUrl()} />
						<button type="button" class="btn-use" onclick={useUrl}>Use</button>
					</div>
					<p class="hint">CatBoard downloads it once and serves it from its cache.</p>
				</div>
			{:else}
				<div class="pane">
					<label class="upload" class:busy={uploading}>
						<input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg,image/gif,image/x-icon,.ico" onchange={upload} disabled={uploading} />
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
						<span>{uploading ? 'Uploading…' : 'Choose an image (max 1 MB)'}</span>
					</label>
					<p class="hint">Stored in CatBoard's config folder (config/icons).</p>
				</div>
			{/if}
			{#if error && catalog.length}<p class="error-inline">{error}</p>{/if}
		</div>
	{/if}
</div>

<style>
	.icon-picker {
		position: relative;
	}

	.selected-icon {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: border-color var(--transition);
	}

	.selected-icon:hover {
		border-color: var(--accent);
	}

	.sel-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}

	.sel-preview img {
		width: 24px;
		height: 24px;
		object-fit: contain;
	}

	.sel-initial {
		width: 24px;
		height: 24px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-secondary);
		background: var(--bg-card);
	}

	.icon-name {
		flex: 1;
		min-width: 0;
		font-size: 0.85rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.icon-name.placeholder {
		color: var(--text-muted);
	}

	.chevron {
		color: var(--text-muted);
		transition: transform var(--transition);
		flex-shrink: 0;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 50;
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
		overflow: hidden;
	}

	.tabs {
		display: flex;
		gap: 2px;
		padding: 6px 6px 0;
		border-bottom: 1px solid var(--border);
	}

	.tab {
		padding: 6px 12px;
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.tab.active {
		color: var(--text-primary);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.tab.auto {
		margin-left: auto;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-bottom: 1px solid var(--border);
		color: var(--text-muted);
	}

	.search-row input {
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-size: 0.85rem;
	}

	.search-row select {
		padding: 3px 6px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.75rem;
	}

	.count {
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.icon-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
		gap: 4px;
		padding: 8px;
		max-height: 280px;
		overflow-y: auto;
	}

	.icon-option {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 4px;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		transition: background var(--transition);
	}

	.icon-option:hover {
		background: var(--bg-card-hover);
	}

	.icon-option.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}

	.icon-option img {
		width: 28px;
		height: 28px;
		object-fit: contain;
	}

	.icon-label {
		width: 100%;
		font-size: 0.62rem;
		color: var(--text-secondary);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.src {
		position: absolute;
		top: 3px;
		right: 4px;
		font-size: 0.55rem;
		font-weight: 700;
		padding: 0 3px;
		border-radius: 3px;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
	}

	.src.selfhst {
		color: #3fb6ff;
	}

	.load-more {
		display: block;
		width: calc(100% - 16px);
		margin: 0 8px 8px;
		padding: 6px;
		border-radius: var(--radius-sm);
		font-size: 0.78rem;
		color: var(--text-secondary);
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
	}

	.pane {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.url-row {
		display: flex;
		gap: 6px;
	}

	.url-row input {
		flex: 1;
		min-width: 0;
		padding: 7px 9px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		outline: none;
	}

	.url-row input:focus {
		border-color: var(--accent);
	}

	.btn-use {
		padding: 0 14px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-weight: 600;
	}

	.upload {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 18px;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
	}

	.upload:hover {
		border-color: var(--accent);
		color: var(--text-primary);
	}

	.upload.busy {
		opacity: 0.6;
		cursor: wait;
	}

	.upload input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: inherit;
	}

	.hint {
		margin: 0;
		font-size: 0.72rem;
	}

	.loading-state,
	.error-state,
	.no-results {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 20px;
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.error-state,
	.error-inline {
		color: var(--danger);
	}

	.error-inline {
		margin: 0;
		padding: 0 12px 10px;
		font-size: 0.75rem;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
