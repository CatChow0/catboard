<script lang="ts">
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
	<span>Cluster</span>
	{#if clusters.length}
		<select bind:value={config.clusterId}>
			<option value="">Select a cluster</option>
			{#each clusters as c (c.id)}<option value={c.id}>{c.name || c.url}</option>{/each}
		</select>
	{:else}
		<span class="hint">No Proxmox connection yet: add one in Settings &gt; Integrations &gt; Proxmox VE.</span>
	{/if}
</label>
<label class="field">
	<span>Node</span>
	<select bind:value={config.node}>
		<option value="">Every node</option>
		{#each nodes as n (n)}<option value={n}>{n}</option>{/each}
		{#if config.node && !nodes.includes(config.node)}<option value={config.node}>{config.node}</option>{/if}
	</select>
</label>
<div class="field">
	<span>Guests</span>
	<div class="seg">
		<button type="button" class:active={config.kind === 'all'} onclick={() => (config.kind = 'all')}>All</button>
		<button type="button" class:active={config.kind === 'qemu'} onclick={() => (config.kind = 'qemu')}>VMs</button>
		<button type="button" class:active={config.kind === 'lxc'} onclick={() => (config.kind = 'lxc')}>Containers</button>
	</div>
</div>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showNodes} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show node CPU and RAM</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.hideStopped} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Hide stopped guests</span>
</label>
<p class="hint">Refreshed every 15 seconds. Admins get start, shut down and reboot buttons.</p>
