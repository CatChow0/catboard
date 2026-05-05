import { writable, get } from 'svelte/store';
import { findNextAvailablePosition, hasCollision } from '$lib/utils/grid';
import type {
	Service, GridConfig, DashboardItemBase, ServiceItem, CollapsibleGroupItem,
	StandardGroupItem, CalendarItem, CalendarConfig, ClockConfig, WeatherConfig, DashboardItem, NavbarItemBase,
	NavbarItem, NavbarLayout, Layout, CustomPalette, Settings, ServiceStatus,
	SystemStats, UptimeKumaStatusPageData, UptimeKumaStatusPageConfig, DockerEnvironmentData, DockerWidgetConfig, IntegrationsConfig,
	ArrCalendarData, AdGuardHomeData
} from '$lib/types';

export type {
	Service, GridConfig, DashboardItemBase, ServiceItem, CollapsibleGroupItem,
	StandardGroupItem, CalendarItem, CalendarConfig, ClockConfig, WeatherConfig, DashboardItem, NavbarItemBase,
	NavbarItem, NavbarLayout, Layout, CustomPalette, Settings, ServiceStatus,
	SystemStats, UptimeKumaStatusPageData, UptimeKumaStatusPageConfig, DockerEnvironmentData, DockerWidgetConfig, IntegrationsConfig,
	ArrCalendarData, AdGuardHomeData
};

// --- API helper ---

async function api<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		headers: { 'Content-Type': 'application/json' },
		...options
	});
	if (res.status === 401) {
		window.location.href = '/login';
		throw new Error('Unauthorized');
	}
	if (res.status === 403) {
		const data = await res.json();
		if (data.needsSetup) window.location.href = '/login?setup=1';
		throw new Error('Setup required');
	}
	return res.json();
}

// --- Stores ---

export const services = writable<Service[]>([]);
export const layout = writable<Layout>({
	grid: { cellSize: 80, gap: 12, breakpoints: [{ minWidth: 0, columns: 4 }, { minWidth: 800, columns: 6 }, { minWidth: 1200, columns: 10 }] },
	items: [],
	navbar: { columns: 12, items: [] }
});
export const settings = writable<Settings>({
	title: 'My Homelab',
	theme: 'dark',
	background: { type: 'none', value: '' },
	stylePreset: 'default',
	animations: 'subtle',
	scrollbarStyle: 'thin',
	navbar: { columns: 12 },
	statusCheckInterval: 30000,
	layout: { cellSize: 80, gap: 12, breakpoints: [{ minWidth: 0, columns: 4 }, { minWidth: 800, columns: 6 }, { minWidth: 1200, columns: 10 }] }
});
export const serviceStatuses = writable<ServiceStatus>({});
export const systemStats = writable<SystemStats>({
	cpu: { usage: 0, temperature: null, cores: 0 },
	ram: { total: 0, used: 0, swapTotal: 0, swapUsed: 0 },
	disks: {}
});
export const uptimeKumaData = writable<Record<string, UptimeKumaStatusPageData>>({});
export const dockerData = writable<Record<string, DockerEnvironmentData>>({});
export const adguardHomeData = writable<Record<string, AdGuardHomeData>>({});
export const arrCalendarData = writable<ArrCalendarData>({ entries: [], updatedAt: 0 });
export const isEditing = writable(false);
export const currentUser = writable<{ username: string; role: string } | null>(null);

// --- Helpers ---

function mergeGridConfig(layoutData: Layout): Layout {
	const s = get(settings);
	if (s.layout) {
		layoutData.grid = s.layout;
	}
	return layoutData;
}

export function getActiveColumns(breakpoints: { minWidth: number; columns: number }[], windowWidth: number): number {
	const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth);
	for (const bp of sorted) {
		if (windowWidth >= bp.minWidth) return bp.columns;
	}
	return sorted[sorted.length - 1]?.columns || 4;
}

export function resolveService(serviceId: string, allServices: Service[]): Service | undefined {
	return allServices.find((s) => s.id === serviceId);
}

// --- Actions ---

export async function loadDashboard() {
	const [servicesData, layoutData, settingsData, authData] = await Promise.all([
		api<{ services: Service[] }>('/api/services'),
		api<Layout>('/api/layout'),
		api<Settings>('/api/settings'),
		api<{ authenticated: boolean; needsSetup: boolean; username?: string; role?: string }>('/api/auth/check')
	]);
	const allIds = new Set(servicesData.services.map((s) => s.id));
	if (layoutData.items) {
		function cleanOrphans(items: DashboardItem[]): DashboardItem[] {
			return items
				.filter((item) => !(item.type === 'service' && !allIds.has(item.serviceId)))
				.map((item) => {
					if ('children' in item && item.children) {
						return { ...item, children: cleanOrphans(item.children) };
					}
					return item;
				});
		}
		const cleaned = cleanOrphans(layoutData.items);
		if (cleaned.length !== layoutData.items.length) {
			layoutData.items = cleaned;
			await api('/api/layout', { method: 'PUT', body: JSON.stringify(layoutData) });
		}
	}
	// Merge grid config from settings into layout
	if (settingsData.layout) {
		layoutData.grid = settingsData.layout;
	}
	// Migrate: if navbar field is missing, create default from settings
	if (!layoutData.navbar) {
		layoutData.navbar = {
			columns: settingsData.navbar?.columns || 12,
			items: [
				{ id: crypto.randomUUID(), type: 'navbar-title', col: 0, colSpan: 2 },
				{ id: crypto.randomUUID(), type: 'navbar-search' as const, col: 2, colSpan: 4 }
			]
		};
		await api('/api/layout', { method: 'PUT', body: JSON.stringify(layoutData) });
	}
	services.set(servicesData.services);
	layout.set(layoutData);
	settings.set(settingsData);
	if (authData.authenticated && authData.username && authData.role) {
		currentUser.set({ username: authData.username, role: authData.role });
	} else {
		currentUser.set(null);
	}
}

export async function registerService(service: Partial<Service>) {
	const result = await api<Service>('/api/services', {
		method: 'POST',
		body: JSON.stringify(service)
	});
	services.update((s) => [...s, result]);
	return result;
}

export async function updateService(id: string, data: Partial<Service>) {
	const result = await api<Service>(`/api/services/${id}`, {
		method: 'PUT',
		body: JSON.stringify(data)
	});
	services.update((s) => s.map((svc) => (svc.id === id ? result : svc)));
	return result;
}

export async function deleteService(id: string) {
	await api(`/api/services/${id}`, { method: 'DELETE' });
	services.update((s) => s.filter((svc) => svc.id !== id));
	// Remove dashboard items referencing this service
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];
	function removeOrphanedServiceItems(items: DashboardItem[]): DashboardItem[] {
		return items
			.filter((item) => !(item.type === 'service' && item.serviceId === id))
			.map((item) => {
				if ('children' in item && item.children) {
					return { ...item, children: removeOrphanedServiceItems(item.children) };
				}
				return item;
			});
	}
	newLayout.items = removeOrphanedServiceItems(newLayout.items);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function addServiceToDashboard(serviceId: string, maxCols: number) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];
	const pos = findNextAvailablePosition(newLayout.items, 1, 1, maxCols);
	const item: ServiceItem = {
		id: crypto.randomUUID(),
		type: 'service',
		serviceId,
		col: pos.col,
		row: pos.row,
		colSpan: 1,
		rowSpan: 1
	};
	newLayout.items.push(item);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function addWidgetToDashboard(type: 'group-collapsible' | 'group-standard' | 'calendar' | 'clock' | 'weather' | 'uptime-kuma-status-page' | 'docker' | 'adguard-home' | 'adguard-home-control' | 'jellyfin-latest', title: string, colSpan: number, rowSpan: number, maxCols: number, config?: Record<string, unknown>) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];
	const pos = findNextAvailablePosition(newLayout.items, colSpan, rowSpan, maxCols);
	const item: DashboardItem = type === 'group-collapsible'
		? { id: crypto.randomUUID(), type: 'group-collapsible' as const, title, col: pos.col, row: pos.row, colSpan, rowSpan, children: [] as DashboardItem[] }
		: type === 'group-standard'
			? { id: crypto.randomUUID(), type: 'group-standard' as const, title, col: pos.col, row: pos.row, colSpan, rowSpan, children: [] as DashboardItem[], config: config as StandardGroupItem['config'] }
			: type === 'calendar'
			? { id: crypto.randomUUID(), type: 'calendar' as const, col: pos.col, row: pos.row, colSpan, rowSpan }
			: type === 'clock'
			? { id: crypto.randomUUID(), type: 'clock' as const, col: pos.col, row: pos.row, colSpan, rowSpan, config: config as unknown as ClockConfig }
			: type === 'uptime-kuma-status-page'
				? { id: crypto.randomUUID(), type: 'uptime-kuma-status-page' as const, col: pos.col, row: pos.row, colSpan, rowSpan, config: config as unknown as UptimeKumaStatusPageConfig }
				: type === 'docker'
					? { id: crypto.randomUUID(), type: 'docker' as const, col: pos.col, row: pos.row, colSpan, rowSpan, config: config as unknown as DockerWidgetConfig }
					: type === 'adguard-home'
						? { id: crypto.randomUUID(), type: 'adguard-home' as const, col: pos.col, row: pos.row, colSpan, rowSpan, config: config as unknown as { instanceId: string } }
						: type === 'adguard-home-control'
							? { id: crypto.randomUUID(), type: 'adguard-home-control' as const, col: pos.col, row: pos.row, colSpan, rowSpan, config: config as unknown as { instanceId: string } }
									: type === 'jellyfin-latest'
										? { id: crypto.randomUUID(), type: 'jellyfin-latest' as const, col: pos.col, row: pos.row, colSpan, rowSpan, config: config as unknown as { instanceId: string; limit?: number } }
											: { id: crypto.randomUUID(), type: 'weather' as const, col: pos.col, row: pos.row, colSpan, rowSpan, config: config as unknown as WeatherConfig };
	newLayout.items.push(item);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function removeDashboardItem(itemId: string) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];

	function removeItem(items: DashboardItem[]): DashboardItem[] {
		return items
			.filter((item) => item.id !== itemId)
			.map((item) => {
				if ('children' in item && item.children) {
					return { ...item, children: removeItem(item.children) };
				}
				return item;
			});
	}

	newLayout.items = removeItem(newLayout.items);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function updateDashboardItem(itemId: string, updates: Partial<DashboardItemBase>) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];

	function updateItems(items: DashboardItem[]): DashboardItem[] {
		return items.map((item) => {
			if (item.id === itemId) {
				return { ...item, ...updates } as DashboardItem;
			}
			if ('children' in item && item.children) {
				return { ...item, children: updateItems(item.children) } as DashboardItem;
			}
			return item;
		});
	}

	newLayout.items = updateItems(newLayout.items);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function updateChildInGroup(groupId: string, childId: string, updates: { col?: number; row?: number; colSpan?: number; rowSpan?: number }) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];

	function updateChild(items: DashboardItem[]): DashboardItem[] {
		return items.map((item) => {
			if (item.id === groupId && 'children' in item) {
				const children = item.children.map((child) => {
					if (child.id === childId) {
						return { ...child, ...updates } as DashboardItem;
					}
					return child;
				});
				return { ...item, children };
			}
			if ('children' in item && item.children) {
				return { ...item, children: updateChild(item.children) };
			}
			return item;
		});
	}

	newLayout.items = updateChild(newLayout.items);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function moveItemToGroup(itemId: string, groupId: string, pos?: { col: number; row: number }) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];

	let extracted: DashboardItem | undefined;
	function extractItem(items: DashboardItem[]): DashboardItem[] {
		return items.filter((item) => {
			if (item.id === itemId) {
				extracted = item;
				return false;
			}
			return true;
		}).map((item) => {
			if ('children' in item && item.children) {
				const newChildren = item.children.filter((child) => {
					if (child.id === itemId) {
						extracted = child;
						return false;
					}
					return true;
				});
				return { ...item, children: newChildren };
			}
			return item;
		});
	}
	newLayout.items = extractItem(newLayout.items);
	if (!extracted) return;

		// Find the target group to check for collisions
		let targetGroup: DashboardItem | undefined;
		function findGroup(items: DashboardItem[]): void {
			for (const item of items) {
				if (item.id === groupId) { targetGroup = item; return; }
				if ('children' in item && item.children) findGroup(item.children);
			}
		}
		findGroup(newLayout.items);

		let insertCol = pos?.col ?? 0;
		let insertRow = pos?.row ?? 0;
		const insertColSpan = 'colSpan' in extracted ? extracted.colSpan : 1;
		const insertRowSpan = 'rowSpan' in extracted ? extracted.rowSpan : 1;
		if (targetGroup && 'children' in targetGroup) {
			if (hasCollision(targetGroup.children, extracted.id, insertCol, insertRow, insertColSpan, insertRowSpan)) {
				const available = findNextAvailablePosition(targetGroup.children, insertColSpan, insertRowSpan, targetGroup.colSpan);
				insertCol = available.col;
				insertRow = available.row;
			}
		}

		const toInsert: DashboardItem = {
			...extracted,
			col: insertCol,
			row: insertRow,
			colSpan: insertColSpan,
			rowSpan: insertRowSpan
		} as DashboardItem;
		function addToGroup(items: DashboardItem[]): DashboardItem[] {
			return items.map((item) => {
				if (item.id === groupId && 'children' in item) {
					return { ...item, children: [...item.children, toInsert] };
				}
				if ('children' in item && item.children) {
					return { ...item, children: addToGroup(item.children) };
				}
				return item;
			});
		}
		newLayout.items = addToGroup(newLayout.items);

	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

	export async function batchMoveToGroup(itemIds: string[], groupId: string, positions: Map<string, { col: number; row: number }>) {
		const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
		if (!newLayout.items) newLayout.items = [];

		const extracted: DashboardItem[] = [];
		function extractItems(items: DashboardItem[]): DashboardItem[] {
			return items.filter((item) => {
				if (itemIds.includes(item.id)) {
					extracted.push(item);
					return false;
				}
				return true;
			}).map((item) => {
				if ('children' in item && item.children) {
					const newChildren = item.children.filter((child) => {
						if (itemIds.includes(child.id)) {
							extracted.push(child);
							return false;
						}
						return true;
					});
					return { ...item, children: newChildren };
				}
				return item;
			});
		}
		newLayout.items = extractItems(newLayout.items);

		// Add all extracted items to target group, checking for collisions
		function addAllToGroup(items: DashboardItem[]): DashboardItem[] {
			return items.map((item) => {
				if (item.id === groupId && 'children' in item) {
					const newChildren = [...item.children];
					for (const ext of extracted) {
						const desiredPos = positions.get(ext.id);
						const colSpan = 'colSpan' in ext ? ext.colSpan : 1;
						const rowSpan = 'rowSpan' in ext ? ext.rowSpan : 1;
						let col = desiredPos?.col ?? 0;
						let row = desiredPos?.row ?? 0;
						if (hasCollision(newChildren, ext.id, col, row, colSpan, rowSpan)) {
							const available = findNextAvailablePosition(newChildren, colSpan, rowSpan, item.colSpan);
							col = available.col;
							row = available.row;
						}
						newChildren.push({
							...ext,
							col,
							row,
							colSpan,
							rowSpan
						} as DashboardItem);
					}
					return { ...item, children: newChildren };
				}
				if ('children' in item && item.children) {
					return { ...item, children: addAllToGroup(item.children) };
				}
				return item;
			});
		}
		newLayout.items = addAllToGroup(newLayout.items);

		await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
		layout.set(newLayout);
	}

export async function moveItemToRoot(itemId: string, maxCols: number) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];

	let extracted: DashboardItem | undefined;
	function extractItem(items: DashboardItem[]): DashboardItem[] {
		return items.filter((item) => {
			if (item.id === itemId) {
				extracted = item;
				return false;
			}
			return true;
		}).map((item) => {
			if ('children' in item && item.children) {
				const newChildren = item.children.filter((child) => {
					if (child.id === itemId) {
						extracted = child;
						return false;
					}
					return true;
				});
				return { ...item, children: newChildren };
			}
			return item;
		});
	}
	newLayout.items = extractItem(newLayout.items);
	if (!extracted) return;

	const colSpan = 'colSpan' in extracted ? extracted.colSpan : 1;
	const rowSpan = 'rowSpan' in extracted ? extracted.rowSpan : 1;
	const pos = findNextAvailablePosition(newLayout.items, colSpan, rowSpan, maxCols);
	const restored: DashboardItem = {
		...extracted,
		col: pos.col,
		row: pos.row,
		colSpan,
		rowSpan
	} as DashboardItem;
	newLayout.items.push(restored);

	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function batchMoveToRoot(itemIds: string[], maxCols: number) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];

	const extracted: DashboardItem[] = [];
	function extractItems(items: DashboardItem[]): DashboardItem[] {
		return items.filter((item) => {
			if (itemIds.includes(item.id)) {
				extracted.push(item);
				return false;
			}
			return true;
		}).map((item) => {
			if ('children' in item && item.children) {
				const newChildren = item.children.filter((child) => {
					if (itemIds.includes(child.id)) {
						extracted.push(child);
						return false;
					}
					return true;
				});
				return { ...item, children: newChildren };
			}
			return item;
		});
	}
	newLayout.items = extractItems(newLayout.items);

	for (const ext of extracted) {
		const colSpan = 'colSpan' in ext ? ext.colSpan : 1;
		const rowSpan = 'rowSpan' in ext ? ext.rowSpan : 1;
		const pos = findNextAvailablePosition(newLayout.items, colSpan, rowSpan, maxCols);
		const restored: DashboardItem = {
			...ext,
			col: pos.col,
			row: pos.row,
			colSpan,
			rowSpan
		} as DashboardItem;
		newLayout.items.push(restored);
	}

	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function saveLayout(newLayout: Layout) {
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function batchUpdatePositions(updates: Map<string, { col: number; row: number }>) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];

	function updatePositions(items: DashboardItem[]): DashboardItem[] {
		return items.map((item) => {
			const pos = updates.get(item.id);
			if (pos) {
				return { ...item, col: pos.col, row: pos.row } as DashboardItem;
			}
			return item;
		});
	}

	newLayout.items = updatePositions(newLayout.items);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function batchUpdateChildPositions(groupId: string, updates: Map<string, { col: number; row: number }>) {
	const newLayout = mergeGridConfig(await api<Layout>("/api/layout"));
	if (!newLayout.items) newLayout.items = [];

	function updateChildren(items: DashboardItem[]): DashboardItem[] {
		return items.map((item) => {
			if (item.id === groupId && 'children' in item) {
				const newChildren = item.children.map((child) => {
					const pos = updates.get(child.id);
					if (pos) {
						return { ...child, col: pos.col, row: pos.row } as DashboardItem;
					}
					return child;
				});
				return { ...item, children: newChildren };
			}
			if ('children' in item && item.children) {
				return { ...item, children: updateChildren(item.children) };
			}
			return item;
		});
	}

	newLayout.items = updateChildren(newLayout.items);
	await api("/api/layout", { method: "PUT", body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function saveSettings(newSettings: Settings) {
	await api('/api/settings', { method: 'PUT', body: JSON.stringify(newSettings) });
	settings.set(newSettings);
}

// --- Navbar Actions ---

export async function addNavbarItem(type: NavbarItem['type'], colSpan: number, config?: Record<string, unknown>) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.items) newLayout.items = [];
	if (!newLayout.navbar) newLayout.navbar = { columns: 12, items: [] };

	const columns = newLayout.navbar.columns || 12;
	const items = newLayout.navbar.items;

	function findGap(span: number): number {
		for (let c = 0; c <= columns - span; c++) {
			const overlaps = items.some((it) => c < it.col + it.colSpan && c + span > it.col);
			if (!overlaps) return c;
		}
		return items.reduce((max, it) => Math.max(max, it.col + it.colSpan), 0);
	}

	const targetCol = findGap(colSpan);
	const item: NavbarItem = (() => {
		switch (type) {
			case 'navbar-title': return { id: crypto.randomUUID(), type: 'navbar-title', col: targetCol, colSpan };
			case 'navbar-search': return { id: crypto.randomUUID(), type: 'navbar-search', col: targetCol, colSpan, placeholder: 'Search services...' };
			case 'navbar-cpu': return { id: crypto.randomUUID(), type: 'navbar-cpu', col: targetCol, colSpan };
			case 'navbar-ram': return { id: crypto.randomUUID(), type: 'navbar-ram', col: targetCol, colSpan };
			case 'navbar-disk': return { id: crypto.randomUUID(), type: 'navbar-disk', col: targetCol, colSpan, config: { disks: (config?.disks as string[]) || [] } };
			case 'navbar-uptime-kuma-status-page': return { id: crypto.randomUUID(), type: 'navbar-uptime-kuma-status-page', col: targetCol, colSpan, config: { slug: (config?.slug as string) || '' } };
			case 'navbar-docker': return { id: crypto.randomUUID(), type: 'navbar-docker', col: targetCol, colSpan, config: { environmentId: (config?.environmentId as string) || '' } };
		case 'navbar-adguard-home-control': return { id: crypto.randomUUID(), type: 'navbar-adguard-home-control', col: targetCol, colSpan, config: { instanceId: (config?.instanceId as string) || 'default' } };
			default: return { id: crypto.randomUUID(), type: 'navbar-title', col: targetCol, colSpan };
		}
	})();

	newLayout.navbar.items.push(item);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function removeNavbarItem(itemId: string) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.navbar) return;
	newLayout.navbar.items = newLayout.navbar.items.filter((item) => item.id !== itemId);
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function updateNavbarItem(itemId: string, updates: Partial<NavbarItemBase> & { config?: Record<string, unknown>; placeholder?: string }) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	if (!newLayout.navbar) return;
	newLayout.navbar.items = newLayout.navbar.items.map((item) => {
		if (item.id === itemId) {
			return { ...item, ...updates } as NavbarItem;
		}
		return item;
	});
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function saveNavbarLayout(navbar: NavbarLayout) {
	const newLayout = mergeGridConfig(await api<Layout>('/api/layout'));
	newLayout.navbar = navbar;
	await api('/api/layout', { method: 'PUT', body: JSON.stringify(newLayout) });
	layout.set(newLayout);
}

export async function getIntegrations(): Promise<IntegrationsConfig> {
	return api<IntegrationsConfig>('/api/integrations');
}

export async function setIntegrations(data: IntegrationsConfig): Promise<void> {
	await api('/api/integrations', { method: 'PUT', body: JSON.stringify(data) });
}

export async function exportDashboard(): Promise<Blob> {
	const res = await fetch('/api/export');
	const data = await res.json();
	const json = JSON.stringify(data, null, 2);
	return new Blob([json], { type: 'application/json' });
}

export async function importDashboard(data: Record<string, unknown>, sections: string[]): Promise<string[]> {
	const res = await fetch('/api/import', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...data, sections })
	});
	const result = await res.json();
	await loadDashboard();
	return result.imported;
}