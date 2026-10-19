import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupBundle, createBackup, ensureDailyBackup, latestBackupOf, listBackups, pruneBackups, restoreBackup } from './backup';

let dir = '';
const put = (name: string, value: unknown) => writeFile(join(dir, name), JSON.stringify(value));
const get = async (name: string) => JSON.parse(await readFile(join(dir, name), 'utf-8'));
const at = (iso: string) => () => new Date(iso);

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'catboard-backup-'));
	await put('services.json', { services: [{ id: 's1' }] });
	await put('layout.json', { layouts: {} });
	await put('sessions.json', { secret: 'session' });
	await mkdir(join(dir, 'settings'));
	await writeFile(join(dir, 'settings', 'admin.json'), JSON.stringify({ theme: 'nord' }));
	await mkdir(join(dir, 'icons'));
	await writeFile(join(dir, 'icons', 'x.png'), 'png');
});
afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('createBackup / listBackups', () => {
	it('copies the config files (not sessions, icons or old backups)', async () => {
		const b = await createBackup(dir, 'manual', at('2026-10-19T10:00:00Z'));
		const list = await listBackups(dir);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: b.id, reason: 'manual', date: '2026-10-19T10:00:00.000Z' });
		expect(list[0].files.sort()).toEqual(['layout.json', 'services.json', 'settings/admin.json']);
		expect(list[0].size).toBeGreaterThan(0);
	});

	it('lists the newest first and ignores unrelated folders', async () => {
		await createBackup(dir, 'daily', at('2026-10-18T08:00:00Z'));
		await createBackup(dir, 'before-import', at('2026-10-19T09:00:00Z'));
		await mkdir(join(dir, 'backups', 'not-a-backup'));
		expect((await listBackups(dir)).map((b) => b.reason)).toEqual(['before-import', 'daily']);
	});
});

describe('ensureDailyBackup', () => {
	it('makes one daily backup per day, before the first change', async () => {
		expect(await ensureDailyBackup(dir, at('2026-10-19T08:00:00Z'))).toBe(true);
		expect(await ensureDailyBackup(dir, at('2026-10-19T20:00:00Z'))).toBe(false);
		expect(await ensureDailyBackup(dir, at('2026-10-20T00:05:00Z'))).toBe(true);
		expect((await listBackups(dir)).filter((b) => b.reason === 'daily')).toHaveLength(2);
	});

	it('does nothing when there is no config yet', async () => {
		const empty = await mkdtemp(join(tmpdir(), 'catboard-empty-'));
		expect(await ensureDailyBackup(empty, at('2026-10-19T08:00:00Z'))).toBe(false);
		await rm(empty, { recursive: true, force: true });
	});
});

describe('pruneBackups', () => {
	it('keeps the 14 newest daily backups and the 10 newest others', async () => {
		for (let d = 1; d <= 20; d++) await createBackup(dir, 'daily', at(`2026-09-${String(d).padStart(2, '0')}T08:00:00Z`));
		for (let h = 0; h < 12; h++) await createBackup(dir, 'before-import', at(`2026-10-01T${String(h).padStart(2, '0')}:00:00Z`));
		await pruneBackups(dir);
		const list = await listBackups(dir);
		const daily = list.filter((b) => b.reason === 'daily');
		expect(daily).toHaveLength(14);
		expect(daily.at(-1)!.date).toBe('2026-09-07T08:00:00.000Z');
		expect(list.filter((b) => b.reason !== 'daily')).toHaveLength(10);
	});
});

describe('restoreBackup', () => {
	it('puts the files back after backing up the current state', async () => {
		const b = await createBackup(dir, 'manual', at('2026-10-19T10:00:00Z'));
		await put('services.json', { services: [] });
		await writeFile(join(dir, 'settings', 'admin.json'), JSON.stringify({ theme: 'dracula' }));
		const restored = await restoreBackup(dir, b.id, at('2026-10-19T11:00:00Z'));
		expect(restored.sort()).toEqual(['layout.json', 'services.json', 'settings/admin.json']);
		expect(await get('services.json')).toEqual({ services: [{ id: 's1' }] });
		expect(JSON.parse(await readFile(join(dir, 'settings', 'admin.json'), 'utf-8'))).toEqual({ theme: 'nord' });
		// The state before the restore was kept.
		const before = (await listBackups(dir)).find((x) => x.reason === 'before-restore')!;
		expect(JSON.parse(await readFile(join(dir, 'backups', before.id, 'services.json'), 'utf-8'))).toEqual({ services: [] });
		expect(await get('sessions.json')).toEqual({ secret: 'session' });
	});

	it('refuses unknown or unsafe ids', async () => {
		await expect(restoreBackup(dir, 'nope')).rejects.toThrow('Unknown backup');
		await expect(restoreBackup(dir, '../..')).rejects.toThrow('Unknown backup');
	});
});

describe('latestBackupOf / backupBundle', () => {
	it('finds the newest copy of a file (to recover a corrupt one)', async () => {
		await createBackup(dir, 'daily', at('2026-10-18T08:00:00Z'));
		await put('services.json', { services: [{ id: 's2' }] });
		await createBackup(dir, 'daily', at('2026-10-19T08:00:00Z'));
		expect(await latestBackupOf(dir, 'services.json')).toEqual({ services: [{ id: 's2' }] });
		expect(await latestBackupOf(dir, 'missing.json')).toBeNull();
	});

	it('bundles a backup into one JSON object for download', async () => {
		const b = await createBackup(dir, 'manual', at('2026-10-19T10:00:00Z'));
		const bundle = await backupBundle(dir, b.id);
		expect(bundle).toMatchObject({ catboardBackup: 1, id: b.id, reason: 'manual' });
		expect(bundle.files['settings/admin.json']).toEqual({ theme: 'nord' });
		expect(Object.keys(bundle.files)).not.toContain('sessions.json');
	});

	it('lists nothing before the first backup', async () => {
		expect(await listBackups(dir)).toEqual([]);
		expect(await readdir(dir)).not.toContain('backups');
	});
});
