// Every external connection CatBoard knows, as data: Settings > Integrations
// builds its list and forms from it, the widget catalog uses it to tell which
// widgets still need a connection, and the test route (POST
// /api/integrations/test) knows what to probe. Storage stays IntegrationsConfig.
import type { IntegrationsConfig } from '$lib/types';
import type { GlyphName } from '$lib/widgets/glyphs';

export type IntegrationKey = keyof IntegrationsConfig;
export type IntegrationCategory = 'Monitoring' | 'Virtualisation' | 'Media' | 'Downloads' | 'Files' | 'Development' | '3D printing' | 'Network';
export const INTEGRATION_CATEGORIES: IntegrationCategory[] = ['Monitoring', 'Virtualisation', 'Media', 'Downloads', 'Files', 'Development', '3D printing', 'Network'];

export interface FieldDef {
	id: string;
	label: string;
	/** toggle: a checkbox stored as the string "true". */
	type: 'url' | 'text' | 'secret' | 'toggle';
	placeholder?: string;
	hint?: string;
	/** Optional fields are shown in a collapsed "Advanced" box when empty. */
	advanced?: boolean;
}

export interface IntegrationDef {
	key: IntegrationKey;
	name: string;
	description: string;
	icon: GlyphName;
	category: IntegrationCategory;
	/** single: one connection object; list: several items (environments, servers, printers). */
	kind: 'single' | 'list';
	fields: FieldDef[];
	/** list kind: property holding the items, and how one item is called. */
	listKey?: string;
	itemName?: string;
	/** A field the user fills that makes the connection count as set up. */
	requiredField: string;
	/** Free text shown under the form (setup tips). */
	help?: string;
}

const ARR_FIELDS = (name: string, port: number): FieldDef[] => [
	{ id: 'url', label: 'URL', type: 'url', placeholder: `http://${name.toLowerCase()}:${port}` },
	{ id: 'apiKey', label: 'API key', type: 'secret', placeholder: 'Settings > General > API Key' }
];

export const INTEGRATIONS: IntegrationDef[] = [
	{
		key: 'uptimeKuma',
		name: 'Uptime Kuma',
		description: 'Status pages with their monitors and uptime',
		icon: 'kuma',
		category: 'Monitoring',
		kind: 'single',
		fields: [{ id: 'url', label: 'URL', type: 'url', placeholder: 'https://uptime-kuma.example.com' }],
		requiredField: 'url',
		help: 'Status pages must be public: CatBoard reads them like a visitor would.'
	},
	{
		key: 'docker',
		name: 'Docker',
		description: 'Containers of one or more Docker hosts',
		icon: 'docker',
		category: 'Monitoring',
		kind: 'list',
		listKey: 'environments',
		itemName: 'environment',
		fields: [
			{ id: 'name', label: 'Name', type: 'text', placeholder: 'Local' },
			{ id: 'url', label: 'Socket or URL', type: 'text', placeholder: '/var/run/docker.sock or tcp://host:2375' }
		],
		requiredField: 'url',
		help: 'A socket path needs the socket mounted in the container (see DOCKER.md); a TCP URL can point to a socket proxy.'
	},
	{
		key: 'stacker',
		name: 'Stacker',
		description: 'Live CPU, memory, GPU, disk and network of a server',
		icon: 'stacker',
		category: 'Monitoring',
		kind: 'list',
		listKey: 'servers',
		itemName: 'server',
		fields: [
			{ id: 'name', label: 'Name', type: 'text', placeholder: 'Home server' },
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://stacker:8080' },
			{ id: 'username', label: 'Username', type: 'text', advanced: true, hint: 'Only if Stacker is behind a login (basic auth).' },
			{ id: 'password', label: 'Password', type: 'secret', advanced: true }
		],
		requiredField: 'url'
	},
	{
		key: 'radarr',
		name: 'Radarr',
		description: 'Movies: calendar and new releases',
		icon: 'radarr',
		category: 'Media',
		kind: 'single',
		fields: ARR_FIELDS('Radarr', 7878),
		requiredField: 'url'
	},
	{
		key: 'sonarr',
		name: 'Sonarr',
		description: 'TV shows: calendar and new episodes',
		icon: 'sonarr',
		category: 'Media',
		kind: 'single',
		fields: ARR_FIELDS('Sonarr', 8989),
		requiredField: 'url'
	},
	{
		key: 'lidarr',
		name: 'Lidarr',
		description: 'Music: calendar and new albums',
		icon: 'lidarr',
		category: 'Media',
		kind: 'single',
		fields: ARR_FIELDS('Lidarr', 8686),
		requiredField: 'url'
	},
	{
		key: 'jellyfin',
		name: 'Jellyfin',
		description: 'Recently added media and who is watching',
		icon: 'jellyfin',
		category: 'Media',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://jellyfin:8096' },
			{ id: 'apiKey', label: 'API key', type: 'secret', placeholder: 'Dashboard > API Keys' }
		],
		requiredField: 'url'
	},
	{
		key: 'jellyseerr',
		name: 'Jellyseerr / Overseerr',
		description: 'Media requests: list, approve and decline',
		icon: 'requests',
		category: 'Media',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://jellyseerr:5055' },
			{ id: 'apiKey', label: 'API key', type: 'secret', placeholder: 'Settings > General > API Key' }
		],
		requiredField: 'url'
	},
	{
		key: 'qbittorrent',
		name: 'qBittorrent',
		description: 'Speeds, torrents, pause and resume',
		icon: 'download',
		category: 'Downloads',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'Web UI URL', type: 'url', placeholder: 'http://qbittorrent:8080' },
			{ id: 'username', label: 'Username', type: 'text' },
			{ id: 'password', label: 'Password', type: 'secret' }
		],
		requiredField: 'url'
	},
	{
		key: 'psitransfer',
		name: 'PsiTransfer',
		description: 'Share files: drop them on a widget, get a link',
		icon: 'upload',
		category: 'Files',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://psitransfer:3000' },
			{ id: 'publicUrl', label: 'Public URL', type: 'url', placeholder: 'https://psitransfer.example.com', advanced: true, hint: 'Public address and upload password (only when they differ from the defaults).' },
			{ id: 'uploadPassword', label: 'Upload password', type: 'secret', placeholder: 'PSITRANSFER_UPLOAD_PASS, if set', advanced: true }
		],
		requiredField: 'url',
		help: 'The URL is the address the CatBoard server uses (an internal one such as http://psitransfer:3000 works). Share links use the public URL when it is set.'
	},
	{
		key: 'jenkins',
		name: 'Jenkins',
		description: 'Latest builds, start a build',
		icon: 'jenkins',
		category: 'Development',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://jenkins:8080' },
			{ id: 'username', label: 'Username', type: 'text' },
			{ id: 'apiToken', label: 'API token', type: 'secret', placeholder: 'User menu > Security > API Token' },
			{ id: 'publicUrl', label: 'Public URL', type: 'url', placeholder: 'https://jenkins.example.com', advanced: true, hint: 'Public address for the links to builds (only when it differs from the URL).' }
		],
		requiredField: 'url',
		help: 'Create an API token for this user in Jenkins (user menu > Security > API Token). Starting builds needs the Job/Build permission.'
	},
	{
		key: 'proxmox',
		name: 'Proxmox VE',
		description: 'Nodes, VMs and containers; start and stop guests',
		icon: 'server',
		category: 'Virtualisation',
		kind: 'list',
		listKey: 'clusters',
		itemName: 'cluster',
		fields: [
			{ id: 'name', label: 'Name', type: 'text', placeholder: 'Home lab' },
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'https://pve.lan:8006' },
			{ id: 'tokenId', label: 'API token ID', type: 'text', placeholder: 'catboard@pve!dashboard' },
			{ id: 'tokenSecret', label: 'API token secret', type: 'secret', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
			{ id: 'insecure', label: 'Skip TLS verification (self-signed certificate)', type: 'toggle' }
		],
		requiredField: 'url',
		help: 'Datacenter > Permissions > API Tokens. Reading needs the PVEAuditor role on /; starting and stopping guests needs PVEVMUser (or VM.PowerMgmt). Untick "Privilege Separation" or give the token its own role.'
	},
	{
		key: 'portainer',
		name: 'Portainer',
		description: 'Environments and stacks; start and stop stacks',
		icon: 'stacks',
		category: 'Virtualisation',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'https://portainer:9443' },
			{ id: 'apiKey', label: 'Access token', type: 'secret', placeholder: 'My account > Access tokens' },
			{ id: 'insecure', label: 'Skip TLS verification (self-signed certificate)', type: 'toggle' },
			{ id: 'publicUrl', label: 'Public URL', type: 'url', placeholder: 'https://portainer.example.com', advanced: true, hint: 'Public address for the links (only when it differs from the URL).' }
		],
		requiredField: 'url',
		help: 'Create an access token in Portainer (My account > Access tokens). Starting and stopping stacks needs an administrator or an environment administrator.'
	},
	{
		key: 'immich',
		name: 'Immich',
		description: 'Library statistics and the latest photos',
		icon: 'photos',
		category: 'Files',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://immich-server:2283' },
			{ id: 'apiKey', label: 'API key', type: 'secret', placeholder: 'Account settings > API keys' },
			{ id: 'publicUrl', label: 'Public URL', type: 'url', placeholder: 'https://photos.example.com', advanced: true, hint: 'Public address for the links to photos (only when it differs from the URL).' }
		],
		requiredField: 'url',
		help: "An API key of an admin shows the whole server's statistics; any other key shows its owner's library."
	},
	{
		key: 'nextcloud',
		name: 'Nextcloud',
		description: 'Storage quota, server info and recent files',
		icon: 'cloud',
		category: 'Files',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://nextcloud' },
			{ id: 'username', label: 'Username', type: 'text' },
			{ id: 'appPassword', label: 'App password', type: 'secret', placeholder: 'Personal settings > Security > App passwords' },
			{ id: 'publicUrl', label: 'Public URL', type: 'url', placeholder: 'https://cloud.example.com', advanced: true, hint: 'Public address for the links to files (only when it differs from the URL).' }
		],
		requiredField: 'url',
		help: 'Use an app password (Personal settings > Security), not your login password. Server info needs an admin account and the Monitoring (serverinfo) app.'
	},
	{
		key: 'gitea',
		name: 'Gitea / Forgejo',
		description: 'Recent repositories, open issues and pull requests',
		icon: 'git',
		category: 'Development',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://gitea:3000' },
			{ id: 'apiToken', label: 'Access token', type: 'secret', placeholder: 'Settings > Applications > Generate token' },
			{ id: 'publicUrl', label: 'Public URL', type: 'url', placeholder: 'https://git.example.com', advanced: true, hint: 'Public address for the header link (only when it differs from the URL).' }
		],
		requiredField: 'url',
		help: 'Create a token in Settings > Applications with read access to user, repository and issue. CatBoard only reads.'
	},
	{
		key: 'spoolman',
		name: 'Spoolman',
		description: 'Filament spools: available, recently used, running low',
		icon: 'spool',
		category: '3D printing',
		kind: 'single',
		fields: [{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://spoolman:7912' }],
		requiredField: 'url'
	},
	{
		key: 'elegoo',
		name: 'Elegoo printers',
		description: 'Centauri Carbon 2 print status over the LAN',
		icon: 'printer',
		category: '3D printing',
		kind: 'list',
		listKey: 'printers',
		itemName: 'printer',
		fields: [
			{ id: 'name', label: 'Name', type: 'text', placeholder: 'Centauri' },
			{ id: 'host', label: 'Printer IP', type: 'text', placeholder: '192.168.1.50' },
			{ id: 'accessCode', label: 'Access code', type: 'secret', placeholder: 'If set on the printer' },
			{ id: 'serial', label: 'Serial number', type: 'text', placeholder: 'Filled by Detect' }
		],
		requiredField: 'host',
		help: 'Enable LAN Only mode on the printer (Settings > Network). Detect fills in the serial number; a printer accepts about 4 connections at once.'
	},
	{
		key: 'adguardHome',
		name: 'AdGuard Home',
		description: 'DNS filtering stats, pause and resume',
		icon: 'shield',
		category: 'Network',
		kind: 'single',
		fields: [
			{ id: 'url', label: 'URL', type: 'url', placeholder: 'http://adguard:3000' },
			{ id: 'username', label: 'Username', type: 'text' },
			{ id: 'password', label: 'Password', type: 'secret' }
		],
		requiredField: 'url'
	}
];

export function integrationDef(key: IntegrationKey): IntegrationDef | undefined {
	return INTEGRATIONS.find((d) => d.key === key);
}

/** The items of a list integration, or the connection object of a single one. */
export function itemsOf(def: IntegrationDef, cfg: IntegrationsConfig): Record<string, string>[] {
	const value = cfg[def.key] as Record<string, unknown> | undefined;
	if (def.kind === 'list') return ((value?.[def.listKey!] as Record<string, string>[]) ?? []);
	return value ? [value as Record<string, string>] : [];
}

/** Whether a connection is set up (single: URL filled; list: at least one item). */
export function isConfigured(key: IntegrationKey, cfg: IntegrationsConfig): boolean {
	const def = integrationDef(key);
	if (!def) return false;
	return itemsOf(def, cfg).some((it) => String(it?.[def.requiredField] ?? '').trim() !== '');
}

/**
 * Cleaned value to save: trimmed strings, empty optional fields dropped, items
 * without their required field removed; undefined clears a single connection.
 */
export function cleanValue(def: IntegrationDef, items: Record<string, string>[]): unknown {
	const clean = (it: Record<string, string>) => {
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(it)) {
			const s = typeof v === 'string' ? (def.fields.find((f) => f.id === k)?.type === 'secret' ? v : v.trim()) : v;
			if (s !== '' && s != null) out[k] = s;
		}
		return out;
	};
	if (def.kind === 'single') {
		const it = clean(items[0] ?? {});
		return it[def.requiredField] ? it : undefined;
	}
	let list = items.map(clean).filter((it) => it[def.requiredField]);
	// A Stacker password without a username is never sent: drop it.
	if (def.key === 'stacker') list = list.map(({ password, ...rest }) => (rest.username ? { ...rest, password } : rest));
	if (def.key === 'elegoo') list = list.map((it) => ({ ...it, name: it.name || 'Centauri Carbon 2' }));
	return { [def.listKey!]: list };
}
