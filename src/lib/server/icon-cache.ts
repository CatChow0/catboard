// Service icons: resolved once on the server, cached on disk, served from the
// LAN. Resolution order for a service:
//   1. the icon picked by the user:
//        "selfhst:<name>" / "homarr:<name>"  a library icon
//        "<name>"                            (legacy) selfh.st, then homarr
//        "url:<https://...>"                 a custom image URL (downloaded once)
//        "custom:<file>"                     an uploaded file (already on disk)
//   2. nothing picked: the service name looked up in the selfh.st then homarr
//      catalogs ("Orca Slicer" -> orca-slicer / orcaslicer)
//   3. the service's own favicon (SVG / apple-touch-icon / largest size first,
//      manifest icons included)
// Misses are remembered for a day so a missing icon never costs a timeout on
// every page load; concurrent requests for the same icon share one download.
import { readFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { writeFileAtomic, writeJsonAtomic } from './fs-safe';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const CONFIG_DIR = process.env.CONFIG_DIR || join(process.cwd(), 'config');
const CACHE_DIR = join(CONFIG_DIR, 'icons');
const INDEX_FILE = join(CACHE_DIR, 'index.json');
const MISS_TTL_MS = 24 * 3600_000;
const CATALOG_TTL_MS = 24 * 3600_000;
const FETCH_TIMEOUT_MS = 6000;
const MAX_ICON_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 1024 * 1024;

const CDN = {
	selfhst: 'https://cdn.jsdelivr.net/gh/selfhst/icons',
	homarr: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons'
} as const;
export type IconLibrary = keyof typeof CDN;
const LIBRARIES: IconLibrary[] = ['selfhst', 'homarr'];

interface CacheEntry {
	filename: string;
	contentType: string;
	createdAt: number;
	/** Where it came from (shown in the picker preview). */
	source?: string;
}

interface MissEntry {
	missUntil: number;
}

type IndexValue = CacheEntry | MissEntry;
const isHit = (v: IndexValue | undefined): v is CacheEntry => !!v && 'filename' in v;

// --- Index (in memory, saved in the background) ------------------------------

let index: Record<string, IndexValue> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function ensureDir() {
	if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
}

async function loadIndex(): Promise<Record<string, IndexValue>> {
	if (index) return index;
	try {
		index = JSON.parse(await readFile(INDEX_FILE, 'utf-8'));
	} catch {
		index = {};
	}
	return index!;
}

function saveIndexSoon() {
	clearTimeout(saveTimer);
	saveTimer = setTimeout(async () => {
		try {
			await ensureDir();
			await writeJsonAtomic(INDEX_FILE, index ?? {}, 1);
		} catch {
			// next save will retry
		}
	}, 300);
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').substring(0, 16);

function extFor(contentType: string): string {
	if (contentType.includes('svg')) return 'svg';
	if (contentType.includes('png')) return 'png';
	if (contentType.includes('gif')) return 'gif';
	if (contentType.includes('webp')) return 'webp';
	if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
	return 'ico';
}

/** Guess the type from the bytes when the server lies or says nothing. */
export function sniffImage(buf: Buffer): string | null {
	if (buf.length < 4) return null;
	if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
	if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
	if (buf.subarray(0, 4).toString() === 'GIF8') return 'image/gif';
	if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
	if (buf[0] === 0 && buf[1] === 0 && (buf[2] === 1 || buf[2] === 2) && buf[3] === 0) return 'image/x-icon';
	const head = buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
	if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
	return null;
}

async function store(key: string, data: Buffer, contentType: string, source: string): Promise<CacheEntry> {
	await ensureDir();
	const idx = await loadIndex();
	const old = idx[key];
	const filename = `${hash(key)}.${extFor(contentType)}`;
	if (isHit(old) && old.filename !== filename && !old.filename.startsWith('custom-')) {
		try { await unlink(join(CACHE_DIR, old.filename)); } catch { /* gone */ }
	}
	await writeFileAtomic(join(CACHE_DIR, filename), data);
	const entry: CacheEntry = { filename, contentType, createdAt: Date.now(), source };
	idx[key] = entry;
	saveIndexSoon();
	return entry;
}

async function remember(key: string, compute: () => Promise<{ data: Buffer; contentType: string; source: string } | null>): Promise<CacheEntry | null> {
	const idx = await loadIndex();
	const cur = idx[key];
	if (isHit(cur) && existsSync(join(CACHE_DIR, cur.filename))) return cur;
	if (cur && !isHit(cur) && cur.missUntil > Date.now()) return null;
	const got = await compute();
	if (!got) {
		idx[key] = { missUntil: Date.now() + MISS_TTL_MS };
		saveIndexSoon();
		return null;
	}
	return store(key, got.data, got.contentType, got.source);
}

// --- Downloads ------------------------------------------------------------------

async function download(url: string, accept = 'image/*'): Promise<{ data: Buffer; contentType: string } | null> {
	try {
		const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': 'CatBoard' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'follow' });
		if (!res.ok) return null;
		const len = Number(res.headers.get('content-length') || 0);
		if (len > MAX_ICON_BYTES) return null;
		const data = Buffer.from(await res.arrayBuffer());
		if (!data.length || data.length > MAX_ICON_BYTES) return null;
		const sniffed = sniffImage(data);
		if (!sniffed) return null; // HTML error pages, login redirects...
		return { data, contentType: sniffed };
	} catch {
		return null;
	}
}

/** A library icon: SVG first, then PNG (then WebP for homarr). */
async function fromLibrary(lib: IconLibrary, name: string) {
	const safe = name.toLowerCase().replace(/[^a-z0-9._-]/g, '');
	if (!safe) return null;
	for (const f of ['svg', 'png', 'webp']) {
		const got = await download(`${CDN[lib]}/${f}/${safe}.${f}`);
		if (got) return { ...got, source: `${lib}:${safe}` };
	}
	return null;
}

// --- Catalogs (picker search and name matching) ---------------------------------

export interface CatalogIcon {
	/** Icon name in its library. */
	n: string;
	/** Library. */
	s: IconLibrary;
	/** Display name (selfh.st), e.g. "Orca Slicer". */
	p?: string;
	/** Best available format (for direct previews). */
	f?: 'svg' | 'png' | 'webp';
	/** Aliases, tags and categories (search). */
	t?: string;
}

let catalogs: Partial<Record<IconLibrary, { at: number; icons: CatalogIcon[] }>> = {};
const catalogLoads: Partial<Record<IconLibrary, Promise<CatalogIcon[]>>> = {};
/** Bump when the stored catalog format changes (old copies are re-downloaded). */
const CATALOG_VERSION = 2;

function parseCatalog(lib: IconLibrary, raw: unknown): CatalogIcon[] {
	const out: CatalogIcon[] = [];
	if (lib === 'homarr' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
		for (const [name, meta] of Object.entries(raw as Record<string, any>)) {
			const extra = [...(meta?.aliases ?? []), ...(meta?.categories ?? [])].join(' ');
			const base = meta?.base === 'png' || meta?.base === 'webp' ? meta.base : 'svg';
			out.push({ n: name, s: 'homarr', f: base, t: extra || undefined });
		}
	} else if (lib === 'selfhst' && Array.isArray(raw)) {
		for (const it of raw as Record<string, any>[]) {
			const name = it.Reference ?? it.reference ?? it.name;
			if (typeof name !== 'string') continue;
			const pretty = typeof (it.Name ?? it.name) === 'string' ? String(it.Name ?? it.name) : undefined;
			const extra = [it.Tags ?? it.tags, it.Category ?? it.category].flat().filter((x) => typeof x === 'string' && x).join(' ');
			const f = it.SVG === 'Yes' ? 'svg' : it.PNG === 'Yes' ? 'png' : it.WebP === 'Yes' ? 'webp' : 'svg';
			out.push({ n: name, s: 'selfhst', p: pretty, f, t: extra || undefined });
		}
	}
	return out;
}

async function loadCatalog(lib: IconLibrary): Promise<CatalogIcon[]> {
	const mem = catalogs[lib];
	if (mem && Date.now() - mem.at < CATALOG_TTL_MS) return mem.icons;
	if (catalogLoads[lib]) return catalogLoads[lib]!;
	const file = join(CACHE_DIR, `catalog-${lib}-v${CATALOG_VERSION}.json`);
	catalogLoads[lib] = (async () => {
		// Fresh enough on disk?
		try {
			const s = await stat(file);
			if (Date.now() - s.mtimeMs < CATALOG_TTL_MS) {
				const icons = JSON.parse(await readFile(file, 'utf-8')) as CatalogIcon[];
				catalogs[lib] = { at: s.mtimeMs, icons };
				return icons;
			}
		} catch {
			// not cached yet
		}
		const url = lib === 'homarr' ? `${CDN.homarr}/metadata.json` : `${CDN.selfhst}/index.json`;
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const icons = parseCatalog(lib, await res.json());
			if (!icons.length) throw new Error('empty catalog');
			await ensureDir();
			await writeJsonAtomic(file, icons, undefined);
			catalogs[lib] = { at: Date.now(), icons };
			return icons;
		} catch {
			// Offline: an old copy is better than nothing.
			try {
				const icons = JSON.parse(await readFile(file, 'utf-8')) as CatalogIcon[];
				catalogs[lib] = { at: Date.now() - CATALOG_TTL_MS + 3600_000, icons }; // retry in an hour
				return icons;
			} catch {
				return [];
			}
		}
	})().finally(() => delete catalogLoads[lib]);
	return catalogLoads[lib]!;
}

/** Both catalogs, selfh.st first. */
export async function iconCatalog(): Promise<CatalogIcon[]> {
	const [a, b] = await Promise.all(LIBRARIES.map(loadCatalog));
	return [...a, ...b];
}

/** "Orca Slicer" -> ["orca-slicer", "orcaslicer", "orca_slicer"]. */
export function nameCandidates(name: string): string[] {
	const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
	if (!base) return [];
	const words = base.split(' ');
	return [...new Set([words.join('-'), words.join(''), words.join('_')])];
}

async function byName(name: string) {
	const candidates = nameCandidates(name);
	if (!candidates.length) return null;
	const all = await iconCatalog();
	for (const lib of LIBRARIES) {
		const inLib = all.filter((i) => i.s === lib);
		const names = new Set(inLib.map((i) => i.n));
		const wanted = name.trim().toLowerCase();
		const hit = candidates.find((c) => names.has(c)) ?? inLib.find((i) => i.p?.toLowerCase() === wanted)?.n;
		if (hit) {
			const got = await fromLibrary(lib, hit);
			if (got) return got;
		}
	}
	// Catalogs unreachable: try the CDN directly with the obvious names.
	if (!all.length) {
		for (const lib of LIBRARIES) for (const c of candidates.slice(0, 2)) {
			const got = await fromLibrary(lib, c);
			if (got) return got;
		}
	}
	return null;
}

// --- Favicon ----------------------------------------------------------------------

interface IconCandidate {
	href: string;
	score: number;
}

function scoreLink(rel: string, type: string, sizes: string, href: string): number {
	let score = 0;
	if (type.includes('svg') || /\.svg(\?|$)/i.test(href)) score += 1000;
	if (rel.includes('apple-touch-icon')) score += 300;
	if (rel.includes('mask-icon')) score -= 500; // single-colour silhouettes
	const size = Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
	score += Math.min(size, 512);
	if (/\.ico(\?|$)/i.test(href)) score -= 50;
	return score;
}

async function fromFavicon(serviceUrl: string) {
	let origin: string;
	try {
		origin = new URL(serviceUrl).origin;
	} catch {
		return null;
	}
	const candidates: IconCandidate[] = [];
	try {
		const res = await fetch(serviceUrl, { headers: { Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'follow' });
		if (res.ok) {
			const html = (await res.text()).slice(0, 200_000);
			const headEnd = html.search(/<\/head>/i);
			const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 20_000);
			const base = res.url || serviceUrl;
			const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? '';
			let manifest = '';
			for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
				const tag = m[0];
				const rel = attr(tag, 'rel').toLowerCase();
				const href = attr(tag, 'href');
				if (!href) continue;
				if (rel === 'manifest') manifest = href;
				if (!/(^|\s)(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)(\s|$)/.test(rel) && !rel.includes('icon')) continue;
				try {
					const abs = new URL(href, base).href;
					candidates.push({ href: abs, score: scoreLink(rel, attr(tag, 'type').toLowerCase(), attr(tag, 'sizes'), abs) });
				} catch { /* bad href */ }
			}
			if (manifest) {
				try {
					const murl = new URL(manifest, base).href;
					const mres = await fetch(murl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
					if (mres.ok) {
						const mj = await mres.json();
						for (const ic of mj?.icons ?? []) {
							if (!ic?.src) continue;
							const abs = new URL(ic.src, murl).href;
							candidates.push({ href: abs, score: scoreLink('icon', String(ic.type ?? ''), String(ic.sizes ?? ''), abs) - (String(ic.purpose ?? '').includes('maskable') ? 100 : 0) });
						}
					}
				} catch { /* no manifest */ }
			}
		}
	} catch {
		// page unreachable: still try /favicon.ico below
	}
	candidates.sort((a, b) => b.score - a.score);
	const tried = new Set<string>();
	for (const c of [...candidates, { href: `${origin}/favicon.svg`, score: 0 }, { href: `${origin}/apple-touch-icon.png`, score: 0 }, { href: `${origin}/favicon.ico`, score: 0 }]) {
		if (tried.has(c.href) || tried.size >= 6) continue;
		tried.add(c.href);
		const got = await download(c.href);
		if (got) return { ...got, source: 'favicon' };
	}
	return null;
}

// --- Public API ----------------------------------------------------------------------

const inflight = new Map<string, Promise<CacheEntry | null>>();

function once(key: string, fn: () => Promise<CacheEntry | null>): Promise<CacheEntry | null> {
	const cur = inflight.get(key);
	if (cur) return cur;
	const p = fn().finally(() => inflight.delete(key));
	inflight.set(key, p);
	return p;
}

/** Resolve an icon from what a service stores (icon value, name, url). */
export function resolveIcon(icon: string, name: string, url: string): Promise<CacheEntry | null> {
	const value = icon.trim();
	if (value.startsWith('custom:')) {
		const filename = value.slice(7).replace(/[^a-z0-9._-]/gi, '');
		const ext = filename.split('.').pop() ?? '';
		const type = { svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', gif: 'image/gif', ico: 'image/x-icon' }[ext];
		return Promise.resolve(type && existsSync(join(CACHE_DIR, filename)) ? { filename, contentType: type, createdAt: 0, source: 'upload' } : null);
	}
	if (value.startsWith('url:')) {
		const target = value.slice(4);
		if (!/^https?:\/\//i.test(target)) return Promise.resolve(null);
		return once(`url|${target}`, () => remember(`url|${target}`, async () => {
			const got = await download(target);
			return got && { ...got, source: 'url' };
		}));
	}
	if (value) {
		const m = value.match(/^(selfhst|homarr):(.+)$/);
		const libs: IconLibrary[] = m ? [m[1] as IconLibrary] : LIBRARIES;
		const iconName = m ? m[2] : value;
		return once(`lib|${libs.join(',')}|${iconName}`, () => remember(`lib|${libs.join(',')}|${iconName}`, async () => {
			for (const lib of libs) {
				const got = await fromLibrary(lib, iconName);
				if (got) return got;
			}
			return null;
		}));
	}
	// Nothing picked: by name, then favicon.
	const key = `auto|${name.trim().toLowerCase()}|${url.trim()}`;
	return once(key, () => remember(key, async () => (name.trim() ? await byName(name) : null) ?? (url.trim() ? await fromFavicon(url) : null)));
}

/** Store an uploaded file; returns the icon value to save on the service ("custom:<file>"). */
export async function saveUpload(data: Buffer): Promise<string> {
	const type = sniffImage(data);
	if (!type) throw new Error('Not a supported image (PNG, SVG, WebP, JPEG, GIF, ICO)');
	if (data.length > MAX_UPLOAD_BYTES) throw new Error('Image too large (max 1 MB)');
	await ensureDir();
	const filename = `custom-${createHash('sha256').update(data).digest('hex').substring(0, 20)}.${extFor(type)}`;
	await writeFileAtomic(join(CACHE_DIR, filename), data);
	return `custom:${filename}`;
}

export async function readIconFile(filename: string): Promise<Buffer | null> {
	try {
		return await readFile(join(CACHE_DIR, filename));
	} catch {
		return null;
	}
}

/** Forget cached icons and misses (uploads and catalogs are kept). */
export async function clearCache(): Promise<number> {
	await ensureDir();
	let count = 0;
	for (const file of await readdir(CACHE_DIR)) {
		if (file === 'index.json' || file.startsWith('custom-') || file.startsWith('catalog-')) continue;
		try {
			await unlink(join(CACHE_DIR, file));
			count++;
		} catch { /* ignore */ }
	}
	index = {};
	saveIndexSoon();
	return count;
}

export async function getCacheStats(): Promise<{ count: number; size: number; uploads: number; misses: number }> {
	await ensureDir();
	let count = 0, size = 0, uploads = 0;
	for (const file of await readdir(CACHE_DIR)) {
		if (file === 'index.json' || file.startsWith('catalog-')) continue;
		try {
			size += (await stat(join(CACHE_DIR, file))).size;
			if (file.startsWith('custom-')) uploads++;
			else count++;
		} catch { /* ignore */ }
	}
	const idx = await loadIndex();
	const misses = Object.values(idx).filter((v) => !isHit(v) && v.missUntil > Date.now()).length;
	return { count, size, uploads, misses };
}

/** ETag for an entry (file name + creation time). */
export const etagOf = (e: CacheEntry) => `"${hash(`${e.filename}|${e.createdAt}`)}"`;
