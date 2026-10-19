<script lang="ts">
	import { t } from '$lib/i18n';
	import type { DockerWidgetConfig } from '$lib/types';
	import { isEditing, dockerData } from '$lib/stores/dashboard';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import DockerDetails from './details/DockerDetails.svelte';
	import DockerLogo from './icons/DockerLogo.svelte';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: DockerWidgetConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	let showEditModal = $state(false);

	const cells = $derived(colSpan * rowSpan);
	const showContainers = $derived(cells >= 4);

	const data = $derived($dockerData[config?.environmentId || '']);
</script>

<div class="docker-tile">
	<div class="docker-inner">
		{#if !config?.environmentId}
			<div class="docker-placeholder">
				<DockerLogo size={24} />
				<span>{$t('docker.noEnv')}</span>
			</div>
		{:else if !data}
			<div class="docker-loading">...</div>
		{:else}
			<DockerDetails {data} showList={showContainers} showCpu={config.showCpu} showRam={config.showRam} />
		{/if}
	</div>
	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title={$t('widget.remove', { label: 'Docker' })}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); showEditModal = true; }} onpointerdown={(e) => e.stopPropagation()} title={$t('widget.edit', { label: 'Docker' })}>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
</div>

{#if showEditModal}
	<WidgetEditModal type="docker" {itemid} {config} onclose={() => (showEditModal = false)} />
{/if}

<style>
	.docker-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
	}

	.docker-inner {
		height: 100%;
		width: 100%;
		overflow: hidden;
		border-radius: inherit;
	}

	.docker-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.75rem;
		padding: 12px;
	}

	.docker-loading {
		font-size: 1.2rem;
		color: var(--text-muted);
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

	.btn-edit:hover {
		background: var(--accent-hover);
	}

	.docker-tile:hover .btn-delete,
	.docker-tile:hover .btn-edit {
		opacity: 1;
	}
</style>
