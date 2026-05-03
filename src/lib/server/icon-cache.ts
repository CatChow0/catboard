import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const CONFIG_DIR = process.env.CONFIG_DIR || join(process.cwd(), 'config');
const CACHE_DIR = join(CONFIG_DIR, 'icons');
const INDEX_FILE = join(CACHE_DIR, 'index.json');

interface CacheEntry {
	filename: string;
	contentType: string;
	createdAt: number;
}

interface CacheIndex {
	[url: string]: CacheEntry;
}

function hashUrl(url: string): string {
	return createHash('sha256').update(url).digest('hex').substring(0, 16);
}

async function ensureDir() {
	if (!existsSync(CACHE_DIR)) {
		await mkdir(CACHE_DIR, { recursive: true });
	}
}

async function loadIndex(): Promise<CacheIndex> {
	try {
		const data = await readFile(INDEX_FILE, 'utf-8');
		return JSON.parse(data);
	} catch {
		return {};
	}
}

async function saveIndex(index: CacheIndex) {
	await ensureDir();
	await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

export async function getCachedIcon(url: string): Promise<CacheEntry | null> {
	const index = await loadIndex();
	const entry = index[url];
	if (!entry) return null;

	const filePath = join(CACHE_DIR, entry.filename);
	if (!existsSync(filePath)) {
		delete index[url];
		await saveIndex(index);
		return null;
	}

	return entry;
}

export async function readIconFile(filename: string): Promise<Buffer | null> {
	try {
		return await readFile(join(CACHE_DIR, filename));
	} catch {
		return null;
	}
}

export async function fetchAndCacheIcon(serviceUrl: string): Promise<CacheEntry | null> {
	let faviconUrl: string | null = null;

	// Parse the service page HTML to find the favicon
	try {
		const res = await fetch(serviceUrl, {
			headers: { 'Accept': 'text/html,*/*' },
			signal: AbortSignal.timeout(5000),
			redirect: 'follow'
		});

		if (res.ok) {
			const html = await res.text();
			const headEnd = html.indexOf('</head>');
			const head = headEnd > 0 ? html.substring(0, headEnd) : html.substring(0, 10000);

			const linkRegex = /<link\s+([^>]*?)>/gi;
			const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon', 'apple-touch-icon-precomposed'];

			let match;
			while ((match = linkRegex.exec(head)) !== null) {
				const attrs = match[1];
				const relMatch = attrs.match(/rel\s*=\s*["']([^"']+)["']/i);
				if (!relMatch) continue;

				const rel = relMatch[1].toLowerCase();
				if (!iconRels.some(ir => rel.includes(ir))) continue;

				const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
				if (!hrefMatch) continue;

				try {
					faviconUrl = new URL(hrefMatch[1], serviceUrl).href;
					break;
				} catch { continue; }
			}
		}
	} catch {
		// Page fetch failed
	}

	// Fallback to /favicon.ico
	if (!faviconUrl) {
		try {
			faviconUrl = `${new URL(serviceUrl).origin}/favicon.ico`;
		} catch {
			return null;
		}
	}

	// Download the favicon
	try {
		const iconRes = await fetch(faviconUrl, {
			signal: AbortSignal.timeout(5000),
			redirect: 'follow'
		});

		if (!iconRes.ok) return null;

		const contentType = iconRes.headers.get('content-type') || 'image/x-icon';
		const buffer = Buffer.from(await iconRes.arrayBuffer());

		if (buffer.length === 0) return null;

		return await cacheIcon(serviceUrl, buffer, contentType);
	} catch {
		return null;
	}
}

export async function cacheIcon(url: string, imageData: Buffer, contentType: string): Promise<CacheEntry> {
	await ensureDir();
	const index = await loadIndex();

	// Remove old file if overwriting
	const existing = index[url];
	if (existing) {
		try { await unlink(join(CACHE_DIR, existing.filename)); } catch {}
	}

	const ext = contentType.includes('svg') ? 'svg' :
		contentType.includes('png') ? 'png' :
		contentType.includes('gif') ? 'gif' :
		contentType.includes('webp') ? 'webp' : 'ico';

	const filename = `${hashUrl(url)}.${ext}`;
	await writeFile(join(CACHE_DIR, filename), imageData);

	const entry: CacheEntry = { filename, contentType, createdAt: Date.now() };
	index[url] = entry;
	await saveIndex(index);

	return entry;
}

export async function clearCache(): Promise<number> {
	await ensureDir();
	let count = 0;

	const files = await readdir(CACHE_DIR);
	for (const file of files) {
		if (file === 'index.json') continue;
		try {
			await unlink(join(CACHE_DIR, file));
			count++;
		} catch {}
	}

	await saveIndex({});
	return count;
}

export async function getCacheStats(): Promise<{ count: number; size: number }> {
	await ensureDir();
	let count = 0;
	let size = 0;

	const files = await readdir(CACHE_DIR);
	for (const file of files) {
		if (file === 'index.json') continue;
		try {
			const s = await stat(join(CACHE_DIR, file));
			count++;
			size += s.size;
		} catch {}
	}

	return { count, size };
}