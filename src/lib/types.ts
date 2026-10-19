// --- Service ---

export interface Service {
	id: string;
	name: string;
	url: string;
	icon: string;
	description: string;
	statusCheck: { enabled: boolean; method: string };
}

// --- Grid ---

export interface Breakpoint {
	id: string;
	name: string;
	minWidth: number;
	columns: number;
}

export interface GridConfig {
	cellSize: number;
	gap: number;
	breakpoints: Breakpoint[];
}

// --- Dashboard Items ---

export interface DashboardItemBase {
	id: string;
	col: number;
	row: number;
	colSpan: number;
	rowSpan: number;
}

export interface ServiceItem extends DashboardItemBase {
	type: 'service';
	serviceId: string;
}

/** A group either keeps its size (default) or lets its content grow and scroll along one axis. */
export type GroupScroll = 'vertical' | 'horizontal';

export interface CollapsibleGroupItem extends DashboardItemBase {
	type: 'group-collapsible';
	title: string;
	children: DashboardItem[];
	config?: { outlineColor?: string; scroll?: GroupScroll };
}

export interface StandardGroupItem extends DashboardItemBase {
	type: 'group-standard';
	title: string;
	children: DashboardItem[];
	config?: { compact?: boolean; outlineColor?: string; scroll?: GroupScroll };
}

export interface CalendarConfig {
	integrations?: {
		radarr?: boolean;
		sonarr?: boolean;
		lidarr?: boolean;
	};
}

export interface CalendarItem extends DashboardItemBase {
	type: 'calendar';
	config?: CalendarConfig;
}

export interface ArrReleasesConfig {
	integrations?: {
		radarr?: boolean;
		sonarr?: boolean;
		lidarr?: boolean;
	};
	days?: number;
	limit?: number;
	onlyDownloaded?: boolean;
}

export interface ArrReleasesItem extends DashboardItemBase {
	type: 'arr-releases';
	config?: ArrReleasesConfig;
}

// --- Stacker ---

export interface StackerSections {
	cpu: boolean;
	memory: boolean;
	gpu: boolean;
	disk: boolean;
	network: boolean;
}

export interface StackerConfig {
	serverId: string;
	sections?: StackerSections;
	graphs?: boolean;
	totals?: boolean;
}

export interface StackerItem extends DashboardItemBase {
	type: 'stacker';
	config?: StackerConfig;
}

export interface ClockConfig {
	showSeconds?: boolean;
	format12h?: boolean;
	showDate?: boolean;
	dateFormat?: 'DD/MM' | 'MM/DD';
	showFullDate?: boolean;
}

export interface ClockItem extends DashboardItemBase {
	type: 'clock';
	config?: ClockConfig;
}

// --- Uptime Kuma ---

export interface UptimeKumaStatusPageConfig {
	slug: string;
}

export interface UptimeKumaStatusPageItem extends DashboardItemBase {
	type: 'uptime-kuma-status-page';
	config: UptimeKumaStatusPageConfig;
}

export interface UptimeKumaMonitor {
	id: number;
	name: string;
	status: number;
	uptime24h: number;
}

export interface UptimeKumaStatusPageData {
	slug: string;
	title: string;
	monitors: UptimeKumaMonitor[];
	activeCount: number;
	inactiveCount: number;
	overallUptime: number;
}

export type DashboardItem = ProxmoxItem | PortainerItem | ImmichItem | NextcloudItem | GiteaItem | ServiceItem | CollapsibleGroupItem | StandardGroupItem | CalendarItem | ClockItem | WeatherItem | UptimeKumaStatusPageItem | DockerItem | AdGuardHomeItem | AdGuardHomeControlItem | JellyfinLatestItem | ArrReleasesItem | StackerItem | JellyfinNowPlayingItem | JellyseerrRequestsItem | QBittorrentItem | NotesItem | SpoolmanItem | ElegooPrintItem | JenkinsItem | PsiTransferItem;

// --- Weather ---

export interface WeatherLocation {
	name: string;
	latitude: number;
	longitude: number;
	zipcode?: string;
	country?: string;
}

export interface WeatherConfig {
	location?: WeatherLocation;
}

export interface WeatherItem extends DashboardItemBase {
	type: 'weather';
	config?: WeatherConfig;
}

// --- Layout ---

export interface NavbarItemBase {
	id: string;
	col: number;
	colSpan: number;
	/** Icon / graphic size in percent (default 100). */
	iconScale?: number;
	/** Text size in percent (default 100). */
	textScale?: number;
}

export interface NavbarTitleItem extends NavbarItemBase {
	type: 'navbar-title';
}

export interface NavbarSearchItem extends NavbarItemBase {
	type: 'navbar-search';
	placeholder?: string;
}

export interface NavbarCpuItem extends NavbarItemBase {
	type: 'navbar-cpu';
	config?: { tempSensor?: string };
}

export interface NavbarRamItem extends NavbarItemBase {
	type: 'navbar-ram';
}

export interface NavbarDiskItem extends NavbarItemBase {
	type: 'navbar-disk';
	config: { disks: string[]; pageIndicatorSide?: 'left' | 'right' };
}

export interface NavbarUptimeKumaStatusPageItem extends NavbarItemBase {
	type: 'navbar-uptime-kuma-status-page';
	config: UptimeKumaStatusPageConfig;
}

export interface NavbarClockItem extends NavbarItemBase {
	type: 'navbar-clock';
	config?: ClockConfig;
}

export interface NavbarWeatherItem extends NavbarItemBase {
	type: 'navbar-weather';
	config?: WeatherConfig;
}

export type NavbarItem = NavbarProxmoxItem | NavbarTitleItem | NavbarSearchItem | NavbarCpuItem | NavbarRamItem | NavbarDiskItem | NavbarUptimeKumaStatusPageItem | NavbarDockerItem | NavbarAdGuardHomeItem | NavbarAdGuardHomeControlItem | NavbarClockItem | NavbarWeatherItem | NavbarElegooPrintItem | NavbarJenkinsItem;

export interface NavbarLayout {
	columns: number;
	items: NavbarItem[];
	/** Minimum row height in px (default 44). */
	rowHeight?: number;
	/** Space above / below the navbar in px (default 8). */
	marginTop?: number;
	marginBottom?: number;
}

export interface PerBreakpointLayout {
	items: DashboardItem[];
	navbar: NavbarLayout;
	/** Grid of this dashboard at this breakpoint (missing values: the global defaults). */
	grid?: { cellSize?: number; gap?: number };
}

/** A dashboard: its own grid items and navbar for every breakpoint. */
export interface DashboardMeta {
	id: string;
	name: string;
}

export interface Layout {
	grid: GridConfig;
	/**
	 * Per-breakpoint layouts. In layout.json these belong to the "main"
	 * dashboard; the API returns the requested dashboard's layouts here, so the
	 * client always works on "the" layout of the active dashboard.
	 */
	layouts: Record<string, PerBreakpointLayout>;
	/** Order and names of the dashboards (absent: just "main"). */
	dashboards?: DashboardMeta[];
	/** Storage of the other dashboards' layouts, by dashboard id (server side only). */
	pages?: Record<string, Record<string, PerBreakpointLayout>>;
	/** Id of the dashboard whose layouts were returned (API reads). */
	dashboard?: string;
}

// --- Styling ---

export interface CustomPalette {
	bgPrimary: string;
	bgSecondary: string;
	bgCard: string;
	bgCardHover: string;
	bgModal: string;
	textPrimary: string;
	textSecondary: string;
	textMuted: string;
	accent: string;
	accentHover: string;
	danger: string;
	success: string;
	warning: string;
	border: string;
	borderLight: string;
}

// --- Settings ---

export interface Settings {
	title: string;
	theme: string;
	customPalette?: CustomPalette;
	background: { type: string; value: string };
	stylePreset: 'default' | 'sharp' | 'pill';
	animations: 'none' | 'subtle' | 'full';
	scrollbarStyle: 'thin' | 'hidden' | 'wide';
	navbar: { columns: number };
	statusCheckInterval: number;
	layout: GridConfig;
	/** Theme 'auto': presets used when the system is dark / light. */
	autoDark?: string;
	autoLight?: string;
	/** Corner radius in px; overrides the style preset when set. */
	radius?: number;
	/** Accent colour on top of the theme. */
	accent?: string;
	/** Google Fonts family name; system font when empty. */
	font?: string;
	/** Text size in percent (90-120). */
	fontScale?: number;
	/** Card opacity in percent (40-100) and backdrop blur in px (0-20). */
	cardOpacity?: number;
	cardBlur?: number;
	/** The user's own CSS, added after the theme. */
	customCss?: string;
	/** Interface language: 'auto' (browser) when unset. */
	language?: 'auto' | 'en' | 'fr';
}

// --- Status ---

export interface ServiceStatus {
	[id: string]: 'online' | 'offline' | 'error' | 'checking';
}

// --- System Stats ---

export interface CpuStats {
	usage: number;
	temperature: number | null;
	cores: number;
	tempSensors?: { [sensor: string]: number };
}

export interface RamStats {
	total: number;
	used: number;
	swapTotal: number;
	swapUsed: number;
}

export interface DiskStats {
	[path: string]: { total: number; used: number };
}

export interface SystemStats {
	cpu: CpuStats;
	ram: RamStats;
	disks: DiskStats;
}

// --- Integrations ---

export interface ArrConnection {
	url: string;
	apiKey: string;
}

export interface IntegrationsConfig {
	uptimeKuma?: { url: string };
	docker?: { environments: DockerEnvironment[] };
	radarr?: ArrConnection;
	sonarr?: ArrConnection;
	lidarr?: ArrConnection;
	adguardHome?: { url: string; username: string; password: string };
	jellyfin?: ArrConnection;
	stacker?: { servers: StackerServer[] };
	/** Jellyseerr or Overseerr (same API). */
	jellyseerr?: ArrConnection;
	qbittorrent?: { url: string; username: string; password: string };
	spoolman?: { url: string };
	elegoo?: { printers: ElegooPrinter[] };
	/** url: address used by the server; publicUrl: base of the share links (default: url). */
	psitransfer?: { url: string; publicUrl?: string; uploadPassword?: string };
	/** url: address used by the server; publicUrl: base of the links shown (default: url). */
	jenkins?: { url: string; publicUrl?: string; username: string; apiToken: string };
	/** Toggle fields ("Skip TLS verification") are stored as the string "true". */
	proxmox?: { clusters: ProxmoxCluster[] };
	portainer?: { url: string; publicUrl?: string; apiKey: string; insecure?: string };
	immich?: { url: string; publicUrl?: string; apiKey: string };
	nextcloud?: { url: string; publicUrl?: string; username: string; appPassword: string };
	/** Gitea or Forgejo (same API). */
	gitea?: { url: string; publicUrl?: string; apiToken: string };
}

/** A Proxmox VE node or cluster, read with an API token. */
export interface ProxmoxCluster {
	id: string;
	name: string;
	url: string;
	/** "user@realm!tokenname" */
	tokenId: string;
	tokenSecret: string;
	insecure?: string;
}

/** A Stacker (web task manager) instance polled by the Stacker widget. */
export interface StackerServer {
	id: string;
	name: string;
	url: string;
	/** Optional basic-auth credentials, for a Stacker behind a reverse-proxy login. */
	username?: string;
	password?: string;
}

// Subset of Stacker's /api/snapshot payload used by the widget.
export interface StackerStatic {
	sys: { hostname: string; platform: string; kernel: string };
	cpu: { model: string; threads: number; maxMHz: number };
	mem: { total: number; swapTotal: number };
	gpus: { index: number; name: string; memTotal: number; powerLimitW: number }[] | null;
	disks: { name: string; model: string; size: number; rotational: boolean }[] | null;
	nics: { name: string; speedMbs: number }[] | null;
}

export interface StackerSample {
	t: number;
	cpu: { total: number | null; cores: number[] | null; freqMHz: number; tempC: number | null; load1: number; load5: number; load15: number };
	mem: { total: number; used: number; available: number; free: number; swapTotal: number; swapUsed: number; percent: number };
	gpus: { index: number; util: number; memUsed: number; memTotal: number; tempC: number | null; powerW: number | null }[] | null;
	disks: { name: string; readBps: number | null; writeBps: number | null; busy: number | null; readTot: number; writeTot: number }[] | null;
	nics: { name: string; rxBps: number | null; txBps: number | null; rxTotal: number; txTotal: number }[] | null;
	procs: { processes: number; threads: number };
}

export interface StackerSnapshot {
	interval: number;
	static?: StackerStatic;
	samples: StackerSample[];
}

export interface DockerEnvironment {
	id: string;
	name: string;
	url: string;
}

export interface DockerContainerInfo {
	id: string;
	name: string;
	status: 'running' | 'stopped' | 'paused' | 'restarting' | 'dead';
	image: string;
	/** Only present when a widget of this environment asked for stats. */
	cpuPercent?: number; // like `docker stats`: 100 % = one full core
	memUsage?: number; // bytes, page cache excluded
	memLimit?: number;
}

export interface DockerEnvironmentData {
	environmentId: string;
	name: string;
	containers: DockerContainerInfo[];
	runningCount: number;
	stoppedCount: number;
	/** Totals over running containers, when stats were collected. */
	stats?: { cpuPercent: number; memUsage: number };
}

export interface ArrCalendarEntry {
	id: string;
	type: 'radarr' | 'sonarr' | 'lidarr';
	title: string;
	subtitle?: string;
	date: string;
	hasFile: boolean;
	posterUrl?: string;
}

export interface ArrCalendarData {
	entries: ArrCalendarEntry[];
	updatedAt: number;
}

export interface DockerWidgetConfig {
	environmentId: string;
	showCpu?: boolean;
	showRam?: boolean;
}

export interface DockerItem extends DashboardItemBase {
	type: 'docker';
	config: DockerWidgetConfig;
}

export interface NavbarDockerItem extends NavbarItemBase {
	type: 'navbar-docker';
	config: DockerWidgetConfig;
}

// --- AdGuard Home ---

export interface AdGuardHomeConfig {
	instanceId: string;
	align?: 'left' | 'center' | 'right';
}

export interface AdGuardHomeData {
	instanceId: string;
	protectionEnabled: boolean;
	pausedUntil?: number;
	stats: {
		dnsQueries: number;
		blockedQueries: number;
		blockedDomains: number;
		avgProcessingTime: number;
	};
}

export interface AdGuardHomeItem extends DashboardItemBase {
	type: 'adguard-home';
	config: AdGuardHomeConfig;
}

export interface AdGuardHomeControlItem extends DashboardItemBase {
	type: 'adguard-home-control';
	config: AdGuardHomeConfig;
}

export interface NavbarAdGuardHomeItem extends NavbarItemBase {
	type: 'navbar-adguard-home';
	config: AdGuardHomeConfig;
}

export interface NavbarAdGuardHomeControlItem extends NavbarItemBase {
	type: 'navbar-adguard-home-control';
	config: AdGuardHomeConfig;
}

// --- Jellyfin ---

export interface JellyfinLatestConfig {
	instanceId: string;
	userId?: string;
	limit?: number;
}

export interface JellyfinMediaItem {
	id: string;
	name: string;
	overview: string;
	type: string;
	dateCreated: string;
	imageUrl?: string;
	backdropUrl?: string;
}

export interface JellyfinLatestData {
	instanceId: string;
	items: JellyfinMediaItem[];
	updatedAt: number;
}

export interface JellyfinLatestItem extends DashboardItemBase {
	type: 'jellyfin-latest';
	config?: JellyfinLatestConfig;
}

// --- Jellyfin: now playing ---

export interface JellyfinSession {
	id: string;
	user: string;
	device: string;
	client: string;
	title: string;
	subtitle: string; // series name, album, or empty
	mediaType: string;
	positionSec: number;
	runtimeSec: number;
	paused: boolean;
	playMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
	transcodeInfo: string; // e.g. "HEVC → H264, 8 Mbps (codec not supported)"
	imageUrl?: string;
}

export interface JellyfinNowPlayingItem extends DashboardItemBase {
	type: 'jellyfin-now-playing';
	config?: Record<string, never>;
}

// --- Jellyseerr / Overseerr ---

export type JellyseerrStatus = 'pending' | 'approved' | 'declined' | 'processing' | 'available' | 'failed';

export interface JellyseerrRequest {
	id: number;
	title: string;
	year: string;
	posterUrl?: string;
	mediaType: 'movie' | 'tv';
	requestedBy: string;
	createdAt: string; // ISO date
	status: JellyseerrStatus;
}

export interface JellyseerrData {
	counts: { pending: number; approved: number; processing: number; available: number };
	requests: JellyseerrRequest[];
}

export interface JellyseerrRequestsConfig {
	filter?: 'pending' | 'all';
	limit?: number;
}

export interface JellyseerrRequestsItem extends DashboardItemBase {
	type: 'jellyseerr-requests';
	config?: JellyseerrRequestsConfig;
}

// --- qBittorrent ---

export type TorrentState = 'downloading' | 'seeding' | 'paused' | 'queued' | 'checking' | 'stalled' | 'error' | 'completed';

export interface Torrent {
	hash: string;
	name: string;
	progress: number; // 0..1
	state: TorrentState;
	dlSpeed: number; // bytes/s
	upSpeed: number;
	eta: number; // seconds, -1 when unknown
	size: number;
	ratio: number;
}

export interface QBittorrentData {
	dlSpeed: number;
	upSpeed: number;
	counts: Record<TorrentState, number>;
	total: number;
	torrents: Torrent[];
}

export interface QBittorrentConfig {
	filter?: 'active' | 'all' | 'downloading' | 'seeding';
	limit?: number;
}

export interface QBittorrentItem extends DashboardItemBase {
	type: 'qbittorrent';
	config?: QBittorrentConfig;
}

// --- Notes ---

export interface NotesConfig {
	title?: string;
	content?: string; // Markdown
}

export interface NotesItem extends DashboardItemBase {
	type: 'notes';
	config?: NotesConfig;
}

// --- Spoolman ---

export interface SpoolInfo {
	id: number;
	name: string;
	vendor: string;
	material: string;
	/** CSS colours (#rrggbb); several for multi-colour filaments. */
	colors: string[];
	remaining: number | null; // grams
	initial: number | null; // grams
	percent: number | null; // 0..100
	lastUsed: string | null; // ISO date
	location: string;
	archived: boolean;
}

export interface SpoolmanData {
	url: string; // Spoolman web UI, for links
	/** Spools with filament left (sorted as asked), for the main list. */
	available: SpoolInfo[];
	recent: SpoolInfo[];
	low: SpoolInfo[];
	empty: SpoolInfo[];
	total: number;
}

export type SpoolmanSection = 'list' | 'recent' | 'low';

export interface SpoolmanConfig {
	title?: string;
	/** Extra sections under the spool list. */
	showRecent?: boolean;
	showLow?: boolean;
	/** Only the enabled sections, without the spool list. */
	showOnly?: boolean;
	/** Order of the spool list. */
	sort?: 'name' | 'remaining' | 'lastUsed';
	/** Display order of the blocks (default: list, recent, low). */
	order?: SpoolmanSection[];
	/** @deprecated before V2.9: which lists to show (migrated to showRecent / showLow / showOnly). */
	show?: 'recent' | 'low' | 'both';
	limit?: number;
	/** "Running low" below this share of the initial weight (default 15). */
	lowPercent?: number;
	/** ...or below this many grams. */
	lowGrams?: number;
	/** Count archived spools that still have filament / show archived empty ones. */
	includeArchived?: boolean;
}

export interface SpoolmanItem extends DashboardItemBase {
	type: 'spoolman';
	config?: SpoolmanConfig;
}

// --- Elegoo Centauri Carbon 2 ---

/** A CC2 printer on the LAN (MQTT broker on the printer, LAN Only mode). */
export interface ElegooPrinter {
	id: string;
	name: string;
	host: string;
	/** Access code shown on the printer when LAN access is protected. */
	accessCode?: string;
	/** Serial number; detected over UDP when empty. */
	serial?: string;
}

export type ElegooPrintState = 'idle' | 'preheating' | 'printing' | 'pausing' | 'paused' | 'stopping' | 'stopped' | 'completed' | 'busy' | 'error' | 'offline';

export interface ElegooTemp {
	current: number;
	target: number;
}

export interface ElegooStatus {
	online: boolean;
	error?: string; // why it is offline (connection refused, wrong code, too many clients...)
	name: string;
	model: string;
	state: ElegooPrintState;
	/** Human label for busy states (Auto-leveling, Homing...). */
	stateLabel: string;
	filename: string;
	progress: number; // 0..100
	elapsedSec: number;
	remainingSec: number;
	currentLayer: number;
	totalLayers: number;
	nozzle: ElegooTemp | null;
	bed: ElegooTemp | null;
	chamber: number | null;
	speedMode: string;
	hasThumbnail: boolean;
	/** Changes when the thumbnail changes (cache buster). */
	thumbKey: string;
	updatedAt: number; // ms
}

export interface ElegooPrintConfig {
	printerId: string;
	showThumbnail?: boolean;
	showTemps?: boolean;
}

export interface ElegooPrintItem extends DashboardItemBase {
	type: 'elegoo-print';
	config: ElegooPrintConfig;
}

export interface NavbarElegooPrintItem extends NavbarItemBase {
	type: 'navbar-elegoo-print';
	config: ElegooPrintConfig;
}

// --- PsiTransfer ---

export interface PsiTransferConfig {
	/** Retention picked by default (a key of PsiTransfer's retentions, e.g. "604800" or "one-time"). */
	retention?: string;
	/** Ask for retention and password before sending (default true). */
	askOptions?: boolean;
	/** Share links remembered by the browser (default 5). */
	history?: number;
}

export interface PsiTransferItem extends DashboardItemBase {
	type: 'psitransfer';
	config?: PsiTransferConfig;
}

// --- Jenkins ---

export interface JenkinsConfig {
	/** Full name of a job (folders joined with "/"); empty: every job. */
	job?: string;
	limit?: number;
}

export type JenkinsResult = 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | null;

export interface JenkinsBuild {
	job: string;
	number: number;
	result: JenkinsResult;
	building: boolean;
	timestamp: number;
	duration: number;
	estimatedDuration: number;
	url: string;
}

export interface JenkinsData {
	builds: JenkinsBuild[];
	/** Project view: link to the job, whether it is queued, whether it takes parameters. */
	jobUrl?: string;
	inQueue?: boolean;
	hasParameters?: boolean;
	buildable?: boolean;
	/** All-projects view: projects whose latest finished build failed, newest failure first. */
	failing?: { job: string; number: number; url: string }[];
}

export interface JenkinsParameter {
	name: string;
	type: 'string' | 'text' | 'boolean' | 'choice' | 'password' | 'other';
	description: string;
	default: string | boolean;
	choices?: string[];
}

export interface JenkinsItem extends DashboardItemBase {
	type: 'jenkins';
	config?: JenkinsConfig;
}

export interface NavbarJenkinsItem extends NavbarItemBase {
	type: 'navbar-jenkins';
	config?: JenkinsConfig;
}

// --- Proxmox ---

export interface ProxmoxConfig {
	clusterId?: string;
	/** Only this node ('' = every node). */
	node?: string;
	/** Which guests: VMs, containers or both. */
	kind?: 'all' | 'qemu' | 'lxc';
	hideStopped?: boolean;
	showNodes?: boolean;
}

export interface ProxmoxNode {
	node: string;
	status: string;
	cpu: number;
	maxcpu: number;
	mem: number;
	maxmem: number;
	uptime: number;
}

export interface ProxmoxGuest {
	vmid: number;
	name: string;
	type: 'qemu' | 'lxc';
	node: string;
	status: string;
	cpu: number;
	maxcpu: number;
	mem: number;
	maxmem: number;
	uptime: number;
}

export interface ProxmoxData {
	nodes: ProxmoxNode[];
	guests: ProxmoxGuest[];
	/** Link to the Proxmox web UI. */
	url: string;
}

export interface ProxmoxItem extends DashboardItemBase {
	type: 'proxmox';
	config?: ProxmoxConfig;
}

export interface NavbarProxmoxItem extends NavbarItemBase {
	type: 'navbar-proxmox';
	config?: ProxmoxConfig;
}

// --- Portainer ---

export interface PortainerConfig {
	/** Only this environment (endpoint id as text; '' = every environment). */
	endpointId?: string;
}

export interface PortainerEndpoint {
	id: number;
	name: string;
	up: boolean;
	running: number;
	stopped: number;
	healthy: number;
	unhealthy: number;
}

export interface PortainerStack {
	id: number;
	name: string;
	endpointId: number;
	active: boolean;
	/** 1 swarm, 2 compose, 3 kubernetes */
	type: number;
}

export interface PortainerData {
	endpoints: PortainerEndpoint[];
	stacks: PortainerStack[];
	url: string;
}

export interface PortainerItem extends DashboardItemBase {
	type: 'portainer';
	config?: PortainerConfig;
}

// --- Immich ---

export interface ImmichConfig {
	showStats?: boolean;
	/** Recent photos shown (0 hides the strip). */
	photos?: number;
}

export interface ImmichData {
	stats: { photos: number; videos: number; usage: number | null; scope: 'server' | 'user' };
	recent: { id: string; date: string }[];
	url: string;
}

export interface ImmichItem extends DashboardItemBase {
	type: 'immich';
	config?: ImmichConfig;
}

// --- Nextcloud ---

export interface NextcloudConfig {
	showQuota?: boolean;
	showServer?: boolean;
	/** Recent files shown (0 hides the list). */
	files?: number;
}

export interface NextcloudFile {
	name: string;
	path: string;
	modified: number;
	size: number;
	url: string;
}

export interface NextcloudData {
	user: { name: string; used: number; total: number | null };
	server: { version: string; freeSpace: number | null; files: number | null; activeUsers: number | null; cpuLoad: number | null } | null;
	files: NextcloudFile[];
	url: string;
}

export interface NextcloudItem extends DashboardItemBase {
	type: 'nextcloud';
	config?: NextcloudConfig;
}

// --- Gitea / Forgejo ---

export interface GiteaConfig {
	/** Recent repositories shown (0 hides them). */
	repos?: number;
	/** Open issues and pull requests shown (0 hides them). */
	issues?: number;
}

export interface GiteaRepo {
	name: string;
	url: string;
	updated: number;
	stars: number;
	issues: number;
	pulls: number;
	private: boolean;
}

export interface GiteaIssue {
	title: string;
	number: number;
	repo: string;
	url: string;
	updated: number;
	pull: boolean;
	author: string;
}

export interface GiteaData {
	user: string;
	url: string;
	repos: GiteaRepo[];
	open: GiteaIssue[];
	counts: { issues: number; pulls: number } | null;
}

export interface GiteaItem extends DashboardItemBase {
	type: 'gitea';
	config?: GiteaConfig;
}
