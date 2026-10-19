// Config backups in <config>/backups/<time>_<reason>/: a copy of the JSON
// config files (services, layout, integrations, users, access, settings and
// per-user settings), never the sessions or the icon cache.
// - daily: made before the first change of each day, the 14 newest kept;
// - before-import / before-restore / manual: the 10 newest kept.
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './fs-safe';
import { AppError } from '$lib/server/api-error';

export type BackupReason = 'daily' | 'before-import' | 'before-restore' | 'manual';
export interface BackupInfo {
	id: string;
	reason: BackupReason;
	date: string;
	files: string[];
	size: number;
}

const KEEP_DAILY = 14;
const KEEP_OTHER = 10;
const REASONS: BackupReason[] = ['daily', 'before-import', 'before-restore', 'manual'];
const ID = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)_([a-z-]+)$/;
const EXCLUDED = new Set(['sessions.json']);

type Now = () => Date;

/** Config files to back up, relative to the config folder. */
async function configFiles(configDir: string): Promise<string[]> {
	const out: string[] = [];
	const top = await readdir(configDir, { withFileTypes: true }).catch(() => []);
	for (const e of top) if (e.isFile() && e.name.endsWith('.json') && !EXCLUDED.has(e.name)) out.push(e.name);
	const settings = await readdir(join(configDir, 'settings'), { withFileTypes: true }).catch(() => []);
	for (const e of settings) if (e.isFile() && e.name.endsWith('.json')) out.push(`settings/${e.name}`);
	return out;
}

const idOf = (date: Date, reason: BackupReason) => `${date.toISOString().replace(/[:.]/g, '-')}_${reason}`;

function parseId(id: string): { date: string; reason: BackupReason } | null {
	const m = id.match(ID);
	if (!m || !REASONS.includes(m[2] as BackupReason)) return null;
	const [d, t] = m[1].split('T');
	const [hh, mm, ss, ms] = t.replace('Z', '').split('-');
	return { date: `${d}T${hh}:${mm}:${ss}.${ms}Z`, reason: m[2] as BackupReason };
}

export async function createBackup(configDir: string, reason: BackupReason, now: Now = () => new Date()): Promise<BackupInfo> {
	let date = now();
	let id = idOf(date, reason);
	// Two backups in the same millisecond: shift by 1 ms to keep both.
	while (existsSync(join(configDir, 'backups', id))) {
		date = new Date(date.getTime() + 1);
		id = idOf(date, reason);
	}
	const target = join(configDir, 'backups', id);
	await mkdir(join(target, 'settings'), { recursive: true });
	const files = await configFiles(configDir);
	let size = 0;
	for (const f of files) {
		await copyFile(join(configDir, f), join(target, f));
		size += (await stat(join(target, f))).size;
	}
	return { id, reason, date: date.toISOString(), files, size };
}

export async function listBackups(configDir: string): Promise<BackupInfo[]> {
	const dirs = await readdir(join(configDir, 'backups'), { withFileTypes: true }).catch(() => []);
	const out: BackupInfo[] = [];
	for (const d of dirs) {
		const meta = d.isDirectory() ? parseId(d.name) : null;
		if (!meta) continue;
		const files = await configFiles(join(configDir, 'backups', d.name));
		let size = 0;
		for (const f of files) size += (await stat(join(configDir, 'backups', d.name, f))).size;
		out.push({ id: d.name, ...meta, files, size });
	}
	return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Makes today's daily backup if there is none yet. Returns true when it made one. */
export async function ensureDailyBackup(configDir: string, now: Now = () => new Date()): Promise<boolean> {
	if ((await configFiles(configDir)).length === 0) return false;
	const today = now().toISOString().slice(0, 10);
	const list = await listBackups(configDir);
	if (list.some((b) => b.reason === 'daily' && b.date.startsWith(today))) return false;
	await createBackup(configDir, 'daily', now);
	await pruneBackups(configDir);
	return true;
}

export async function pruneBackups(configDir: string): Promise<void> {
	const list = await listBackups(configDir);
	const daily = list.filter((b) => b.reason === 'daily').slice(KEEP_DAILY);
	const other = list.filter((b) => b.reason !== 'daily').slice(KEEP_OTHER);
	for (const b of [...daily, ...other]) await rm(join(configDir, 'backups', b.id), { recursive: true, force: true });
}

async function findBackup(configDir: string, id: string): Promise<BackupInfo> {
	const b = parseId(id) ? (await listBackups(configDir)).find((x) => x.id === id) : undefined;
	if (!b) throw new AppError('errors.unknownBackup');
	return b;
}

/** Puts a backup's files back, after saving the current state. Returns the restored files. */
export async function restoreBackup(configDir: string, id: string, now: Now = () => new Date()): Promise<string[]> {
	const b = await findBackup(configDir, id);
	await createBackup(configDir, 'before-restore', now);
	await mkdir(join(configDir, 'settings'), { recursive: true });
	for (const f of b.files) await writeFileAtomic(join(configDir, f), await readFile(join(configDir, 'backups', id, f)));
	await pruneBackups(configDir);
	return b.files;
}

/** The newest backed-up copy of a config file, parsed (null if none can be read). */
export async function latestBackupOf<T>(configDir: string, file: string): Promise<T | null> {
	for (const b of await listBackups(configDir)) {
		if (!b.files.includes(file)) continue;
		try {
			return JSON.parse(await readFile(join(configDir, 'backups', b.id, file), 'utf-8')) as T;
		} catch {
			// try an older one
		}
	}
	return null;
}

/** One backup as a single JSON document, for download. */
export async function backupBundle(configDir: string, id: string) {
	const b = await findBackup(configDir, id);
	const files: Record<string, unknown> = {};
	for (const f of b.files) files[f] = JSON.parse(await readFile(join(configDir, 'backups', id, f), 'utf-8'));
	return { catboardBackup: 1, id: b.id, reason: b.reason, date: b.date, files };
}
