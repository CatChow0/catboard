// Service icons kept in the browser: memory + IndexedDB, filled with grouped
// fetch() requests (POST /api/icons/batch). Tiles then show their icon
// instantly on reload and dashboard switch, even when the browser would queue
// <img> requests (HTTP/1.1 with long-lived streams) or skip its HTTP cache.
import { writable, get } from 'svelte/store';
import { iconSrc } from '$lib/utils/icons';

type ServiceIcon = { icon?: string; name?: string; url?: string };
/** Object URL of the icon, or null when the server has none. */
type Entry = { src: string; at: number } | null;

const DB_NAME = 'catboard-icons';
const STORE = 'icons';
const REFRESH_AFTER_MS = 7 * 24 * 3600_000;
const BATCH_DELAY_MS = 15;
const BATCH_SIZE = 80;

export const serviceIcons = writable<Map<string, Entry>>(new Map());

let db: IDBDatabase | null = null;
let ready: Promise<void> | null = null;
const inflight = new Set<string>();
const pending = new Map<string, Required<ServiceIcon>>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** Same inputs as the icon URL: changes whenever the service's icon settings change. */
export function iconKey(s: ServiceIcon): string {
	return iconSrc(s).slice('/api/icon?'.length);
}

function openDb(): Promise<IDBDatabase | null> {
	return new Promise((resolve) => {
		try {
			const req = indexedDB.open(DB_NAME, 1);
			req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(null);
			req.onblocked = () => resolve(null);
		} catch {
			resolve(null); // private mode, storage disabled...
		}
	});
}

function readAll(d: IDBDatabase): Promise<{ key: string; blob: Blob; at: number }[]> {
	return new Promise((resolve) => {
		try {
			const req = d.transaction(STORE, 'readonly').objectStore(STORE).getAll();
			req.onsuccess = () => resolve(req.result ?? []);
			req.onerror = () => resolve([]);
		} catch {
			resolve([]);
		}
	});
}

function save(rows: { key: string; blob: Blob; at: number }[]) {
	if (!db || !rows.length) return;
	try {
		const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
		for (const r of rows) store.put(r);
	} catch {
		// quota or closed database: memory still works
	}
}

/** Load the icons stored by this browser (call before the dashboard renders). */
export function initIconCache(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	if (ready) return ready;
	ready = (async () => {
		db = await openDb();
		if (!db) return;
		const rows = await readAll(db);
		if (!rows.length) return;
		const map = new Map(get(serviceIcons));
		for (const r of rows) if (!map.has(r.key)) map.set(r.key, { src: URL.createObjectURL(r.blob), at: r.at });
		serviceIcons.set(map);
	})();
	return ready;
}

/** Make sure a service's icon is (or will be) in the cache; refreshed after a week. */
export function requestIcon(s: ServiceIcon) {
	const key = iconKey(s);
	const cur = get(serviceIcons).get(key);
	if (cur === null || inflight.has(key) || pending.has(key)) return;
	if (cur && Date.now() - cur.at < REFRESH_AFTER_MS) return;
	pending.set(key, { icon: s.icon ?? '', name: s.name ?? '', url: s.url ?? '' });
	clearTimeout(timer);
	// Tiles mount together: collect them into one request.
	timer = setTimeout(flush, BATCH_DELAY_MS);
}

function toBlob(b64: string, type: string): Blob {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new Blob([bytes], { type });
}

async function flush() {
	const all = [...pending];
	pending.clear();
	for (let i = 0; i < all.length; i += BATCH_SIZE) {
		const chunk = all.slice(i, i + BATCH_SIZE);
		chunk.forEach(([k]) => inflight.add(k));
		try {
			const res = await fetch('/api/icons/batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items: chunk.map(([key, v]) => ({ key, ...v })) })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const { icons } = (await res.json()) as { icons: Record<string, { type: string; data: string } | null> };
			const map = new Map(get(serviceIcons));
			const rows: { key: string; blob: Blob; at: number }[] = [];
			const now = Date.now();
			for (const [key] of chunk) {
				const got = icons[key];
				const old = map.get(key);
				if (got) {
					const blob = toBlob(got.data, got.type);
					if (old) URL.revokeObjectURL(old.src);
					map.set(key, { src: URL.createObjectURL(blob), at: now });
					rows.push({ key, blob, at: now });
				} else if (!old) {
					// No icon: remembered for this session (the server retries daily).
					map.set(key, null);
				}
			}
			serviceIcons.set(map);
			save(rows);
		} catch {
			// Network hiccup: the next mount asks again.
		} finally {
			chunk.forEach(([k]) => inflight.delete(k));
		}
	}
}

/** Forget this browser's copies (after clearing the server cache). */
export async function clearBrowserIconCache() {
	for (const e of get(serviceIcons).values()) if (e) URL.revokeObjectURL(e.src);
	serviceIcons.set(new Map());
	try {
		db?.transaction(STORE, 'readwrite').objectStore(STORE).clear();
	} catch {
		// nothing stored
	}
}
