// Number formatting for the Stacker widget (ported from Stacker's web/src/format.ts).

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/** Binary-scaled bytes, labelled the way Task Manager does (1 GB = 1024³ B). */
export function bytes(n: number | null | undefined, digits = 1): string {
	if (n == null || !isFinite(n)) return '–';
	let i = 0;
	while (Math.abs(n) >= 1024 && i < UNITS.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(i === 0 ? 0 : digits)} ${UNITS[i]}`;
}

export const bytesRate = (n: number | null | undefined) => (n == null ? '–' : `${bytes(n)}/s`);

/** Network rates in bits per second, decimal-scaled like link speeds. */
export function bits(bytesPerSec: number | null | undefined): string {
	if (bytesPerSec == null) return '–';
	let v = bytesPerSec * 8;
	const u = ['bps', 'Kbps', 'Mbps', 'Gbps'];
	let i = 0;
	while (v >= 1000 && i < u.length - 1) {
		v /= 1000;
		i++;
	}
	return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export const pct = (n: number | null | undefined, digits = 0) => (n == null ? '–' : `${n.toFixed(digits)}%`);

export const ghz = (mhz: number) => (mhz > 0 ? `${(mhz / 1000).toFixed(2)} GHz` : '–');

export const temp = (c: number | null | undefined) => (c == null ? '–' : `${Math.round(c)} °C`);

/** "swap 1.2 GB / 8.0 GB", or "no swap" when none is configured. */
export const swap = (used: number, total: number) => (total > 0 ? `swap ${bytes(used)} / ${bytes(total)}` : 'no swap');

/** A "nice" ceiling for auto-scaled graphs, e.g. 7.3 MB/s -> 10 MB/s. */
export function niceMax(v: number, floor: number): number {
	const m = Math.max(v, floor);
	const p = 10 ** Math.floor(Math.log10(m));
	for (const k of [1, 2, 5, 10]) if (k * p >= m) return k * p;
	return 10 * p;
}

/** Splits "3.4 GB" into a readout value and unit. */
export function split(s: string): [string, string] {
	const i = s.indexOf(' ');
	return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}
