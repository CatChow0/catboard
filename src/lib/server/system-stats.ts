import si from 'systeminformation';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import type { CpuStats, RamStats, DiskStats } from '$lib/types';

const execFileAsync = promisify(execFile);

async function getWindowsCpuTemp(): Promise<{ sensors: { name: string; value: number }[] }> {
	if (process.platform !== 'win32') return { sensors: [] };

	const script = `
$sensors = @()
try {
    $t = Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction SilentlyContinue
    if ($t) {
        foreach ($zone in $t) {
            $tempC = ($zone.CurrentTemperature - 2732) / 10
            $sensors += @{ name = "ThermalZone"; value = [math]::Round($tempC) }
        }
    }
} catch {}
try {
    $s = Get-WmiObject -Namespace root/LibreHardwareMonitor -Class Sensor -ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" }
    if ($s) {
        foreach ($sensor in $s) {
            $sensors += @{ name = $sensor.Name; value = [math]::Round($sensor.Value) }
        }
    }
} catch {}
try {
    $s = Get-WmiObject -Namespace root/OpenHardwareMonitor -Class Sensor -ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" }
    if ($s) {
        foreach ($sensor in $s) {
            $sensors += @{ name = $sensor.Name; value = [math]::Round($sensor.Value) }
        }
    }
} catch {}
ConvertTo-Json $sensors
`;

	const scriptPath = join(tmpdir(), `cpu-temp-${Date.now()}.ps1`);
	try {
		await writeFile(scriptPath, script, 'utf-8');
		const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { timeout: 10000, encoding: 'utf-8' });
		const parsed = JSON.parse(stdout.trim());
		return { sensors: Array.isArray(parsed) ? parsed : [] };
	} catch {
		return { sensors: [] };
	} finally {
		try { await unlink(scriptPath); } catch {}
	}
}

async function getLinuxCpuTemp(): Promise<{ sensors: { name: string; value: number }[] }> {
	if (process.platform === 'win32') return { sensors: [] };
	const { readdirSync, readFileSync, existsSync } = await import('fs');
	const sensors: { name: string; value: number }[] = [];

	// Try hwmon sensors
	try {
		const hwmonDir = '/sys/class/hwmon';
		if (existsSync(hwmonDir)) {
			for (const hw of readdirSync(hwmonDir)) {
				const namePath = `${hwmonDir}/${hw}/name`;
				const tempPath = `${hwmonDir}/${hw}/temp1_input`;
				if (existsSync(namePath) && existsSync(tempPath)) {
					const name = readFileSync(namePath, 'utf-8').trim();
					const raw = parseInt(readFileSync(tempPath, 'utf-8').trim(), 10);
					if (!isNaN(raw)) {
						sensors.push({ name: `${name} (${hw})`, value: Math.round(raw / 1000) });
					}
				}
			}
		}
	} catch {}

	// Try thermal zones
	try {
		const tzDir = '/sys/class/thermal';
		if (existsSync(tzDir)) {
			for (const tz of readdirSync(tzDir).filter(d => d.startsWith('thermal_zone'))) {
				const tempPath = `${tzDir}/${tz}/temp`;
				const typePath = `${tzDir}/${tz}/type`;
				if (existsSync(tempPath)) {
					const raw = parseInt(readFileSync(tempPath, 'utf-8').trim(), 10);
					const type = existsSync(typePath) ? readFileSync(typePath, 'utf-8').trim() : tz;
					if (!isNaN(raw)) {
						sensors.push({ name: type, value: Math.round(raw / 1000) });
					}
				}
			}
		}
	} catch {}

	return { sensors };
}

export async function getCpuStats(sensorOverride?: string): Promise<CpuStats> {
	const [load, temp, cpu] = await Promise.all([
		si.currentLoad(),
		si.cpuTemperature(),
		si.cpu()
	]);

	const sensors: { [sensor: string]: number } = {};
	if (temp.cores && temp.cores.length > 0) {
		temp.cores.forEach((t: number | null, i: number) => {
			if (t !== null) sensors[`Core ${i}`] = Math.round(t);
		});
	}
	if (temp.main !== null) sensors['Main'] = Math.round(temp.main);
	if (temp.max !== null) sensors['Max'] = Math.round(temp.max);

	let temperature = temp.main ?? null;
	if (sensorOverride && sensors[sensorOverride] !== undefined) {
		temperature = sensors[sensorOverride];
	}

	// Fallback: try platform-specific methods if systeminformation returned null
	if (temperature === null) {
		let fallback: { sensors: { name: string; value: number }[] };
		if (process.platform === 'win32') {
			fallback = await getWindowsCpuTemp();
		} else {
			fallback = await getLinuxCpuTemp();
		}
		for (const s of fallback.sensors) {
			sensors[s.name] = s.value;
		}
		if (fallback.sensors.length > 0 && temperature === null) {
			temperature = fallback.sensors[0].value;
		}
	}

	return {
		usage: Math.round(load.currentLoad * 10) / 10,
		temperature: temperature !== null ? Math.round(temperature) : null,
		cores: cpu.cores,
		tempSensors: Object.keys(sensors).length > 0 ? sensors : undefined
	};
}

export async function getAvailableTempSensors(): Promise<string[]> {
	const sensors: string[] = [];

	try {
		const temp = await si.cpuTemperature();
		if (temp.main !== null) sensors.push('Main');
		if (temp.max !== null) sensors.push('Max');
		if (temp.cores && temp.cores.length > 0) {
			temp.cores.forEach((_: number | null, i: number) => {
				sensors.push(`Core ${i}`);
			});
		}
	} catch {}

	// Add fallback sensors
	if (sensors.length === 0) {
		let fallback: { sensors: { name: string; value: number }[] };
		if (process.platform === 'win32') {
			fallback = await getWindowsCpuTemp();
		} else {
			fallback = await getLinuxCpuTemp();
		}
		for (const s of fallback.sensors) {
			sensors.push(s.name);
		}
	}

	return sensors;
}

export async function getRamStats(): Promise<RamStats> {
	const mem = await si.mem();
	return {
		total: mem.total,
		used: mem.active,
		swapTotal: mem.swaptotal,
		swapUsed: mem.swapused
	};
}

function normalizeMountPath(mount: string): string {
	if (process.platform === 'win32') {
		if (/^[A-Z]:$/.test(mount)) return mount + '/';
		return mount.replace(/\\/g, '/');
	}
	return mount;
}

// Real on-disk filesystems worth surfacing as "disks" in the navbar.
// Pseudo/container filesystems (overlay, tmpfs, proc, sysfs, ...) are excluded,
// as are the per-container overlayfs rootfs that leak into this container's
// mount namespace when a host path containing docker's image store is bind-mounted
// (e.g. /mnt/Fast_Boi -> /Fast_Boi drags in /Fast_Boi/docker-data/rootfs/overlayfs/*).
const REAL_DISK_FS_TYPES = new Set([
	'ext2', 'ext3', 'ext4', 'btrfs', 'xfs', 'zfs', 'ntfs', 'ntfs3', 'f2fs',
	'exfat', 'vfat', 'fat32', 'fuseblk', 'apfs', 'hfs', 'hfsplus', 'reiserfs', 'jfs'
]);

function isInternalMountPath(mount: string): boolean {
	if (!mount) return true;
	const configDir = process.env.CONFIG_DIR || '/app/config';
	return (
		mount.startsWith('/proc') ||
		mount.startsWith('/sys') ||
		mount.startsWith('/dev') ||
		mount.startsWith('/etc/') ||
		mount.startsWith('/run/') ||
		mount === configDir ||
		mount.startsWith(configDir + '/') ||
		mount.includes('/docker-data/rootfs/overlayfs/') ||
		mount.includes('/docker/overlay2/') ||
		mount.includes('/containerd/io.containerd.snapshotter.')
	);
}

function isRealDisk(d: { type?: string; fs?: string; mount?: string }): boolean {
	if (isInternalMountPath(d.mount || '')) return false;
	const t = (d.type || '').toLowerCase();
	const fsName = (d.fs || '').toLowerCase();
	// overlay = container rootfs + leaked per-container rootfs -> never a user disk
	if (t === 'overlay' || fsName === 'overlay') return false;
	if (!t) return false;
	return REAL_DISK_FS_TYPES.has(t);
}

export async function getDiskStats(requestedPaths?: string[]): Promise<DiskStats> {
	const result: DiskStats = {};
	try {
		const fs = (await si.fsSize()).filter(isRealDisk);

		const diskMap = new Map<string, { total: number; used: number }>();
		for (const d of fs) {
			const normalized = normalizeMountPath(d.mount);
			diskMap.set(normalized, { total: d.size, used: d.used });
			diskMap.set(d.mount, { total: d.size, used: d.used });
		}

		if (requestedPaths && requestedPaths.length > 0) {
			for (const path of requestedPaths) {
				const normalized = normalizeMountPath(path);
				const entry = diskMap.get(path) || diskMap.get(normalized);
				if (entry) {
					result[normalized] = entry;
				}
			}
		} else {
			for (const d of fs) {
				const normalized = normalizeMountPath(d.mount);
				result[normalized] = { total: d.size, used: d.used };
			}
		}
	} catch {
		// skip unavailable disks
	}
	return result;
}

export async function getAvailableDisks(): Promise<string[]> {
	try {
		const fs = await si.fsSize();
		return fs.filter(isRealDisk).map(d => normalizeMountPath(d.mount));
	} catch {
		return [];
	}
}