<script lang="ts">
	let { onsettings, onlogout }: {
		onsettings: () => void;
		onlogout: () => void;
	} = $props();

	let open = $state(false);
	let versionInfo = $state<{ current: string; latest: string; hasUpdate: boolean } | null>(null);

	$effect(() => {
		fetch('/api/version')
			.then((res) => res.json())
			.then((data) => { versionInfo = data; })
			.catch(() => {});
	});

	function toggle() {
		open = !open;
	}

	function handleSettings() {
		open = false;
		onsettings();
	}

	function handleLogout() {
		open = false;
		onlogout();
	}

	function handleClickOutside(e: MouseEvent) {
		if (!(e.target as HTMLElement).closest('.options-container')) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="options-container">
	<button class="options-btn" onclick={toggle} title="Options">
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="3" />
			<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
		</svg>
		{#if versionInfo?.hasUpdate}
			<span class="update-badge"></span>
		{/if}
	</button>
	{#if open}
		<div class="options-dropdown">
			<div class="version-row">
				<span class="version-label">v{versionInfo?.current || '...'}</span>
				{#if versionInfo?.hasUpdate}
					<span class="version-new">New: {versionInfo.latest}</span>
				{/if}
			</div>
			<div class="dropdown-divider"></div>
			<button class="dropdown-item" onclick={handleSettings}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
				Settings
			</button>
			<div class="dropdown-divider"></div>
			<button class="dropdown-item logout" onclick={handleLogout}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
					<polyline points="16 17 21 12 16 7" />
					<line x1="21" y1="12" x2="9" y2="12" />
				</svg>
				Logout
			</button>
		</div>
	{/if}
</div>

<style>
	.options-container {
		position: relative;
	}

	.options-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		color: var(--text-primary);
		transition: all var(--transition);
	}

	.options-btn:hover {
		background: var(--bg-card-hover);
		color: var(--accent);
		border-color: var(--accent);
	}

	.update-badge {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--danger);
		border: 2px solid var(--bg-card);
		z-index: 2;
	}

	.options-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		width: max-content;
		box-shadow: var(--shadow);
		z-index: 100;
		overflow: hidden;
	}

	.version-row {
		display: flex;
		flex-direction: column;
		padding: 6px 12px;
		gap: 2px;
	}

	.version-label {
		font-size: 0.7rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.version-new {
		font-size: 0.65rem;
		color: var(--danger);
		font-weight: 600;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		background: var(--bg-card);
		border: none;
		color: var(--text-primary);
		font-size: 0.85rem;
		text-align: left;
		transition: background var(--transition);
	}

	.dropdown-item:hover {
		background: var(--bg-card-hover);
	}

	.dropdown-item.logout {
		color: var(--danger);
	}

	.dropdown-item.logout:hover {
		background: rgba(255, 79, 111, 0.1);
	}

	.dropdown-divider {
		height: 1px;
		background: var(--border);
		margin: 4px 0;
	}
</style>
