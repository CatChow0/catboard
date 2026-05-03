import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
	Service, GridConfig, DashboardItemBase, ServiceItem, CollapsibleGroupItem,
	StandardGroupItem, CalendarItem, CalendarConfig, DashboardItem, NavbarItemBase,
	NavbarItem, NavbarLayout, Layout, CustomPalette, Settings, IntegrationsConfig
} from '$lib/types';

export type {
	Service, GridConfig, DashboardItemBase, ServiceItem, CollapsibleGroupItem,
	StandardGroupItem, CalendarItem, CalendarConfig, DashboardItem, NavbarItemBase,
	NavbarItem, NavbarLayout, Layout, CustomPalette, Settings, IntegrationsConfig
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
			{ minWidth: 0, columns: 4 },
			{ minWidth: 800, columns: 6 },
			{ minWidth: 1200, columns: 10 }
		]
		},
		items: [],
		navbar: {
			columns: 12,
			items: [
				{ id: "default-title", type: "navbar-title", col: 0, colSpan: 2 },
				{ id: "default-search", type: "navbar-search", col: 2, colSpan: 4 }
			]
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
			{ minWidth: 0, columns: 4 },
			{ minWidth: 800, columns: 6 },
			{ minWidth: 1200, columns: 10 }
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
	if (!data.navbar) {
		data.navbar = defaultLayout.navbar;
		await setLayout(data);
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