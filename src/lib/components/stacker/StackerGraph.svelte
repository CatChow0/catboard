<script lang="ts" module>
	export interface GraphSeries {
		values: (number | null)[];
		/** CSS custom property holding the colour, e.g. "--st-cpu". */
		color: string;
		fill?: boolean;
		dashed?: boolean;
		thin?: boolean;
		/** Top of this series' scale; defaults to the graph's max. */
		max?: number;
	}
</script>

<script lang="ts">
	// Canvas history graph (ported from Stacker's Graph.tsx). Time runs right to
	// left from the newest sample; a missing value or a hole in the timestamps
	// longer than 2.5 intervals breaks the line instead of being interpolated.
	let { t, series, max = 100, windowMs, interval, grid = true, label = '' }: {
		t: number[];
		series: GraphSeries[];
		max?: number;
		windowMs: number;
		interval: number;
		grid?: boolean;
		label?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let w = $state(0);
	let h = $state(0);

	$effect(() => {
		const ro = new ResizeObserver(([e]) => {
			w = e.contentRect.width;
			h = e.contentRect.height;
		});
		ro.observe(canvas);
		return () => ro.disconnect();
	});

	$effect(() => draw(t, series, max, w, h));

	function draw(t: number[], series: GraphSeries[], max: number, w: number, h: number) {
		if (!canvas || !w || !h) return;
		const dpr = window.devicePixelRatio || 1;
		if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
		}
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		const css = getComputedStyle(canvas);

		if (grid) {
			ctx.strokeStyle = css.getPropertyValue('--st-grid');
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let i = 1; i < 10; i++) {
				const x = Math.round((w * i) / 10) + 0.5;
				const y = Math.round((h * i) / 10) + 0.5;
				ctx.moveTo(x, 0);
				ctx.lineTo(x, h);
				ctx.moveTo(0, y);
				ctx.lineTo(w, y);
			}
			ctx.stroke();
		}
		if (!t.length) return;

		const end = t[t.length - 1];
		const x = (ti: number) => w - ((end - ti) / windowMs) * w;
		const gap = interval * 2.5;

		for (const s of series) {
			const top = s.max ?? max;
			if (!(top > 0)) continue;
			const y = (v: number) => h - Math.min(Math.max(v, 0) / top, 1) * (h - 1) - 0.5;
			const color = css.getPropertyValue(s.color).trim() || '#888';
			const runs: [number, number][][] = [];
			let run: [number, number][] = [];
			for (let i = 0; i < t.length; i++) {
				const v = s.values[i];
				const broken = v == null || (i > 0 && t[i] - t[i - 1] > gap);
				if (broken && run.length) {
					runs.push(run);
					run = [];
				}
				if (v != null && end - t[i] <= windowMs + interval) run.push([x(t[i]), y(v)]);
			}
			if (run.length) runs.push(run);

			for (const r of runs) {
				if (s.fill && r.length > 1) {
					ctx.beginPath();
					ctx.moveTo(r[0][0], h);
					r.forEach(([px, py]) => ctx.lineTo(px, py));
					ctx.lineTo(r[r.length - 1][0], h);
					ctx.closePath();
					ctx.globalAlpha = 0.16;
					ctx.fillStyle = color;
					ctx.fill();
					ctx.globalAlpha = 1;
				}
				ctx.beginPath();
				ctx.setLineDash(s.dashed ? [4, 3] : []);
				r.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
				if (r.length === 1) ctx.lineTo(r[0][0] + 1, r[0][1]);
				ctx.strokeStyle = color;
				ctx.lineWidth = s.thin ? 1.2 : 1.5;
				ctx.stroke();
				ctx.setLineDash([]);
			}
		}
	}
</script>

<div class="graph-box" role="img" aria-label={label}><canvas bind:this={canvas}></canvas></div>

<style>
	/* Absolutely positioned so the canvas pixel size never feeds back into layout. */
	.graph-box {
		position: relative;
		flex: 1 1 0;
		min-height: var(--graph-min, 56px);
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 1px solid var(--st-line);
		background: var(--st-panel-2);
		border-radius: 3px;
	}
</style>
