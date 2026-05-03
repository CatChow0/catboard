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

export interface GridConfig {
	cellSize: number;
	gap: number;
	breakpoints: { minWidth: number; columns: number }[];
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

export interface CollapsibleGroupItem extends DashboardItemBase {
	type: 'group-collapsible';
	title: string;
	children: DashboardItem[];
	config?: { outlineColor?: string };
}

export interface StandardGroupItem extends DashboardItemBase {
	type: 'group-standard';
	title: string;
	children: DashboardItem[];
	config?: { compact?: boolean; outlineColor?: string };
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

export type DashboardItem = ServiceItem | CollapsibleGroupItem | StandardGroupItem | CalendarItem | ClockItem | WeatherItem | UptimeKumaStatusPageItem | DockerItem;

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

export type NavbarItem = NavbarTitleItem | NavbarSearchItem | NavbarCpuItem | NavbarRamItem | NavbarDiskItem | NavbarUptimeKumaStatusPageItem | NavbarDockerItem;

export interface NavbarLayout {
	columns: number;
	items: NavbarItem[];
}

export interface Layout {
	grid: GridConfig;
	items: DashboardItem[];
	navbar: NavbarLayout;
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
}

export interface DockerEnvironmentData {
	environmentId: string;
	name: string;
	containers: DockerContainerInfo[];
	runningCount: number;
	stoppedCount: number;
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
}

export interface DockerItem extends DashboardItemBase {
	type: 'docker';
	config: DockerWidgetConfig;
}

export interface NavbarDockerItem extends NavbarItemBase {
	type: 'navbar-docker';
	config: DockerWidgetConfig;
}