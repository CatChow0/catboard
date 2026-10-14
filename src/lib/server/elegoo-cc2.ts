// Elegoo Centauri Carbon 2 client. The printer runs its own MQTT broker
// (port 1883, LAN Only mode) and accepts only ~4 clients, so CatBoard keeps
// ONE shared connection per printer: opened on the first request, closed
// after a few idle minutes so the slicer and the Elegoo app keep their slots.
//
// Protocol (community-documented, see danielcherubini/elegoo-homeassistant
// docs/CC2_PROTOCOL.md):
//  - login "elegoo" / access code (or "123456" when none is set)
//  - register: publish {client_id, request_id} to elegoo/<sn>/api_register,
//    answer on elegoo/<sn>/<request_id>/register_response ({"error":"ok"})
//  - status: event 6000 deltas on elegoo/<sn>/api_status, merged into a cache;
//    full status with method 1002 (after connecting and every 5 minutes)
//  - requests on elegoo/<sn>/<client_id>/api_request, replies and PONGs on
//    elegoo/<sn>/<client_id>/api_response; PING every 10 s (dropped after 65 s)
import mqtt, { type MqttClient } from 'mqtt';
import dgram from 'node:dgram';
import { randomBytes } from 'node:crypto';
import { getIntegrations } from '$lib/server/config';
import type { ElegooPrinter, ElegooPrintState, ElegooStatus } from '$lib/types';

const IDLE_MS = Number(process.env.ELEGOO_IDLE_MS) || 5 * 60_000;
const PING_MS = 10_000;
const FULL_STATUS_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 8000;

export const METHOD = { status: 1002, pause: 1021, stop: 1022, resume: 1023, thumbnail: 1045, fileDetail: 1046 } as const;

type Json = Record<string, any>;

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

/** Status pushes only carry what changed: merge them into the cached state. */
function deepMerge(target: Json, src: Json): Json {
	for (const [k, v] of Object.entries(src)) {
		if (isObj(v) && isObj(target[k])) deepMerge(target[k], v);
		else target[k] = isObj(v) ? deepMerge({}, v) : v;
	}
	return target;
}

const hex = (n: number) => randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);

// --- Discovery -----------------------------------------------------------------

export interface Cc2Discovery {
	sn: string;
	name: string;
	model: string;
	tokenStatus: number;
}

/** Ask the printer itself (UDP 52700, method 7000) for its serial number and name. */
export function discover(host: string, timeoutMs = 3000): Promise<Cc2Discovery> {
	return new Promise((resolve, reject) => {
		const sock = dgram.createSocket('udp4');
		const done = (err: Error | null, value?: Cc2Discovery) => {
			clearTimeout(timer);
			try { sock.close(); } catch { /* already closed */ }
			if (err) reject(err);
			else resolve(value!);
		};
		const timer = setTimeout(() => done(new Error('No answer to discovery (UDP 52700): is the printer on and in LAN Only mode?')), timeoutMs);
		sock.on('error', (e) => done(e));
		sock.on('message', (buf) => {
			try {
				const r = JSON.parse(buf.toString()).result;
				if (r?.sn) done(null, { sn: String(r.sn), name: r.host_name || '', model: r.machine_model || '', tokenStatus: Number(r.token_status) || 0 });
			} catch {
				// not for us
			}
		});
		sock.send(JSON.stringify({ id: 0, method: 7000 }), 52700, host, (e) => e && done(e));
	});
}

// --- Connection ----------------------------------------------------------------

class Cc2Client {
	readonly key: string;
	sn = '';
	name: string;
	model = 'Centauri Carbon 2';
	state: Json = {};
	online = false;
	error = '';
	lastUsed = Date.now();
	updatedAt = 0;
	fileInfo: { filename: string; layers: number; printTime: number } | null = null;
	thumb: { filename: string; data: Buffer; type: string } | null = null;

	private client: MqttClient | null = null;
	private readonly clientId = ('0cli' + Date.now().toString(16).slice(-5) + hex(8)).slice(0, 10);
	private nextId = 1;
	private pending = new Map<number, { resolve: (r: Json) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
	private timers: ReturnType<typeof setInterval>[] = [];
	private registered = false;
	private closed = false;
	private fetchingFile = '';
	private firstStatus: Promise<void>;
	private markFirst!: () => void;

	constructor(readonly printer: ElegooPrinter) {
		this.key = `${printer.host}|${printer.accessCode || ''}|${printer.serial || ''}`;
		this.name = printer.name;
		this.firstStatus = new Promise((r) => (this.markFirst = r));
		void this.start();
	}

	/** Resolves once the first full status arrived (or after `ms`). */
	ready(ms: number): Promise<void> {
		return Promise.race([this.firstStatus, new Promise<void>((r) => setTimeout(r, ms))]);
	}

	private async start() {
		try {
			if (this.printer.serial) this.sn = this.printer.serial.trim();
			else {
				const d = await discover(this.printer.host);
				this.sn = d.sn;
				if (d.name && !this.printer.name) this.name = d.name;
				if (d.model) this.model = d.model;
			}
		} catch (e) {
			this.fail(e instanceof Error ? e.message : 'Discovery failed; enter the serial number in the connection settings');
			// Printer off or asleep: try again while the dashboard still asks for it.
			setTimeout(() => !this.closed && void this.start(), 15_000);
			return;
		}
		if (this.closed) return;

		const client = mqtt.connect(`mqtt://${this.printer.host}:1883`, {
			username: 'elegoo',
			password: this.printer.accessCode?.trim() || '123456',
			clientId: this.clientId,
			protocolVersion: 4,
			keepalive: 60,
			clean: true,
			reconnectPeriod: 5000,
			connectTimeout: 5000
		});
		this.client = client;
		client.on('connect', () => void this.register());
		client.on('message', (topic, payload) => this.onMessage(topic, payload));
		client.on('close', () => {
			this.registered = false;
			if (this.online) this.fail('Connection to the printer lost');
		});
		client.on('error', (e: Error & { code?: string | number }) => {
			if (e.code === 4 || e.code === 5) this.fail('The printer refused the access code');
			else if (e.code === 'ECONNREFUSED' || e.code === 'EHOSTUNREACH' || e.code === 'ETIMEDOUT') this.fail('Printer unreachable: check the IP and that LAN Only mode is on');
			else this.fail(e.message || 'MQTT error');
		});
		client.on('offline', () => this.online && this.fail('Printer unreachable'));
	}

	private fail(msg: string) {
		this.online = false;
		this.error = msg;
		this.markFirst();
	}

	private topic(suffix: string) {
		return `elegoo/${this.sn}/${suffix}`;
	}

	private async register() {
		const client = this.client;
		if (!client || this.closed) return;
		const requestId = hex(16) + Date.now().toString(16);
		const responseTopic = this.topic(`${requestId}/register_response`);
		const answer = await new Promise<Json | null>((resolve) => {
			const timer = setTimeout(() => { client.removeListener('message', onMsg); resolve(null); }, 3000);
			const onMsg = (topic: string, payload: Buffer) => {
				if (topic !== responseTopic) return;
				clearTimeout(timer);
				client.removeListener('message', onMsg);
				try { resolve(JSON.parse(payload.toString())); } catch { resolve(null); }
			};
			client.on('message', onMsg);
			client.subscribe(responseTopic, () => client.publish(this.topic('api_register'), JSON.stringify({ client_id: this.clientId, request_id: requestId })));
		});
		client.unsubscribe(responseTopic);
		if (this.closed) return;
		if (!answer || answer.error !== 'ok') {
			const why = String(answer?.error || '');
			this.fail(/too many/i.test(why) ? 'The printer has too many connected clients (Elegoo app, slicer…): close one and retry' : answer ? `Registration refused: ${why}` : 'The printer did not answer (wrong serial number, or not in LAN Only mode?)');
			setTimeout(() => this.client?.connected && !this.registered && void this.register(), 10_000);
			return;
		}
		this.registered = true;
		client.subscribe([this.topic('api_status'), this.topic(`${this.clientId}/api_response`)]);
		this.clearTimers();
		this.timers.push(setInterval(() => client.connected && client.publish(this.topic(`${this.clientId}/api_request`), JSON.stringify({ type: 'PING' })), PING_MS));
		this.timers.push(setInterval(() => void this.refresh(), FULL_STATUS_MS));
		await this.refresh();
	}

	/** Full status (method 1002) replaces the cache. */
	private async refresh() {
		try {
			const r = await this.request(METHOD.status);
			this.state = deepMerge({}, r);
			this.online = true;
			this.error = '';
			this.updatedAt = Date.now();
			this.markFirst();
			this.checkFile();
		} catch (e) {
			if (!this.online) this.fail(e instanceof Error ? e.message : 'No status from the printer');
		}
	}

	private onMessage(topic: string, payload: Buffer) {
		let msg: Json;
		try { msg = JSON.parse(payload.toString()); } catch { return; }
		if (topic.endsWith('/api_status')) {
			const delta = msg.result ?? msg.params ?? msg.data;
			if (msg.method === 6000 && isObj(delta)) {
				deepMerge(this.state, delta);
				this.online = true;
				this.error = '';
				this.updatedAt = Date.now();
				this.checkFile();
			}
		} else if (topic.endsWith('/api_response')) {
			if (msg.type === 'PONG') return;
			const p = this.pending.get(msg.id);
			if (!p) return;
			this.pending.delete(msg.id);
			clearTimeout(p.timer);
			const code = msg.result?.error_code;
			if (code != null && code !== 0) p.reject(Object.assign(new Error(`Printer error ${code}`), { code }));
			else p.resolve(msg.result ?? {});
		}
	}

	request(method: number, params: Json = {}): Promise<Json> {
		const client = this.client;
		if (!client?.connected || !this.registered) return Promise.reject(new Error(this.error || 'Not connected to the printer'));
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The printer did not answer in time')); }, REQUEST_TIMEOUT_MS);
			this.pending.set(id, { resolve, reject, timer });
			client.publish(this.topic(`${this.clientId}/api_request`), JSON.stringify({ id, method, params }));
		});
	}

	/** New file on the printer: fetch its layer count / estimate (1046) and thumbnail (1045). */
	private checkFile() {
		const filename: string = this.state.print_status?.filename || '';
		if (!filename || filename === this.fetchingFile || this.fileInfo?.filename === filename) return;
		this.fetchingFile = filename;
		void (async () => {
			for (const storage_media of ['local', 'u-disk']) {
				try {
					const d = await this.request(METHOD.fileDetail, { storage_media, filename });
					this.fileInfo = { filename, layers: Number(d.layer ?? d.TotalLayers ?? d.total_layer) || 0, printTime: Number(d.print_time) || 0 };
					try {
						const t = await this.request(METHOD.thumbnail, { storage_media, filename });
						const b64 = String(t.thumbnail || '').replace(/^data:[^,]*,/, '');
						const data = Buffer.from(b64, 'base64');
						if (data.length > 16) {
							const type = data[0] === 0x89 && data[1] === 0x50 ? 'image/png' : data[0] === 0xff && data[1] === 0xd8 ? 'image/jpeg' : 'image/png';
							this.thumb = { filename, data, type };
						}
					} catch {
						this.thumb = null;
					}
					break;
				} catch {
					// try the next storage
				}
			}
			this.fetchingFile = '';
		})();
	}

	private clearTimers() {
		this.timers.forEach(clearInterval);
		this.timers = [];
	}

	close() {
		this.closed = true;
		this.clearTimers();
		for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Connection closed')); }
		this.pending.clear();
		this.client?.end(true);
		this.client = null;
		this.online = false;
	}
}

// --- Shared connections -------------------------------------------------------

const clients = new Map<string, Cc2Client>();

setInterval(() => {
	for (const [id, c] of clients) {
		if (Date.now() - c.lastUsed > IDLE_MS) {
			c.close();
			clients.delete(id);
		}
	}
}, 30_000).unref?.();

export async function findPrinter(id: string): Promise<ElegooPrinter | null> {
	const printers = (await getIntegrations()).elegoo?.printers || [];
	return printers.find((p) => p.id === id) ?? null;
}

/** The shared connection for a printer (recreated when its settings changed). */
export function clientFor(printer: ElegooPrinter): Cc2Client {
	let c = clients.get(printer.id);
	const key = `${printer.host}|${printer.accessCode || ''}|${printer.serial || ''}`;
	if (c && c.key !== key) {
		c.close();
		c = undefined;
	}
	if (!c) {
		c = new Cc2Client(printer);
		clients.set(printer.id, c);
	}
	c.lastUsed = Date.now();
	return c;
}

/** Number of open printer connections (tests and diagnostics). */
export const openConnections = () => clients.size;

// --- Normalized status -----------------------------------------------------------

const BUSY: Record<number, string> = {
	0: 'Initializing', 3: 'Loading filament', 4: 'Unloading filament', 5: 'Auto-leveling', 6: 'PID calibration', 7: 'Resonance test',
	8: 'Self-check', 9: 'Updating', 10: 'Homing', 11: 'Receiving file', 12: 'Composing video', 13: 'Extruder operation', 15: 'Power loss recovery'
};
const SPEED = ['Silent', 'Balanced', 'Sport', 'Ludicrous'];

function printState(status: number, sub: number, progress: number, filename: string): { state: ElegooPrintState; label: string } {
	if (status === 2) {
		if (sub === 1045 || sub === 1405) return { state: 'preheating', label: sub === 1045 ? 'Heating nozzle' : 'Heating bed' };
		if (sub === 2501) return { state: 'pausing', label: 'Pausing' };
		if (sub === 2502) return { state: 'paused', label: 'Paused' };
		if (sub === 2503) return { state: 'stopping', label: 'Stopping' };
		if (sub === 2504) return { state: 'stopped', label: 'Stopped' };
		if (sub === 2077) return { state: 'completed', label: 'Completed' };
		return { state: 'printing', label: sub === 2401 ? 'Resuming' : 'Printing' };
	}
	if (status === 14) return { state: 'error', label: 'Emergency stop' };
	if (status === 1) return progress >= 100 && filename ? { state: 'completed', label: 'Completed' } : { state: 'idle', label: 'Idle' };
	return { state: 'busy', label: BUSY[status] ?? 'Busy' };
}

const temp = (o: Json | undefined) => (isObj(o) && typeof o.temperature === 'number' ? { current: o.temperature, target: Number(o.target) || 0 } : null);

export function toStatus(c: Cc2Client): ElegooStatus {
	const s = c.state;
	const ms = s.machine_status || {};
	const ps = s.print_status || {};
	const filename: string = ps.filename || '';
	const progress = Math.max(0, Math.min(100, Number(ps.progress ?? ms.progress) || 0));
	const { state, label } = c.online ? printState(Number(ms.status), Number(ms.sub_status), progress, filename) : { state: 'offline' as const, label: 'Offline' };
	const sameFile = c.fileInfo?.filename === filename;
	return {
		online: c.online,
		error: c.online ? undefined : c.error || 'Connecting…',
		name: c.name || 'Centauri Carbon 2',
		model: c.model,
		state,
		stateLabel: label,
		filename: filename.replace(/^.*[\\/]/, ''),
		progress,
		elapsedSec: Number(ps.print_duration) || 0,
		remainingSec: Number(ps.remaining_time_sec) || 0,
		currentLayer: Number(ps.current_layer) || 0,
		totalLayers: Number(ps.total_layer) || (sameFile ? c.fileInfo!.layers : 0),
		nozzle: temp(s.extruder),
		bed: temp(s.heater_bed),
		chamber: typeof s.ztemperature_sensor?.temperature === 'number' ? s.ztemperature_sensor.temperature : null,
		speedMode: SPEED[Number(s.gcode_move_inf?.speed_mode)] ?? '',
		hasThumbnail: !!c.thumb && c.thumb.filename === filename,
		thumbKey: c.thumb && c.thumb.filename === filename ? `${c.thumb.filename}:${c.thumb.data.length}` : '',
		updatedAt: c.updatedAt
	};
}
