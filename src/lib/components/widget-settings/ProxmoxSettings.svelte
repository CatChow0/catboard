<script lang="ts">
	import { t } from '$lib/i18n';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable() }: { config: { clusterId: string; node: string; kind: 'all' | 'qemu' | 'lxc'; hideStopped: boolean; showNodes: boolean } } = $props();
	const clusters = $derived($integrations.proxmox?.clusters ?? []);

	// Node names come from the cluster itself.
	let nodes = $state<string[]>([]);
	$effect(() => {
		const id = config.clusterId;
		nodes = [];
		if (!id) return;
		fetch(`/api/integrations/proxmox/resources?cluster=${encodeURIComponent(id)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (d && config.clusterId === id) nodes = d.nodes.map((n: { node: string }) => n.node);
			})
			.catch(() => {});
	});
</script>

<label class="field">
	<span>{$t('ws.cluster')}</span>
	{#if clusters.length}
		<select bind:value={config.clusterId}>
			<option value="">{$t('ws.selectACluster')}</option>
			{#each clusters as c (c.id)}<option value={c.id}>{c.name || c.url}</option>{/each}
		</select>
	{:else}
		<span class="hint">{$t('ws.noProxmoxConnectionYetAddOne')}</span>
	{/if}
</label>
<label class="field">
	<span>{$t('ws.node')}</span>
	<select bind:value={config.node}>
		<option value="">{$t('ws.everyNode')}</option>
		{#each nodes as n (n)}<option value={n}>{n}</option>{/each}
		{#if config.node && !nodes.includes(config.node)}<option value={config.node}>{config.node}</option>{/if}
	</select>
</label>
<div class="field">
	<span>{$t('ws.guests')}</span>
	<div class="seg">
		<button type="button" class:active={config.kind === 'all'} onclick={() => (config.kind = 'all')}>{$t('ws.all')}</button>
		<button type="button" class:active={config.kind === 'qemu'} onclick={() => (config.kind = 'qemu')}>{$t('ws.vms')}</button>
		<button type="button" class:active={config.kind === 'lxc'} onclick={() => (config.kind = 'lxc')}>{$t('ws.containers')}</button>
	</div>
</div>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showNodes} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showNodeCpuAndRam')}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.hideStopped} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.hideStoppedGuests')}</span>
</label>
<p class="hint">{$t('ws.refreshedEvery15SecondsAdminsGet')}</p>
