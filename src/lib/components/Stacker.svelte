<script lang="ts">
	import { t, errorText } from '$lib/i18n';
	import type { StackerConfig, StackerSample, StackerSections, StackerServer, StackerStatic } from '$lib/types';
	import { isEditing, getIntegrations } from '$lib/stores/dashboard';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
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
					if (!res.ok) throw new Error(errorText(body, res.status));
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

	let showEditModal = $state(false);
</script>

<div class="stacker" class:compact class:basic={density === 'basic'} class:stale={!!error && !!s} title={compact ? (error ? $t('stacker.offlineTitle', { host: stat?.sys.hostname ?? serverName, error }) : (stat?.sys.hostname ?? serverName)) : undefined}>
	<div class="st-inner" bind:clientWidth={innerW} bind:clientHeight={innerH}>
	<header class="st-head">
		<span class="st-host">{stat?.sys.hostname ?? (serverName || 'Stacker')}</span>
		{#if error}
			<span class="st-status st-bad" title={error}>{$t('stacker.offline')}</span>
		{:else if s}
			<span class="st-status st-ok">{$t('stacker.live')}</span>
		{/if}
	</header>

	{#if !config?.serverId}
		<p class="st-msg">{$t('stacker.noServer')}</p>
	{:else if error && !s}
		<p class="st-msg st-error">{error}</p>
	{:else if !s || !stat}
		<p class="st-msg">{$t('stacker.connecting', { name: serverName || 'Stacker' })}</p>
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
								<span>{$t('stacker.load', { value: s.cpu.load1.toFixed(2) })}</span>
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
							label={$t('stacker.cpuGraph')}
							series={[
								{ values: col((x) => x.cpu.total), color: '--st-cpu', fill: true, max: 100 },
								{ values: col((x) => x.cpu.freqMHz || null), color: '--st-freq', thin: true, max: cpuClockMax },
								...(hasTemp ? [{ values: col((x) => x.cpu.tempC), color: '--st-temp', dashed: true, max: 100 }] : [])
							]}
						/>
						<ul class="st-legend">
							<li style="--c: var(--st-cpu)">{$t('stacker.usage')}</li>
							<li style="--c: var(--st-freq)">{$t('stacker.clock', { max: (cpuClockMax / 1000).toFixed(1) })}</li>
							{#if hasTemp}<li class="dashed" style="--c: var(--st-temp)">{$t('stacker.temp')}</li>{/if}
						</ul>
					{/if}
				</section>
			{/if}

			{#if sections.memory}
				{@const used = split(bytes(s.mem.used))}
				<section class="st-sec">
					<div class="st-row">
						<span class="st-label">{$t('stacker.memory')}</span>
						<span class="st-readout" style="--c: var(--st-mem)">{used[0]}<small>{used[1]}</small></span>
						{#if !compact}
							<span class="st-side">
								<span>{$t('stacker.of', { used: pct(s.mem.percent), total: bytes(s.mem.total) })}</span>
								<span>{$t('stacker.free', { value: bytes(s.mem.available) })}</span>
								<span>{swap(s.mem.swapUsed, s.mem.swapTotal)}</span>
							</span>
						{/if}
					</div>
					<div class="st-meter" style="--c: var(--st-mem)">
						{#each segs(s.mem.percent, 100, 30) as on}<span class:on></span>{/each}
					</div>
					{#if showGraphs}
						<StackerGraph t={ts} windowMs={WINDOW} {interval} label={$t('stacker.memGraph')} series={[{ values: col((x) => x.mem.percent), color: '--st-mem', fill: true, max: 100 }]} />
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
								label={$t('stacker.gpuGraph')}
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
							<span class="st-label">{$t('stacker.disk')}</span>
							<span class="st-inline">R {bytesRate(diskR[diskR.length - 1])} · W {bytesRate(diskW[diskW.length - 1])}</span>
						</div>
					{:else}
						<table class="st-table">
							<thead>
								<tr><th>{$t('stacker.disk')}</th><th class="num">{$t('stacker.read')}</th><th class="num">{$t('stacker.write')}</th><th class="num">{$t('stacker.active')}</th></tr>
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
								label={$t('stacker.diskGraph')}
								series={[
									{ values: diskR, color: '--st-disk', fill: true },
									{ values: diskW, color: '--st-disk', dashed: true }
								]}
							/>
							<p class="st-note">{$t('stacker.diskNote', { scale: bytesRate(diskMax) })}</p>
						{/if}
					{/if}
				</section>
			{/if}

			{#if sections.network}
				<section class="st-sec">
					{#if compact}
						<div class="st-row">
							<span class="st-label">{$t('stacker.network')}</span>
							<span class="st-inline">↓ {bits(netR[netR.length - 1])} ↑ {bits(netT[netT.length - 1])}</span>
						</div>
					{:else}
						<table class="st-table">
							<thead>
								<tr><th>{$t('stacker.adapter')}</th><th class="num">{$t('stacker.receive')}</th><th class="num">{$t('stacker.send')}</th></tr>
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
								label={$t('stacker.netGraph')}
								series={[
									{ values: netR, color: '--st-net', fill: true },
									{ values: netT, color: '--st-net', dashed: true }
								]}
							/>
							<p class="st-note">{$t('stacker.netNote', { scale: bits(netMax) })}</p>
						{/if}
					{/if}
				</section>
			{/if}
		</div>
		{#if totals && !compact && (sections.disk || sections.network)}
			<p class="st-foot">{$t('stacker.foot')}</p>
		{/if}
	{/if}
	</div>

	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title={$t('widget.removeNamed', { name: 'Stacker' })}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); showEditModal = true; }} onpointerdown={(e) => e.stopPropagation()} title={$t('widget.editNamed', { name: 'Stacker' })}>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
</div>

{#if showEditModal}
	<WidgetEditModal type="stacker" {itemid} {config} onclose={() => (showEditModal = false)} />
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

	/* --- Edit controls (CatBoard widget conventions) --- */
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
</style>
