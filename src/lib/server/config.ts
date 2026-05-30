import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
	Service, GridConfig, DashboardItemBase, ServiceItem, CollapsibleGroupItem,
	StandardGroupItem, CalendarItem, CalendarConfig, DashboardItem, NavbarItemBase,
	NavbarItem, NavbarLayout, PerBreakpointLayout, Layout, CustomPalette, Settings, IntegrationsConfig
} from '$lib/types';

export type {
	Service, GridConfig, DashboardItemBase, ServiceItem, CollapsibleGroupItem,
	StandardGroupItem, CalendarItem, CalendarConfig, DashboardItem, NavbarItemBase,
	NavbarItem, NavbarLayout, PerBreakpointLayout, Layout, CustomPalette, Settings, IntegrationsConfig
};

const CONFIG_DIR = process.env.CONFIG_DIR || join(process.cwd(), 'config');

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

async function readConfig<T>(filename: string, defaultValue: T): Promise<T> {
	await ensureDir();
	const filepath = join(CONFIG_DIR, filename);
	if (!existsSync(filepath)) {
		await writeConfig(filename, defaultValue);
		return defaultValue;
	}
	const content = await readFile(filepath, 'utf-8');
	return JSON.parse(content) as T;
}

async function writeConfig<T>(filename: string, data: T): Promise<void> {
	await ensureDir();
	const filepath = join(CONFIG_DIR, filename);
	await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
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

	return data;
}

export async function setLayout(data: Layout): Promise<void> {
	return writeConfig('layout.json', data);
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
	const content = await readFile(filepath, 'utf-8');
	const saved = JSON.parse(content) as Settings;
	return { ...defaultSettings, ...saved, layout: { ...defaultSettings.layout, ...saved.layout }, navbar: { ...defaultSettings.navbar, ...saved.navbar } };
}

export async function setSettingsForUser(username: string, data: Settings): Promise<void> {
	await ensureSubdir('settings');
	const filepath = join(CONFIG_DIR, 'settings', `${username}.json`);
	await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
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

export async function getIntegrations(): Promise<IntegrationsConfig> {
	return readConfig('integrations.json', {});
}

export async function setIntegrations(data: IntegrationsConfig): Promise<void> {
	return writeConfig('integrations.json', data);
}