import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const CONFIG_DIR = process.env.CONFIG_DIR || join(process.cwd(), 'config');
const SESSION_FILE = join(CONFIG_DIR, 'sessions.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

interface Session {
	username: string;
	expires: number;
}

const sessions = new Map<string, Session>();
let fileLoaded = false;

async function loadSessions(): Promise<void> {
	if (fileLoaded) return;
	try {
		if (existsSync(SESSION_FILE)) {
			const data = await readFile(SESSION_FILE, 'utf-8');
			const parsed = JSON.parse(data) as Record<string, Session>;
			for (const [id, session] of Object.entries(parsed)) {
				if (session.expires > Date.now()) {
					sessions.set(id, session);
				}
			}
		}
	} catch {
		// Ignore corrupt session file
	}
	fileLoaded = true;
}

async function saveSessions(): Promise<void> {
	const obj: Record<string, Session> = {};
	for (const [id, session] of sessions) {
		obj[id] = session;
	}
	try {
		await writeFile(SESSION_FILE, JSON.stringify(obj, null, 2), 'utf-8');
	} catch {
		// Ignore write errors (read-only filesystem, etc.)
	}
}

// Clean expired sessions every hour
setInterval(async () => {
	const now = Date.now();
	let changed = false;
	for (const [id, session] of sessions) {
		if (session.expires < now) {
			sessions.delete(id);
			changed = true;
		}
	}
	if (changed) await saveSessions();
}, 3600000);

export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
	return bcrypt.compareSync(password, hash);
}

export async function createSession(username: string): Promise<string> {
	await loadSessions();
	const id = crypto.randomBytes(32).toString('hex');
	sessions.set(id, {
		username,
		expires: Date.now() + SESSION_MAX_AGE * 1000
	});
	await saveSessions();
	return id;
}

export async function validateSession(sessionId: string): Promise<string | null> {
	await loadSessions();
	const session = sessions.get(sessionId);
	if (!session) return null;
	if (session.expires < Date.now()) {
		sessions.delete(sessionId);
		await saveSessions();
		return null;
	}
	return session.username;
}

export async function destroySession(sessionId: string): Promise<void> {
	await loadSessions();
	sessions.delete(sessionId);
	await saveSessions();
}

/**
 * Whether the session cookie should carry the `Secure` flag.
 * `COOKIE_SECURE=true|false` forces it. Otherwise it follows `X-Forwarded-Proto` from a
 * TLS-terminating reverse proxy, so plain-HTTP LAN access (browsers, Android app) keeps a
 * session. adapter-node reports `url.protocol` as https unless `ORIGIN`/`PROTOCOL_HEADER`
 * is configured, so the URL scheme is only trusted when one of those is set.
 */
export function isSecureRequest(url: URL, headers: Headers): boolean {
	const forced = process.env.COOKIE_SECURE?.toLowerCase();
	if (forced === 'true') return true;
	if (forced === 'false') return false;
	const proto = headers.get('x-forwarded-proto')?.split(',')[0].trim().toLowerCase();
	if (proto) return proto === 'https';
	if (process.env.ORIGIN || process.env.PROTOCOL_HEADER) return url.protocol === 'https:';
	return false;
}

export function getSessionCookieHeader(sessionId: string, secure: boolean): string {
	return `sid=${sessionId}; Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`;
}

export function getDeleteCookieHeader(secure: boolean): string {
	return `sid=; Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Max-Age=0`;
}
