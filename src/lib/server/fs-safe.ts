// Safe file storage for the config folder:
// - writes go to a temporary file in the same folder, are flushed to disk,
//   then renamed over the target, so a crash or a full disk never leaves a
//   half-written JSON file (rename is atomic on the same filesystem);
// - writes to one file are queued, so they never interleave;
// - withLock() serialises read-modify-write sections (two saves at the same
//   time no longer overwrite each other);
// - a JSON file that cannot be parsed is moved aside, then recovered or
//   replaced by its default instead of breaking every request.
import { open, readFile, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const queues = new Map<string, Promise<unknown>>();
let counter = 0;

// Windows refuses to replace a file another handle is reading at that moment
// (EPERM / EACCES / EBUSY): try again for a short while, like graceful-fs.
const RETRY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RETRY_DELAYS = [10, 20, 40, 80, 160, 320, 640];

export async function renameWithRetry(from: string, to: string, rn: typeof rename = rename): Promise<void> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await rn(from, to);
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code ?? '';
			if (!RETRY_CODES.has(code) || attempt >= RETRY_DELAYS.length) throw err;
			await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
		}
	}
}

/** Runs fn after every earlier call with the same key has finished. */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const previous = queues.get(key) ?? Promise.resolve();
	const run = previous.then(fn, fn);
	const tail = run.catch(() => {});
	queues.set(key, tail);
	tail.then(() => {
		if (queues.get(key) === tail) queues.delete(key);
	});
	return run;
}

export function writeFileAtomic(file: string, data: string | Buffer): Promise<void> {
	return withLock(`write:${file}`, async () => {
		const tmp = join(dirname(file), `.${basename(file)}.${process.pid}.${++counter}.tmp`);
		const handle = await open(tmp, 'w');
		try {
			await handle.writeFile(data);
			await handle.sync();
		} finally {
			await handle.close();
		}
		try {
			await renameWithRetry(tmp, file);
		} catch (err) {
			await unlink(tmp).catch(() => {});
			throw err;
		}
	});
}

export function writeJsonAtomic(file: string, data: unknown, indent: number | undefined = 2): Promise<void> {
	return writeFileAtomic(file, JSON.stringify(data, null, indent));
}

/**
 * Reads a JSON file. Missing: the fallback. Unreadable JSON: the file is
 * renamed to <name>.corrupt-<time> (kept for inspection), then `recover`
 * (e.g. the latest backup) or the fallback is returned.
 */
export async function readJson<T>(file: string, fallback: T, recover?: () => Promise<T | null>): Promise<T> {
	let text: string;
	try {
		text = await readFile(file, 'utf-8');
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
		throw err;
	}
	try {
		return JSON.parse(text) as T;
	} catch {
		const aside = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
		await rename(file, aside).catch(() => {});
		console.error(`[config] ${basename(file)} could not be read and was moved to ${basename(aside)}`);
		return (await recover?.().catch(() => null)) ?? fallback;
	}
}
