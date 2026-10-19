// Every widget CatBoard can add, as data. The Add popup lists this catalog
// (search, categories) and opens the widget's settings form before adding it;
// the widget's edit modal opens the same form, so each option is defined once
// (src/lib/components/widget-settings). A form edits a draft made by
// `prepare` (defaults filled in so inputs can bind), and `normalize` turns the
// draft back into the stored config (clamped, defaults left out).
import type { Component } from 'svelte';
import type { DashboardItem, IntegrationsConfig, NavbarItem, StackerSections } from '$lib/types';
import type { GlyphName } from './glyphs';
import { isConfigured, type IntegrationKey } from '$lib/integrations/registry';
import { tr } from '$lib/i18n';
import { spoolmanOrder, spoolmanSections, SPOOLMAN_DEFAULT_ORDER } from './spoolman';
import ClockSettings from '$lib/components/widget-settings/ClockSettings.svelte';
import WeatherSettings from '$lib/components/widget-settings/WeatherSettings.svelte';
import NotesSettings from '$lib/components/widget-settings/NotesSettings.svelte';
import GroupSettings from '$lib/components/widget-settings/GroupSettings.svelte';
import SearchSettings from '$lib/components/widget-settings/SearchSettings.svelte';
import CpuSettings from '$lib/components/widget-settings/CpuSettings.svelte';
import DiskSettings from '$lib/components/widget-settings/DiskSettings.svelte';
import CalendarSettings from '$lib/components/widget-settings/CalendarSettings.svelte';
import ArrReleasesSettings from '$lib/components/widget-settings/ArrReleasesSettings.svelte';
import KumaSettings from '$lib/components/widget-settings/KumaSettings.svelte';
import DockerSettings from '$lib/components/widget-settings/DockerSettings.svelte';
import StackerSettings from '$lib/components/widget-settings/StackerSettings.svelte';
import AdGuardSettings from '$lib/components/widget-settings/AdGuardSettings.svelte';
import JellyseerrSettings from '$lib/components/widget-settings/JellyseerrSettings.svelte';
import QBittorrentSettings from '$lib/components/widget-settings/QBittorrentSettings.svelte';
import SpoolmanSettings from '$lib/components/widget-settings/SpoolmanSettings.svelte';
import PrintSettings from '$lib/components/widget-settings/PrintSettings.svelte';
import PsiTransferSettings from '$lib/components/widget-settings/PsiTransferSettings.svelte';
import JenkinsSettings from '$lib/components/widget-settings/JenkinsSettings.svelte';
import ProxmoxSettings from '$lib/components/widget-settings/ProxmoxSettings.svelte';
import PortainerSettings from '$lib/components/widget-settings/PortainerSettings.svelte';
import ImmichSettings from '$lib/components/widget-settings/ImmichSettings.svelte';
import NextcloudSettings from '$lib/components/widget-settings/NextcloudSettings.svelte';

export type WidgetTarget = 'grid' | 'navbar';
export type WidgetCategory = 'Basics' | 'System' | 'Monitoring' | 'Virtualisation' | 'Media' | 'Downloads' | 'Files' | 'Development' | '3D printing' | 'Network';
export const WIDGET_CATEGORIES: WidgetCategory[] = ['Basics', 'System', 'Monitoring', 'Virtualisation', 'Media', 'Downloads', 'Files', 'Development', '3D printing', 'Network'];

export type GridWidgetType = Exclude<DashboardItem['type'], 'service'>;
export type NavbarWidgetType = Exclude<NavbarItem['type'], 'navbar-title'>;

// Drafts are loose objects edited by the forms; normalize gives them their stored shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cfg = Record<string, any>;

export interface WidgetDef {
	id: string;
	name: string;
	description: string;
	icon: GlyphName;
	category: WidgetCategory;
	/** Connections it reads (any one of them is enough). */
	integrations?: IntegrationKey[];
	grid?: { type: GridWidgetType; colSpan: number; rowSpan: number; minColSpan?: number };
	navbar?: { type: NavbarWidgetType; colSpan: number };
	/** Settings form (absent: nothing to set). */
	settings?: Component<any>;
	settingsProps?: Record<string, unknown>;
	prepare?: (config: Cfg | undefined, target: WidgetTarget, connections: IntegrationsConfig) => Cfg;
	normalize?: (draft: Cfg, target: WidgetTarget) => Cfg;
	/** Why the widget cannot be added/saved yet (null: ready). */
	missing?: (draft: Cfg) => string | null;
	/** Groups store their title on the item, not in the config. */
	group?: boolean;
}

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
	const n = Math.round(Number(v));
	return Number.isFinite(n) && v !== '' && v != null ? Math.min(max, Math.max(min, n)) : fallback;
};
const ALL_SECTIONS: StackerSections = { cpu: true, memory: true, gpu: true, disk: true, network: true };
const arrSources = (c: Cfg | undefined, conn: IntegrationsConfig) =>
	c?.integrations
		? { radarr: !!c.integrations.radarr, sonarr: !!c.integrations.sonarr, lidarr: !!c.integrations.lidarr }
		: { radarr: !!conn.radarr?.url, sonarr: !!conn.sonarr?.url, lidarr: !!conn.lidarr?.url };

export const WIDGETS: WidgetDef[] = [
	// --- Basics ---
	{
		id: 'group-collapsible',
		name: 'Collapsible group',
		description: 'A titled box of tiles that folds away',
		icon: 'group',
		category: 'Basics',
		grid: { type: 'group-collapsible', colSpan: 6, rowSpan: 3, minColSpan: 2 },
		settings: GroupSettings,
		group: true,
		prepare: () => ({ title: '' })
	},
	{
		id: 'group-standard',
		name: 'Group',
		description: 'A box of tiles, with or without a header',
		icon: 'panel',
		category: 'Basics',
		grid: { type: 'group-standard', colSpan: 6, rowSpan: 3, minColSpan: 2 },
		settings: GroupSettings,
		settingsProps: { compactOption: true },
		group: true,
		prepare: () => ({ title: '', compact: false })
	},
	{
		id: 'clock',
		name: 'Clock',
		description: 'Time and date',
		icon: 'clock',
		category: 'Basics',
		grid: { type: 'clock', colSpan: 2, rowSpan: 1 },
		navbar: { type: 'navbar-clock', colSpan: 2 },
		settings: ClockSettings,
		prepare: (c) => ({ showSeconds: c?.showSeconds ?? false, format12h: c?.format12h ?? false, showDate: c?.showDate ?? true, dateFormat: c?.dateFormat ?? 'DD/MM', showFullDate: c?.showFullDate ?? false }),
		normalize: (d) => ({ showSeconds: !!d.showSeconds, format12h: !!d.format12h, showDate: !!d.showDate, dateFormat: d.dateFormat === 'MM/DD' ? 'MM/DD' : 'DD/MM', showFullDate: !!d.showFullDate })
	},
	{
		id: 'weather',
		name: 'Weather',
		description: 'Current temperature for a city (Open-Meteo)',
		icon: 'weather',
		category: 'Basics',
		grid: { type: 'weather', colSpan: 2, rowSpan: 1 },
		navbar: { type: 'navbar-weather', colSpan: 2 },
		settings: WeatherSettings,
		prepare: (c) => ({ location: c?.location ?? null }),
		normalize: (d) => ({ location: d.location ?? undefined })
	},
	{
		id: 'calendar',
		name: 'Calendar',
		description: 'Month view, with upcoming Radarr / Sonarr / Lidarr releases',
		icon: 'calendar',
		category: 'Basics',
		grid: { type: 'calendar', colSpan: 4, rowSpan: 2, minColSpan: 2 },
		settings: CalendarSettings,
		prepare: (c, _t, conn) => ({ integrations: arrSources(c, conn) }),
		normalize: (d) => ({ integrations: { radarr: !!d.integrations.radarr, sonarr: !!d.integrations.sonarr, lidarr: !!d.integrations.lidarr } })
	},
	{
		id: 'notes',
		name: 'Notes',
		description: 'A Markdown notepad, edited on the tile',
		icon: 'notes',
		category: 'Basics',
		grid: { type: 'notes', colSpan: 4, rowSpan: 3, minColSpan: 2 },
		settings: NotesSettings,
		// The text itself is edited on the tile; the saved config keeps it.
		prepare: (c) => ({ title: c?.title ?? '' }),
		normalize: (d) => ({ title: String(d.title ?? '').trim() || undefined })
	},
	{
		id: 'search',
		name: 'Search',
		description: 'Search every dashboard, or the web',
		icon: 'search',
		category: 'Basics',
		navbar: { type: 'navbar-search', colSpan: 3 },
		settings: SearchSettings,
		prepare: (c) => ({ placeholder: c?.placeholder ?? 'Search services...' }),
		normalize: (d) => ({ placeholder: String(d.placeholder ?? '') })
	},

	// --- System (the machine CatBoard runs on) ---
	{
		id: 'cpu',
		name: 'CPU',
		description: 'Load and temperature of the CatBoard host',
		icon: 'cpu',
		category: 'System',
		navbar: { type: 'navbar-cpu', colSpan: 2 },
		settings: CpuSettings,
		prepare: (c) => ({ tempSensor: c?.tempSensor ?? '' }),
		normalize: (d) => ({ tempSensor: d.tempSensor || undefined })
	},
	{
		id: 'ram',
		name: 'RAM',
		description: 'Memory and swap of the CatBoard host',
		icon: 'ram',
		category: 'System',
		navbar: { type: 'navbar-ram', colSpan: 2 }
	},
	{
		id: 'disk',
		name: 'Disk',
		description: 'Disk usage of the CatBoard host',
		icon: 'disk',
		category: 'System',
		navbar: { type: 'navbar-disk', colSpan: 2 },
		settings: DiskSettings,
		prepare: (c) => ({ disks: [...(c?.disks ?? [])], pageIndicatorSide: c?.pageIndicatorSide ?? 'left' }),
		normalize: (d) => ({ disks: d.disks, pageIndicatorSide: d.pageIndicatorSide === 'right' ? 'right' : 'left' })
	},

	// --- Monitoring ---
	{
		id: 'uptime-kuma',
		name: 'Uptime Kuma status page',
		description: 'Monitors of a status page with their uptime',
		icon: 'kuma',
		category: 'Monitoring',
		integrations: ['uptimeKuma'],
		grid: { type: 'uptime-kuma-status-page', colSpan: 4, rowSpan: 2 },
		navbar: { type: 'navbar-uptime-kuma-status-page', colSpan: 2 },
		settings: KumaSettings,
		prepare: (c) => ({ slug: c?.slug ?? '' }),
		normalize: (d) => ({ slug: String(d.slug ?? '').trim() }),
		missing: (d) => (String(d.slug ?? '').trim() ? null : tr('widgetDef.needSlug'))
	},
	{
		id: 'docker',
		name: 'Docker containers',
		description: 'Running and stopped containers, optional CPU / RAM',
		icon: 'docker',
		category: 'Monitoring',
		integrations: ['docker'],
		grid: { type: 'docker', colSpan: 4, rowSpan: 2 },
		navbar: { type: 'navbar-docker', colSpan: 2 },
		settings: DockerSettings,
		prepare: (c, _t, conn) => ({ environmentId: c?.environmentId ?? (c ? '' : (conn.docker?.environments?.[0]?.id ?? '')), showCpu: c?.showCpu ?? false, showRam: c?.showRam ?? false }),
		normalize: (d) => ({ environmentId: d.environmentId, showCpu: d.showCpu || undefined, showRam: d.showRam || undefined }),
		missing: (d) => (d.environmentId ? null : tr('widgetDef.needEnvironment'))
	},
	{
		id: 'stacker',
		name: 'Stacker',
		description: 'Live hardware gauges and graphs of a server',
		icon: 'stacker',
		category: 'Monitoring',
		integrations: ['stacker'],
		grid: { type: 'stacker', colSpan: 4, rowSpan: 4, minColSpan: 2 },
		settings: StackerSettings,
		prepare: (c, _t, conn) => ({ serverId: c?.serverId ?? conn.stacker?.servers?.[0]?.id ?? '', sections: { ...ALL_SECTIONS, ...c?.sections }, graphs: c?.graphs ?? true, totals: c?.totals ?? true }),
		normalize: (d) => ({ serverId: d.serverId, sections: { ...d.sections }, graphs: !!d.graphs, totals: !!d.totals }),
		missing: (d) => (d.serverId ? null : tr('widgetDef.needServer'))
	},

	// --- Virtualisation ---
	{
		id: 'proxmox',
		name: 'Proxmox VE',
		description: 'Node load, VMs and containers; start and stop guests',
		icon: 'server',
		category: 'Virtualisation',
		integrations: ['proxmox'],
		grid: { type: 'proxmox', colSpan: 4, rowSpan: 3, minColSpan: 3 },
		navbar: { type: 'navbar-proxmox', colSpan: 2 },
		settings: ProxmoxSettings,
		prepare: (c, _t, conn) => ({
			clusterId: c?.clusterId ?? (c ? '' : (conn.proxmox?.clusters?.[0]?.id ?? '')),
			node: c?.node ?? '',
			kind: c?.kind ?? 'all',
			hideStopped: c?.hideStopped ?? false,
			showNodes: c?.showNodes ?? true
		}),
		normalize: (d) => ({
			clusterId: d.clusterId,
			node: d.node || undefined,
			kind: d.kind === 'all' ? undefined : d.kind,
			hideStopped: d.hideStopped || undefined,
			showNodes: d.showNodes ? undefined : false
		}),
		missing: (d) => (d.clusterId ? null : tr('widgetDef.needCluster'))
	},
	{
		id: 'portainer',
		name: 'Portainer stacks',
		description: 'Containers per environment and stacks; start and stop stacks',
		icon: 'stacks',
		category: 'Virtualisation',
		integrations: ['portainer'],
		grid: { type: 'portainer', colSpan: 4, rowSpan: 3, minColSpan: 3 },
		settings: PortainerSettings,
		prepare: (c) => ({ endpointId: c?.endpointId ?? '' }),
		normalize: (d) => ({ endpointId: d.endpointId || undefined })
	},

	// --- Network ---
	{
		id: 'adguard-stats',
		name: 'AdGuard Home stats',
		description: 'Queries, blocked share and processing time',
		icon: 'shieldStats',
		category: 'Network',
		integrations: ['adguardHome'],
		grid: { type: 'adguard-home', colSpan: 4, rowSpan: 2 },
		prepare: (c) => ({ instanceId: c?.instanceId ?? 'default' }),
		normalize: (d) => ({ instanceId: d.instanceId || 'default' })
	},
	{
		id: 'adguard-control',
		name: 'AdGuard Home control',
		description: 'Protection on / off and timed pauses',
		icon: 'shield',
		category: 'Network',
		integrations: ['adguardHome'],
		grid: { type: 'adguard-home-control', colSpan: 4, rowSpan: 2 },
		navbar: { type: 'navbar-adguard-home-control', colSpan: 2 },
		settings: AdGuardSettings,
		prepare: (c) => ({ instanceId: c?.instanceId ?? 'default', align: c?.align ?? 'center' }),
		normalize: (d, target) => ({ instanceId: d.instanceId || 'default', align: target === 'navbar' ? d.align : undefined })
	},

	// --- Media ---
	{
		id: 'arr-releases',
		name: 'New releases',
		description: 'Recently released movies, episodes and albums',
		icon: 'releases',
		category: 'Media',
		integrations: ['radarr', 'sonarr', 'lidarr'],
		grid: { type: 'arr-releases', colSpan: 4, rowSpan: 3 },
		settings: ArrReleasesSettings,
		prepare: (c, _t, conn) => ({ integrations: arrSources(c, conn), days: c?.days ?? 14, limit: c?.limit ?? 10, onlyDownloaded: c?.onlyDownloaded ?? false }),
		normalize: (d) => ({
			integrations: { radarr: !!d.integrations.radarr, sonarr: !!d.integrations.sonarr, lidarr: !!d.integrations.lidarr },
			days: clamp(d.days, 1, 90, 14),
			limit: clamp(d.limit, 1, 50, 10),
			onlyDownloaded: !!d.onlyDownloaded
		})
	},
	{
		id: 'jellyfin-latest',
		name: 'Jellyfin latest',
		description: 'Recently added movies and shows',
		icon: 'jellyfin',
		category: 'Media',
		integrations: ['jellyfin'],
		grid: { type: 'jellyfin-latest', colSpan: 4, rowSpan: 3 },
		prepare: (c) => ({ ...c, instanceId: c?.instanceId ?? 'default', limit: c?.limit ?? 5 })
	},
	{
		id: 'jellyfin-now-playing',
		name: 'Jellyfin now playing',
		description: 'Who is watching what, direct play or transcode',
		icon: 'nowPlaying',
		category: 'Media',
		integrations: ['jellyfin'],
		grid: { type: 'jellyfin-now-playing', colSpan: 4, rowSpan: 3, minColSpan: 2 }
	},
	{
		id: 'jellyseerr-requests',
		name: 'Media requests',
		description: 'Jellyseerr / Overseerr requests, approve or decline',
		icon: 'requests',
		category: 'Media',
		integrations: ['jellyseerr'],
		grid: { type: 'jellyseerr-requests', colSpan: 4, rowSpan: 4, minColSpan: 2 },
		settings: JellyseerrSettings,
		prepare: (c) => ({ filter: c?.filter ?? 'pending', limit: c?.limit ?? 8 }),
		normalize: (d) => ({ filter: d.filter === 'all' ? 'all' : 'pending', limit: clamp(d.limit, 1, 30, 8) })
	},

	// --- Downloads ---
	{
		id: 'qbittorrent',
		name: 'qBittorrent',
		description: 'Speeds with a live graph, busiest torrents',
		icon: 'download',
		category: 'Downloads',
		integrations: ['qbittorrent'],
		grid: { type: 'qbittorrent', colSpan: 4, rowSpan: 4, minColSpan: 2 },
		settings: QBittorrentSettings,
		prepare: (c) => ({ filter: c?.filter ?? 'active', limit: c?.limit ?? 8 }),
		normalize: (d) => ({ filter: d.filter, limit: clamp(d.limit, 1, 50, 8) })
	},

	// --- Files ---
	{
		id: 'psitransfer',
		name: 'PsiTransfer',
		description: 'Drop files (or click) to share them, get the link',
		icon: 'upload',
		category: 'Files',
		integrations: ['psitransfer'],
		grid: { type: 'psitransfer', colSpan: 4, rowSpan: 2, minColSpan: 2 },
		settings: PsiTransferSettings,
		prepare: (c) => ({ retention: c?.retention ?? '', askOptions: c?.askOptions ?? true, history: c?.history ?? 5 }),
		normalize: (d) => ({ retention: d.retention || undefined, askOptions: d.askOptions ? undefined : false, history: clamp(d.history, 0, 10, 5) })
	},

	// --- Development ---
	{
		id: 'immich',
		name: 'Immich',
		description: 'Photo library statistics and the latest photos',
		icon: 'photos',
		category: 'Files',
		integrations: ['immich'],
		grid: { type: 'immich', colSpan: 4, rowSpan: 2, minColSpan: 2 },
		settings: ImmichSettings,
		prepare: (c) => ({ showStats: c?.showStats ?? true, photos: c?.photos ?? 8 }),
		normalize: (d) => ({ showStats: d.showStats ? undefined : false, photos: clamp(d.photos, 0, 24, 8) })
	},
	{
		id: 'nextcloud',
		name: 'Nextcloud',
		description: 'Storage quota, server info and recent files',
		icon: 'cloud',
		category: 'Files',
		integrations: ['nextcloud'],
		grid: { type: 'nextcloud', colSpan: 4, rowSpan: 3, minColSpan: 2 },
		settings: NextcloudSettings,
		prepare: (c) => ({ showQuota: c?.showQuota ?? true, showServer: c?.showServer ?? false, files: c?.files ?? 6 }),
		normalize: (d) => ({ showQuota: d.showQuota ? undefined : false, showServer: d.showServer || undefined, files: clamp(d.files, 0, 20, 6) })
	},
	{
		id: 'jenkins',
		name: 'Jenkins',
		description: 'Latest builds of a project or of all, start a build',
		icon: 'jenkins',
		category: 'Development',
		integrations: ['jenkins'],
		grid: { type: 'jenkins', colSpan: 4, rowSpan: 3, minColSpan: 2 },
		navbar: { type: 'navbar-jenkins', colSpan: 2 },
		settings: JenkinsSettings,
		prepare: (c) => ({ mode: c?.job ? 'job' : 'all', job: c?.job ?? '', limit: c?.limit ?? 8 }),
		normalize: (d) => ({ job: d.mode === 'job' ? d.job || undefined : undefined, limit: clamp(d.limit, 1, 50, 8) }),
		missing: (d) => (d.mode === 'job' && !d.job ? tr('widgetDef.needProject') : null)
	},

	// --- 3D printing ---
	{
		id: 'spoolman',
		name: 'Spoolman',
		description: 'Available spools, recently used, running low',
		icon: 'spool',
		category: '3D printing',
		integrations: ['spoolman'],
		grid: { type: 'spoolman', colSpan: 4, rowSpan: 4, minColSpan: 2 },
		settings: SpoolmanSettings,
		prepare: (c) => {
			const s = spoolmanSections(c);
			return {
				title: c?.title ?? '',
				showRecent: s.recent,
				showLow: s.low,
				showOnly: s.only,
				sort: c?.sort ?? 'name',
				order: spoolmanOrder(c),
				limit: c?.limit ?? 5,
				lowPercent: c?.lowPercent ?? 15,
				lowGrams: c?.lowGrams ?? 0,
				includeArchived: c?.includeArchived ?? false
			};
		},
		normalize: (d) => {
			const canOnly = d.showRecent || d.showLow;
			return {
				title: String(d.title ?? '').trim() || undefined,
				show: undefined,
				showRecent: d.showRecent || undefined,
				showLow: d.showLow || undefined,
				showOnly: (canOnly && d.showOnly) || undefined,
				sort: d.sort === 'name' ? undefined : d.sort,
				order: d.order.join() === SPOOLMAN_DEFAULT_ORDER.join() ? undefined : [...d.order],
				limit: clamp(d.limit, 1, 50, 5),
				lowPercent: clamp(d.lowPercent, 0, 100, 15),
				lowGrams: clamp(d.lowGrams, 0, 100000, 0) || undefined,
				includeArchived: d.includeArchived || undefined
			};
		}
	},
	{
		id: 'elegoo-print',
		name: '3D print status',
		description: 'Centauri Carbon 2: progress, layers, temperatures',
		icon: 'printer',
		category: '3D printing',
		integrations: ['elegoo'],
		grid: { type: 'elegoo-print', colSpan: 4, rowSpan: 3, minColSpan: 2 },
		navbar: { type: 'navbar-elegoo-print', colSpan: 2 },
		settings: PrintSettings,
		prepare: (c, _t, conn) => ({ printerId: c?.printerId ?? conn.elegoo?.printers?.[0]?.id ?? '', showThumbnail: c?.showThumbnail ?? true, showTemps: c?.showTemps ?? true }),
		normalize: (d) => ({ printerId: d.printerId, showThumbnail: !!d.showThumbnail, showTemps: !!d.showTemps }),
		missing: (d) => (d.printerId ? null : tr('widgetDef.needPrinter'))
	}
];

/** The catalog entry of a grid or navbar item type. */
export function widgetForType(type: string): WidgetDef | undefined {
	return WIDGETS.find((w) => w.grid?.type === type || w.navbar?.type === type);
}

/** Draft for a form: the widget's prepare, or a copy of the config. */
export function draftFor(def: WidgetDef, config: Cfg | undefined, target: WidgetTarget, connections: IntegrationsConfig): Cfg {
	// JSON copy: configs are plain JSON, and may arrive as reactive proxies.
	const copy = config ? (JSON.parse(JSON.stringify(config)) as Cfg) : undefined;
	return def.prepare ? def.prepare(copy, target, connections) : { ...copy };
}

/** Stored config from a draft. */
export function configFrom(def: WidgetDef, draft: Cfg, target: WidgetTarget): Cfg {
	return def.normalize ? def.normalize(draft, target) : { ...draft };
}

/** Connections the widget needs that are missing (empty: ready to use). */
export function missingConnections(def: WidgetDef, connections: IntegrationsConfig): IntegrationKey[] {
	if (!def.integrations?.length) return [];
	return def.integrations.some((k) => isConfigured(k, connections)) ? [] : def.integrations;
}
