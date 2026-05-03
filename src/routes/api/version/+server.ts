import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface DockerTag {
	name: string;
	last_updated: string;
}

let cache: { current: string; latest: string; hasUpdate: boolean; fetchedAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000; // 5 minutes

function parseSemver(tag: string): number[] | null {
	const m = tag.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[\-+].*)?$/);
	if (!m) return null;
	return [parseInt(m[1]), parseInt(m[2] || '0'), parseInt(m[3] || '0')];
}

function compareSemver(a: number[], b: number[]): number {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] - b[i];
	}
	return 0;
}

async function getLocalVersion(): Promise<string> {
	try {
		const pkg = await readFile(join(process.cwd(), 'package.json'), 'utf-8');
		const data = JSON.parse(pkg);
		return data.version || '0.0.0';
	} catch {
		return '0.0.0';
	}
}

async function getLatestDockerVersion(): Promise<string> {
	try {
		const res = await fetch('https://hub.docker.com/v2/repositories/catchow/catboard/tags/?page_size=30&ordering=last_updated', {
			headers: { 'Accept': 'application/json' }
		});
		if (!res.ok) return '';
		const data = await res.json();
		const tags: DockerTag[] = data.results || [];
		const semvers = tags
			.map((t) => ({ tag: t.name, ver: parseSemver(t.name) }))
			.filter((t): t is { tag: string; ver: number[] } => t.ver !== null)
			.sort((a, b) => -compareSemver(a.ver, b.ver));
		return semvers[0]?.tag || '';
	} catch {
		return '';
	}
}

export const GET: RequestHandler = async () => {
	const now = Date.now();
	if (cache && now - cache.fetchedAt < CACHE_MS) {
		return json({ current: cache.current, latest: cache.latest, hasUpdate: cache.hasUpdate });
	}

	const current = await getLocalVersion();
	const latest = await getLatestDockerVersion();

	const currentVer = parseSemver(current);
	const latestVer = parseSemver(latest);
	const hasUpdate = currentVer !== null && latestVer !== null && compareSemver(currentVer, latestVer) < 0;

	cache = { current, latest, hasUpdate, fetchedAt: now };
	return json({ current, latest, hasUpdate });
};
