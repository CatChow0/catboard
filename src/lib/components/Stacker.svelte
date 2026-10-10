<script lang="ts">
	import type { StackerConfig, StackerSample, StackerSections, StackerServer, StackerStatic } from '$lib/types';
	import { isEditing, updateDashboardItem, getIntegrations } from '$lib/stores/dashboard';
	import StackerGraph from './stacker/StackerGraph.svelte';
	import { bits, bytes, bytesRate, ghz, niceMax, pct, split, swap, temp } from './stacker/format';

	let { config, colSpan = 4, rowSpan = 4, ondelete, itemid }: {
		config?: StackerConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const POLL_MS = 2000;
	const HISTORY = 60; // samples kept for the graphs
	const ALL: StackerSections = { cpu: true, memory: true, gpu: true, disk: true, network: true };

	const sections = $derived({ ...ALL, ...config?.sections });
	const graphs = $derived(config?.graphs ?? true);
	const totals = $derived(config?.totals ?? true);

	let servers = $state<StackerServer[]>([]);
	const serverName = $derived(servers.find((s) => s.id === config?.serverId)?.name ?? '');

	// --- Data: poll CatBoard's proxy, which forwards to Stacker's /api/snapshot ---
	let stat = $state<StackerStatic | null>(null);
	let history = $state<StackerSample[]>([]);
	let interval = $state(1000);
	let error = $state('');
	const s = $derived(history.length ? history[history.length - 1] : null);

	// Density follows the room each section really gets (the tile is measured,
	// since a grid cell's pixel size depends on the screen):
	//   line  — one line per section (readout + meter)
	//   basic — readouts, meters and tables, no graphs
	//   full  — everything, graphs included
	let innerW = $state(0);
	let innerH = $state(0);
	const sectionCount = $derived(
		(sections.cpu ? 1 : 0) + (sections.memory ? 1 : 0) + (sections.gpu ? (stat?.gpus?.length ?? 0) : 0) + (sections.disk ? 1 : 0) + (sections.network ? 1 : 0)
	);
	const density = $derived.by(() => {
		if (!innerW || !innerH) return rowSpan === 1 ? 'line' : 'full';
		const n = Math.max(1, sectionCount);
		const cols = Math.min(n, Math.max(1, Math.floor((innerW - 24 + 14) / (230 + 14))));
		const rows = Math.ceil(n / cols);
		const gridH = innerH - 20 - 30; // padding, header row
		const perSection = (gridH - (rows - 1) * 10) / rows;
		return perSection < 50 ? 'line' : perSection < 140 ? 'basic' : 'full';
	});
	const compact = $derived(density === 'line');
	const showGraphs = $derived(graphs && density === 'full');

	$effect(() => {
		getIntegrations()
			.then((i) => (servers = i.stacker?.servers ?? []))
			.catch(() => {});
	});

	$effect(() => {
		const serverId = config?.serverId;
		stat = null;
		history = [];
		error = '';
		if (!serverId) return;

		let stopped = false;
		let busy = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let lastT = 0;
		let needStatic = true;

		async function tick() {
			clearTimeout(timer);
			if (stopped || busy) return;
			if (!document.hidden) {
				busy = true;
				try {
					const q = new URLSearchParams({ serverId: serverId! });
					if (lastT) q.set('since', String(lastT));
					if (needStatic) q.set('static', '1');
					const res = await fetch(`/api/integrations/stacker/snapshot?${q}`);
					const body = await res.json();
					if (stopped) return;
					if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
					if (body.static) {
						stat = body.static;
						needStatic = false;
					}
					interval = body.interval || 1000;
					if (body.samples?.length) {
						history = [...history, ...body.samples].slice(-HISTORY);
						lastT = body.samples[body.samples.length - 1].t;
					}
					error = '';
				} catch (e) {
					if (!stopped) error = e instanceof Error ? e.message : String(e);
				} finally {
					busy = false;
				}
			}
			if (!stopped) timer = setTimeout(tick, POLL_MS);
		}

		// Polling pauses while the tab is hidden and catches up when it returns.
		const onVisible = () => !document.hidden && tick();
		document.addEventListener('visibilitychange', onVisible);
		tick();
		return () => {
			stopped = true;
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	// --- Graph series (the history spans ~60 s) ---
	const WINDOW = $derived(HISTORY * interval);
	const ts = $derived(history.map((x) => x.t));
	const col = <T,>(f: (x: StackerSample) => T) => history.map(f);
	const sum = (xs: (number | null)[]) => (xs.some((v) => v != null) ? xs.reduce<number>((a, v) => a + (v ?? 0), 0) : null);

	const cpuClockMax = $derived(stat?.cpu.maxMHz || niceMax(Math.max(0, ...history.map((x) => x.cpu.freqMHz)), 1000));
	const hasTemp = $derived(history.some((x) => x.cpu.tempC != null));
	const diskR = $derived(col((x) => sum((x.disks ?? []).map((d) => d.readBps))));
	const diskW = $derived(col((x) => sum((x.disks ?? []).map((d) => d.writeBps))));
	const diskMax = $derived(niceMax(Math.max(0, ...diskR.map((v) => v ?? 0), ...diskW.map((v) => v ?? 0)), 1 << 20));
	const netR = $derived(col((x) => sum((x.nics ?? []).map((n) => n.rxBps))));
	const netT = $derived(col((x) => sum((x.nics ?? []).map((n) => n.txBps))));
	const netMax = $derived(niceMax(Math.max(0, ...netR.map((v) => v ?? 0), ...netT.map((v) => v ?? 0)), 125_000));
	const gpus = $derived(stat?.gpus ?? []);

	const segs = (value: number | null | undefined, max: number, n: number) => {
		const lit = value == null ? 0 : Math.round(Math.min(value / max, 1) * n);
		return Array.from({ length: n }, (_, i) => i < lit);
	};

	// --- Edit modal ---
	let showEditModal = $state(false);
	let closing = $state(false);
	let editServerId = $state('');
	let editSections = $state<StackerSections>({ ...ALL });
	let editGraphs = $state(true);
	let editTotals = $state(true);

	function openEditModal() {
		editServerId = config?.serverId ?? servers[0]?.id ?? '';
		editSections = { ...ALL, ...config?.sections };
		editGraphs = config?.graphs ?? true;
		editTotals = config?.totals ?? true;
		closing = false;
		showEditModal = true;
	}

	function closeModal() {
		closing = true;
		setTimeout(() => {
			showEditModal = false;
			closing = false;
		}, 180);
	}

	async function handleSaveEdit() {
		showEditModal = false;
		closing = false;
		const next: StackerConfig = { serverId: editServerId, sections: { ...editSections }, graphs: editGraphs, totals: editTotals };
		await updateDashboardItem(itemid, { config: next } as any);
	}

	const sectionLabels: [keyof StackerSections, string][] = [
		['cpu', 'CPU'],
		['memory', 'Memory'],
		['gpu', 'GPU'],
		['disk', 'Disk'],
		['network', 'Network']
	];
</script>

<div class="stacker" class:compact class:basic={density === 'basic'} class:stale={!!error && !!s} title={compact ? `${stat?.sys.hostname ?? serverName}${error ? ` (offline: ${error})` : ''}` : undefined}>
	<div class="st-inner" bind:clientWidth={innerW} bind:clientHeight={innerH}>
	<header class="st-head">
		<span class="st-host">{stat?.sys.hostname ?? (serverName || 'Stacker')}</span>
		{#if error}
			<span class="st-status st-bad" title={error}>offline</span>
		{:else if s}
			<span class="st-status st-ok">live</span>
		{/if}
	</header>

	{#if !config?.serverId}
		<p class="st-msg">No Stacker server selected. Edit this widget to pick one.</p>
	{:else if error && !s}
		<p class="st-msg st-error">{error}</p>
	{:else if !s || !stat}
		<p class="st-msg">Connecting to {serverName || 'Stacker'}…</p>
	{:else}
		<div class="st-grid">
			{#if sections.cpu}
				<section class="st-sec">
					<div class="st-row">
						<span class="st-label">CPU</span>
						<span class="st-readout" style="--c: var(--st-cpu)">{(s.cpu.total ?? 0).toFixed(0)}<small>%</small></span>
						{#if !compact}
							<span class="st-side">
								<span>{ghz(s.cpu.freqMHz)}</span>
								{#if s.cpu.tempC != null}<span>{temp(s.cpu.tempC)}</span>{/if}
								<span>load {s.cpu.load1.toFixed(2)}</span>
							</span>
						{/if}
					</div>
					<div class="st-meter" style="--c: var(--st-cpu)">
						{#each segs(s.cpu.total, 100, 30) as on}<span class:on></span>{/each}
					</div>
					{#if showGraphs}
						<StackerGraph
							t={ts}
							windowMs={WINDOW}
							{interval}
							label="CPU usage, clock and temperature"
							series={[
								{ values: col((x) => x.cpu.total), color: '--st-cpu', fill: true, max: 100 },
								{ values: col((x) => x.cpu.freqMHz || null), color: '--st-freq', thin: true, max: cpuClockMax },
								...(hasTemp ? [{ values: col((x) => x.cpu.tempC), color: '--st-temp', dashed: true, max: 100 }] : [])
							]}
						/>
						<ul class="st-legend">
							<li style="--c: var(--st-cpu)">usage</li>
							<li style="--c: var(--st-freq)">clock 0–{(cpuClockMax / 1000).toFixed(1)} GHz</li>
							{#if hasTemp}<li class="dashed" style="--c: var(--st-temp)">temp 0–100 °C</li>{/if}
						</ul>
					{/if}
				</section>
			{/if}

			{#if sections.memory}
				{@const used = split(bytes(s.mem.used))}
				<section class="st-sec">
					<div class="st-row">
						<span class="st-label">Memory</span>
						<span class="st-readout" style="--c: var(--st-mem)">{used[0]}<small>{used[1]}</small></span>
						{#if !compact}
							<span class="st-side">
								<span>{pct(s.mem.percent)} of {bytes(s.mem.total)}</span>
								<span>{bytes(s.mem.available)} free</span>
								<span>{swap(s.mem.swapUsed, s.mem.swapTotal)}</span>
							</span>
						{/if}
					</div>
					<div class="st-meter" style="--c: var(--st-mem)">
						{#each segs(s.mem.percent, 100, 30) as on}<span class:on></span>{/each}
					</div>
					{#if showGraphs}
						<StackerGraph t={ts} windowMs={WINDOW} {interval} label="Memory use" series={[{ values: col((x) => x.mem.percent), color: '--st-mem', fill: true, max: 100 }]} />
					{/if}
				</section>
			{/if}

			{#if sections.gpu}
				{#each gpus as g (g.index)}
					{@const gs = s.gpus?.find((x) => x.index === g.index)}
					<section class="st-sec">
						<div class="st-row">
							<span class="st-label" title={g.name}>GPU {gpus.length > 1 ? g.index : ''}</span>
							<span class="st-readout" style="--c: var(--st-gpu)">{(gs?.util ?? 0).toFixed(0)}<small>%</small></span>
							{#if !compact}
								<span class="st-side">
									<span>{bytes(gs?.memUsed)} / {bytes(g.memTotal)}</span>
									<span>{temp(gs?.tempC)}</span>
									<span>{gs?.powerW != null ? `${gs.powerW.toFixed(0)} W` : '–'}</span>
								</span>
							{/if}
						</div>
						<div class="st-meter" style="--c: var(--st-gpu)">
							{#each segs(gs?.util, 100, 30) as on}<span class:on></span>{/each}
						</div>
						{#if showGraphs}
							<StackerGraph
								t={ts}
								windowMs={WINDOW}
								{interval}
								label="GPU utilization and memory"
								series={[
									{ values: col((x) => x.gpus?.find((y) => y.index === g.index)?.util ?? null), color: '--st-gpu', fill: true, max: 100 },
									{ values: col((x) => x.gpus?.find((y) => y.index === g.index)?.memUsed ?? null), color: '--st-gpu', dashed: true, max: g.memTotal }
								]}
							/>
						{/if}
					</section>
				{/each}
			{/if}

			{#if sections.disk}
				<section class="st-sec">
					{#if compact}
						<div class="st-row">
							<span class="st-label">Disk</span>
							<span class="st-inline">R {bytesRate(diskR[diskR.length - 1])} · W {bytesRate(diskW[diskW.length - 1])}</span>
						</div>
					{:else}
						<table class="st-table">
							<thead>
								<tr><th>Disk</th><th class="num">Read</th><th class="num">Write</th><th class="num">Active</th></tr>
							</thead>
							<tbody>
								{#each s.disks ?? [] as d (d.name)}
									<tr>
										<td>{d.name}</td>
										<td class="num">{bytesRate(d.readBps)}{#if totals}<small>{bytes(d.readTot)}</small>{/if}</td>
										<td class="num">{bytesRate(d.writeBps)}{#if totals}<small>{bytes(d.writeTot)}</small>{/if}</td>
										<td class="num">{pct(d.busy)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
						{#if showGraphs}
							<StackerGraph
								t={ts}
								windowMs={WINDOW}
								{interval}
								max={diskMax}
								label="Disk read (solid) and write (dashed)"
								series={[
									{ values: diskR, color: '--st-disk', fill: true },
									{ values: diskW, color: '--st-disk', dashed: true }
								]}
							/>
							<p class="st-note">read solid, write dashed, scale {bytesRate(diskMax)}</p>
						{/if}
					{/if}
				</section>
			{/if}

			{#if sections.network}
				<section class="st-sec">
					{#if compact}
						<div class="st-row">
							<span class="st-label">Network</span>
							<span class="st-inline">↓ {bits(netR[netR.length - 1])} ↑ {bits(netT[netT.length - 1])}</span>
						</div>
					{:else}
						<table class="st-table">
							<thead>
								<tr><th>Adapter</th><th class="num">Receive</th><th class="num">Send</th></tr>
							</thead>
							<tbody>
								{#each s.nics ?? [] as n (n.name)}
									<tr>
										<td>{n.name}</td>
										<td class="num">{bits(n.rxBps)}{#if totals}<small>{bytes(n.rxTotal)}</small>{/if}</td>
										<td class="num">{bits(n.txBps)}{#if totals}<small>{bytes(n.txTotal)}</small>{/if}</td>
									</tr>
								{/each}
							</tbody>
						</table>
						{#if showGraphs}
							<StackerGraph
								t={ts}
								windowMs={WINDOW}
								{interval}
								max={netMax}
								label="Network receive (solid) and send (dashed)"
								series={[
									{ values: netR, color: '--st-net', fill: true },
									{ values: netT, color: '--st-net', dashed: true }
								]}
							/>
							<p class="st-note">receive solid, send dashed, scale {bits(netMax)}</p>
						{/if}
					{/if}
				</section>
			{/if}
		</div>
		{#if totals && !compact && (sections.disk || sections.network)}
			<p class="st-foot">Second line under rates: total since boot</p>
		{/if}
	{/if}
	</div>

	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove Stacker widget">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); openEditModal(); }} onpointerdown={(e) => e.stopPropagation()} title="Edit Stacker widget">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
</div>

{#if showEditModal}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="modal-overlay" class:closing role="dialog" aria-modal="true" tabindex="-1" onclick={closeModal} onpointerdown={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && closeModal()}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Edit Stacker</h2>
				<button class="btn-close" onclick={closeModal} aria-label="Close">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<label class="field">
					<span>Server</span>
					{#if servers.length === 0}
						<p class="hint">Add a Stacker server in Add › Integrations › Connections first.</p>
					{:else}
						<select bind:value={editServerId}>
							{#each servers as srv (srv.id)}
								<option value={srv.id}>{srv.name || srv.url}</option>
							{/each}
						</select>
					{/if}
				</label>

				<p class="group-title">Show</p>
				{#each sectionLabels as [key, label] (key)}
					<label class="toggle-switch">
						<input type="checkbox" bind:checked={editSections[key]} />
						<span class="toggle-slider"></span>
						<span class="toggle-label">{label}</span>
					</label>
				{/each}

				<p class="group-title">Details</p>
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={editGraphs} />
					<span class="toggle-slider"></span>
					<span class="toggle-label">Graphs (hidden anyway on small tiles)</span>
				</label>
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={editTotals} />
					<span class="toggle-slider"></span>
					<span class="toggle-label">Disk and network totals since boot</span>
				</label>
			</div>

			<div class="modal-actions">
				<button class="btn-cancel" onclick={closeModal}>Cancel</button>
				<button class="btn-save" onclick={handleSaveEdit} disabled={!editServerId}>Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Stacker's instrument palette (Task Manager series colours), scoped to the widget. */
	.stacker {
		--st-cpu: #3fb6ff;
		--st-freq: #ffd34d;
		--st-temp: #ff6b5a;
		--st-mem: #b48cff;
		--st-disk: #48d48c;
		--st-net: #ffb547;
		--st-gpu: #2fd6c8;
		--st-glow: 1;
		--st-off: 0.13;
		--st-line: var(--border);
		--st-grid: color-mix(in srgb, var(--text-muted) 22%, transparent);
		--st-panel-2: color-mix(in srgb, var(--bg-primary) 55%, transparent);
		--st-mono: 'JetBrains Mono', 'Cascadia Mono', ui-monospace, Consolas, monospace;

		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-primary);
	}

	/* Clips content; the outer tile stays unclipped for the edit buttons. */
	.st-inner {
		height: 100%;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow: hidden;
		border-radius: inherit;
	}

	:global([data-theme='light']) .stacker,
	:global([data-theme='solarized-light']) .stacker {
		--st-cpu: #0f73c6;
		--st-freq: #a07800;
		--st-temp: #c8321f;
		--st-mem: #7d45cf;
		--st-disk: #188a50;
		--st-net: #b86d00;
		--st-gpu: #0b8a80;
		--st-glow: 0;
		--st-off: 0.14;
	}

	/* Phosphor tubes: every series takes the tube's hue; dashes keep lines apart. */
	:global([data-theme='tmog-green']) .stacker {
		--st-cpu: #45ed73;
		--st-freq: #c8ff8a;
		--st-temp: #1fa84a;
		--st-mem: #8dffaa;
		--st-disk: #2bd65b;
		--st-net: #b8ffcb;
		--st-gpu: #5cff88;
		--st-glow: 1.4;
	}

	:global([data-theme='tmog-amber']) .stacker {
		--st-cpu: #ffb336;
		--st-freq: #fff0c2;
		--st-temp: #c46a00;
		--st-mem: #ffcf66;
		--st-disk: #e89a00;
		--st-net: #ffe0a0;
		--st-gpu: #ffbe33;
		--st-glow: 1.4;
	}

	.st-head {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.st-host {
		font-weight: 600;
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.st-status {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font: 0.7rem var(--st-mono);
		color: var(--text-muted);
	}

	.st-status::before {
		content: '';
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
	}

	.st-ok::before {
		background: var(--success);
		box-shadow: 0 0 calc(6px * var(--st-glow)) var(--success);
	}

	.st-bad {
		color: var(--danger);
	}

	.st-msg {
		margin: auto;
		color: var(--text-muted);
		font-size: 0.8rem;
		text-align: center;
		padding: 0 8px;
	}

	.st-error {
		color: var(--danger);
	}

	.st-grid {
		flex: 1 1 0;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		/* Rows are at least as tall as their content and share any spare height;
		   if the content still doesn't fit, the tile scrolls rather than overlaps. */
		grid-auto-rows: minmax(min-content, 1fr);
		gap: 10px 14px;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.compact .st-grid {
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		grid-auto-rows: min-content;
		align-content: start;
		gap: 4px 14px;
	}

	.st-sec {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	/* One line per section: label, readout, then the meter fills the rest. */
	.compact .st-sec {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}

	.compact .st-sec .st-row {
		flex: none;
	}

	.compact .st-sec .st-meter {
		flex: 1;
		min-width: 40px;
	}

	.compact .st-label {
		min-width: 0;
	}

	/* Basic density keeps two of the three side lines. */
	.basic .st-side span:nth-child(n + 3) {
		display: none;
	}

	/* One-row tiles have no room for the header; the hostname moves to the tooltip. */
	.compact .st-head {
		display: none;
	}

	/* Last known values stay visible but dimmed while the server is unreachable. */
	.stale .st-grid {
		opacity: 0.45;
	}

	.st-row {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		min-width: 0;
	}

	.st-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		min-width: 46px;
		align-self: center;
	}

	.st-readout {
		font: 600 1.7rem/1 var(--st-mono);
		color: var(--c);
		text-shadow: 0 0 calc(10px * var(--st-glow)) color-mix(in srgb, var(--c) 55%, transparent);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.compact .st-readout {
		font-size: 1.05rem;
	}

	.st-readout small {
		font-size: 0.45em;
		font-weight: 400;
		margin-left: 0.25em;
		color: var(--text-muted);
		text-shadow: none;
	}

	.st-side {
		display: flex;
		flex-direction: column;
		font: 0.68rem/1.35 var(--st-mono);
		color: var(--text-muted);
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
	}

	.st-inline {
		font: 0.72rem var(--st-mono);
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		align-self: center;
	}

	/* VFD segment meter: lit cells glow, the rest stay as faint cells. */
	.st-meter {
		display: flex;
		gap: 2px;
		height: 9px;
		flex: none;
	}

	.st-meter span {
		flex: 1;
		border-radius: 1px;
		background: color-mix(in srgb, var(--c) calc(var(--st-off) * 100%), transparent);
	}

	.st-meter span.on {
		background: var(--c);
		box-shadow: 0 0 calc(4px * var(--st-glow)) color-mix(in srgb, var(--c) 70%, transparent);
	}

	.st-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.66rem;
		color: var(--text-muted);
	}

	.st-legend li::before {
		content: '';
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-right: 5px;
		border-radius: 1px;
		background: var(--c);
	}

	.st-legend li.dashed::before {
		width: 10px;
		height: 0;
		vertical-align: middle;
		background: none;
		border-top: 2px dashed var(--c);
	}

	.st-table {
		width: 100%;
		border-collapse: collapse;
		font: 0.7rem var(--st-mono);
		flex: none;
	}

	.st-table th {
		font-weight: 500;
		font-size: 0.68rem;
		color: var(--text-muted);
		text-align: left;
		padding: 0 3px 2px;
		border-bottom: 1px solid var(--border);
	}

	.st-table td {
		padding: 2px 3px;
		border-bottom: 1px dashed var(--border);
		vertical-align: top;
		white-space: nowrap;
	}

	.st-table td:first-child {
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.st-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.st-table small {
		display: block;
		font-size: 0.62rem;
		color: var(--text-muted);
	}

	.st-note,
	.st-foot {
		margin: 0;
		font-size: 0.64rem;
		color: var(--text-muted);
	}

	/* --- Edit controls and modal (CatBoard widget conventions) --- */
	.btn-delete,
	.btn-edit {
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
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.btn-delete {
		top: -8px;
		background: var(--danger);
	}

	.btn-edit {
		bottom: -8px;
		background: var(--accent);
	}

	.stacker:hover .btn-delete,
	.stacker:hover .btn-edit {
		opacity: 1;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.15s ease;
	}

	.modal-overlay.closing {
		animation: fadeOut 0.18s ease forwards;
	}

	.modal {
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		max-width: 420px;
		width: 90%;
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h2 {
		font-size: 1rem;
	}

	.btn-close {
		padding: 4px;
		border-radius: 4px;
		display: flex;
	}

	.btn-close:hover {
		background: var(--bg-card-hover);
	}

	.modal-body {
		padding: 16px 20px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.field select {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.group-title {
		margin: 4px 0 8px;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.toggle-switch {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		margin-bottom: 10px;
		position: relative;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
		position: absolute;
	}

	.toggle-slider {
		width: 36px;
		height: 20px;
		background: var(--border);
		border-radius: 20px;
		position: relative;
		transition: background var(--transition);
		flex-shrink: 0;
	}

	.toggle-slider::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		transition: transform var(--transition);
	}

	.toggle-switch input:checked + .toggle-slider {
		background: var(--accent);
	}

	.toggle-switch input:checked + .toggle-slider::after {
		transform: translateX(16px);
	}

	.toggle-switch input:focus-visible + .toggle-slider {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.toggle-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
	}

	.btn-cancel {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.btn-save {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-weight: 500;
	}

	.btn-save:hover {
		background: var(--accent-hover);
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes fadeOut {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
