import { mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { readJson, withLock, writeJsonAtomic } from './fs-safe';
import { ensureDailyBackup, latestBackupOf } from './backup';
import type {
	Service, GridConfig, DashboardItemBase, ServiceItem, CollapsibleGroupItem,
	StandardGroupItem, CalendarItem, CalendarConfig, DashboardItem, NavbarItemBase,
	NavbarItem, NavbarLayout, PerBreakpointLayout, Layout, CustomPalette, Settings, IntegrationsConfig, DashboardMeta
} from '$lib/types';

export type {
	Service, GridConfig, DashboardItemBase, ServiceItem, CollapsibleGroupItem,
	StandardGroupItem, CalendarItem, CalendarConfig, DashboardItem, NavbarItemBase,
	NavbarItem, NavbarLayout, PerBreakpointLayout, Layout, CustomPalette, Settings, IntegrationsConfig
};

const CONFIG_DIR = process.env.CONFIG_DIR || join(process.cwd(), 'config');

/** The config folder (backups live in its `backups` subfolder). */
export const configDir = () => CONFIG_DIR;

/**
 * Runs a read-modify-write of a config file with no other change to it in
 * between: `mutate('layout', async () => { const l = await getLayout(); ...; await setLayout(l); })`.
 */
export function mutate<T>(name: string, fn: () => Promise<T>): Promise<T> {
	return withLock(`config:${name}`, fn);
}

async function ensureDir() {
	if (!existsSync(CONFIG_DIR)) {
		await mkdir(CONFIG_DIR, { recursive: true });
	}
}

async function ensureSubdir(subdir: string) {
	const dir = join(CONFIG_DIR, subdir);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
}

// A file that cannot be parsed (crash of an older version, manual edit) is
// moved aside and replaced by its newest backup, or else by the default.
async function readConfig<T>(filename: string, defaultValue: T): Promise<T> {
	await ensureDir();
	const filepath = join(CONFIG_DIR, filename);
	if (!existsSync(filepath)) {
		await writeConfig(filename, defaultValue);
		return defaultValue;
	}
	return readJson(filepath, defaultValue, () => latestBackupOf<T>(CONFIG_DIR, filename));
}

/** Atomic write, after today's backup if it was not made yet. */
async function writeConfig<T>(filename: string, data: T): Promise<void> {
	await ensureDir();
	await ensureDailyBackup(CONFIG_DIR).catch((err) => console.error('[config] daily backup failed:', err));
	await writeJsonAtomic(join(CONFIG_DIR, filename), data);
}

// --- Types (server-only) ---

export type UserRole = 'admin' | 'mini-admin' | 'user';

export interface User {
	username: string;
	passwordHash: string;
	role: UserRole;
	isMainAdmin: boolean;
}

export interface UsersConfig {
	users: User[];
}

// --- Default configs ---

const defaultServices: { services: Service[] } = { services: [] };
const defaultLayout: Layout = {
	grid: {
		cellSize: 80,
		gap: 12,
		breakpoints: [
			{ id: 'mobile', name: 'Mobile', minWidth: 0, columns: 4 },
			{ id: 'tablet', name: 'Tablet', minWidth: 800, columns: 6 },
			{ id: 'desktop', name: 'Desktop', minWidth: 1200, columns: 10 }
		]
	},
	layouts: {
		mobile: { items: [], navbar: { columns: 12, items: [] } },
		tablet: { items: [], navbar: { columns: 12, items: [] } },
		desktop: {
			items: [],
			navbar: {
				columns: 12,
				items: [
					{ id: "default-title", type: "navbar-title", col: 0, colSpan: 2 },
					{ id: "default-search", type: "navbar-search", col: 2, colSpan: 4 }
				]
			}
		}
	}
};
const defaultSettings: Settings = {
	title: 'My Homelab',
	theme: 'dark',
	background: { type: 'none', value: '' },
	stylePreset: 'default',
	animations: 'subtle',
	scrollbarStyle: 'thin',
	navbar: { columns: 12 },
	statusCheckInterval: 30000,
	layout: {
		cellSize: 80,
		gap: 12,
		breakpoints: [
			{ id: 'mobile', name: 'Mobile', minWidth: 0, columns: 4 },
			{ id: 'tablet', name: 'Tablet', minWidth: 800, columns: 6 },
			{ id: 'desktop', name: 'Desktop', minWidth: 1200, columns: 10 }
		]
	}
};

// --- Migration ---

let migrationDone = false;

export async function migrateAuthToUsers(): Promise<void> {
	if (migrationDone) return;
	migrationDone = true;

	await ensureDir();
	const usersPath = join(CONFIG_DIR, 'users.json');
	if (existsSync(usersPath)) return;

	const authPath = join(CONFIG_DIR, 'auth.json');
	if (existsSync(authPath)) {
		const authContent = await readFile(authPath, 'utf-8');
		const auth = JSON.parse(authContent);
		if (auth.username && auth.passwordHash) {
			const usersConfig: UsersConfig = {
				users: [{
					username: auth.username,
					passwordHash: auth.passwordHash,
					role: 'admin' as UserRole,
					isMainAdmin: true
				}]
			};
			await writeConfig('users.json', usersConfig);
		}
	}
}

// --- Public API ---

export async function getServices(): Promise<{ services: Service[] }> {
	return readConfig('services.json', defaultServices);
}

export async function setServices(data: { services: Service[] }): Promise<void> {
	return writeConfig('services.json', data);
}

export async function getLayout(): Promise<Layout> {
	const data = await readConfig('layout.json', defaultLayout);

	// Migration: vieux format (items + navbar au niveau racine) -> nouveau format (layouts par breakpoint)
	if (!data.layouts) {
		const legacyItems = (data as any).items || [];
		const legacyNavbar = (data as any).navbar || defaultLayout.layouts.desktop.navbar;

		// Assigner des IDs aux breakpoints s'ils n'en ont pas
		const breakpoints = data.grid?.breakpoints || defaultLayout.grid.breakpoints;
		for (const bp of breakpoints) {
			if (!bp.id) {
				if (bp.minWidth === 0) bp.id = 'mobile';
				else if (bp.minWidth === 800) bp.id = 'tablet';
				else if (bp.minWidth === 1200) bp.id = 'desktop';
				else bp.id = `bp-${bp.minWidth}`;
			}
		}

		// Le breakpoint le plus large herite des items/navbar existants
		const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth);
		const largestBpId = sorted[0]?.id || 'desktop';

		const layouts: Record<string, PerBreakpointLayout> = {};
		for (const bp of breakpoints) {
			if (bp.id === largestBpId) {
				layouts[bp.id] = { items: legacyItems, navbar: legacyNavbar };
			} else {
				layouts[bp.id] = { items: [], navbar: { columns: 12, items: [] } };
			}
		}

		const migrated: Layout = {
			grid: { ...data.grid, breakpoints },
			layouts
		};

		await setLayout(migrated);
		return migrated;
	}

	// S'assurer que tous les breakpoints ont un ID et que tous les layouts existent
	if (data.grid?.breakpoints) {
		let needsSave = false;
		for (const bp of data.grid.breakpoints) {
			if (!bp.id) {
				if (bp.minWidth === 0) bp.id = 'mobile';
				else if (bp.minWidth === 800) bp.id = 'tablet';
				else if (bp.minWidth === 1200) bp.id = 'desktop';
				else bp.id = `bp-${bp.minWidth}`;
				needsSave = true;
			}
			if (!bp.name) {
				bp.name = bp.id.charAt(0).toUpperCase() + bp.id.slice(1);
				needsSave = true;
			}
		}
		for (const bp of data.grid.breakpoints) {
			if (!data.layouts[bp.id]) {
				data.layouts[bp.id] = { items: [], navbar: { columns: 12, items: [] } };
				needsSave = true;
			}
		}
		if (needsSave) {
			await setLayout(data);
		}
	}

	if (normalizeDashboards(data)) await setLayout(data);

	return data;
}

export async function setLayout(data: Layout): Promise<void> {
	return writeConfig('layout.json', data);
}

// --- Dashboards ---
// layout.json keeps the first ("main") dashboard in `layouts` (the historical
// format) and the others in `pages[id]`; `dashboards` holds their order and
// names. The API serves one dashboard at a time in `layouts`.

export const MAIN_DASHBOARD = 'main';

export function dashboardList(layout: Layout): DashboardMeta[] {
	return layout.dashboards?.length ? layout.dashboards : [{ id: MAIN_DASHBOARD, name: 'Home' }];
}

/** The per-breakpoint layouts of a dashboard (main when unknown). */
export function dashboardLayouts(layout: Layout, id: string): Record<string, PerBreakpointLayout> {
	if (id !== MAIN_DASHBOARD && layout.pages?.[id]) return layout.pages[id];
	return layout.layouts;
}

export function setDashboardLayouts(layout: Layout, id: string, layouts: Record<string, PerBreakpointLayout>): void {
	if (id === MAIN_DASHBOARD) layout.layouts = layouts;
	else (layout.pages ??= {})[id] = layouts;
}

/** Resolve a requested dashboard id to an existing one (main when unknown). */
export function resolveDashboard(layout: Layout, id: string | null | undefined): string {
	const list = dashboardList(layout);
	return id && list.some((d) => d.id === id) ? id : list[0].id;
}

/** Every breakpoint layout of every dashboard: for routes that look for widgets anywhere. */
export function allBreakpointLayouts(layout: Layout): PerBreakpointLayout[] {
	return dashboardList(layout).flatMap((d) => Object.values(dashboardLayouts(layout, d.id) || {}));
}

/** The title widget is mandatory: it carries the dashboard switcher. Returns true when changed. */
export function ensureTitle(navbar: PerBreakpointLayout['navbar']): boolean {
	const items = navbar.items;
	const titles = items.filter((i) => i.type === 'navbar-title');
	if (titles.length === 1) return false;
	if (titles.length > 1) {
		navbar.items = items.filter((i) => i.type !== 'navbar-title' || i === titles[0]);
		return true;
	}
	const columns = navbar.columns || 12;
	const span = 2;
	let col = items.reduce((m, i) => Math.max(m, i.col + i.colSpan), 0);
	for (let c = 0; c <= columns - span; c++) {
		if (!items.some((i) => c < i.col + i.colSpan && c + span > i.col)) {
			col = c;
			break;
		}
	}
	items.push({ id: `title-${randomUUID()}`, type: 'navbar-title', col, colSpan: span });
	return true;
}

/** Make every dashboard complete (a layout per breakpoint, one title per navbar). */
export function normalizeDashboards(layout: Layout): boolean {
	let changed = false;
	const breakpoints = layout.grid?.breakpoints || [];
	if (layout.dashboards?.length && !layout.dashboards.some((d) => d.id === MAIN_DASHBOARD)) {
		// "main" must stay in the list: it owns `layouts`.
		layout.dashboards.unshift({ id: MAIN_DASHBOARD, name: 'Home' });
		changed = true;
	}
	for (const d of dashboardList(layout)) {
		const layouts = d.id === MAIN_DASHBOARD ? layout.layouts : ((layout.pages ??= {})[d.id] ??= {});
		for (const bp of breakpoints) {
			if (!layouts[bp.id]) {
				layouts[bp.id] = { items: [], navbar: { columns: 12, items: [] } };
				changed = true;
			}
			layouts[bp.id].navbar ??= { columns: 12, items: [] };
			layouts[bp.id].navbar.items ??= [];
			if (ensureTitle(layouts[bp.id].navbar)) changed = true;
		}
	}
	return changed;
}

export async function getSettings(): Promise<Settings> {
	const saved = await readConfig('settings.json', defaultSettings);
	return { ...defaultSettings, ...saved, layout: { ...defaultSettings.layout, ...saved.layout }, navbar: { ...defaultSettings.navbar, ...saved.navbar } };
}

export async function setSettings(data: Settings): Promise<void> {
	return writeConfig('settings.json', data);
}

export async function getSettingsForUser(username: string): Promise<Settings> {
	await ensureSubdir('settings');
	const filepath = join(CONFIG_DIR, 'settings', `${username}.json`);
	if (!existsSync(filepath)) {
		return { ...defaultSettings };
	}
	const saved = await readJson<Partial<Settings>>(filepath, {}, () => latestBackupOf<Settings>(CONFIG_DIR, `settings/${username}.json`));
	return { ...defaultSettings, ...saved, layout: { ...defaultSettings.layout, ...saved.layout }, navbar: { ...defaultSettings.navbar, ...saved.navbar } };
}

export async function setSettingsForUser(username: string, data: Settings): Promise<void> {
	await ensureSubdir('settings');
	await ensureDailyBackup(CONFIG_DIR).catch((err) => console.error('[config] daily backup failed:', err));
	await writeJsonAtomic(join(CONFIG_DIR, 'settings', `${username}.json`), data);
}

// --- Users ---

export async function getUsers(): Promise<UsersConfig> {
	return readConfig('users.json', { users: [] });
}

export async function setUsers(data: UsersConfig): Promise<void> {
	return writeConfig('users.json', data);
}

export async function findUserByUsername(username: string): Promise<User | undefined> {
	const config = await getUsers();
	return config.users.find(u => u.username === username);
}

export async function isSetupDone(): Promise<boolean> {
	const filepath = join(CONFIG_DIR, 'users.json');
	if (!existsSync(filepath)) return false;
	const config = await getUsers();
	return config.users.length > 0;
}

// --- Access ---

/** Who may change the shared dashboards (services, layout, dashboards). */
export interface AccessConfig {
	dashboardEditors: 'admins' | 'everyone';
}

/** Installs from before this setting existed keep their behaviour: everyone edits. */
export async function getAccess(): Promise<AccessConfig> {
	const saved = await readConfig<Partial<AccessConfig>>('access.json', { dashboardEditors: 'everyone' });
	return { dashboardEditors: saved.dashboardEditors === 'admins' ? 'admins' : 'everyone' };
}

export async function setAccess(data: AccessConfig): Promise<void> {
	return writeConfig('access.json', data);
}

export async function getIntegrations(): Promise<IntegrationsConfig> {
	return readConfig('integrations.json', {});
}

export async function setIntegrations(data: IntegrationsConfig): Promise<void> {
	return writeConfig('integrations.json', data);
}