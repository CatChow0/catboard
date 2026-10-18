// fetch that can skip TLS certificate checks, for services that commonly run
// with a self-signed certificate (Proxmox, Portainer). Only used when the
// connection's "Skip TLS verification" option is on.
import { Agent, fetch as undiciFetch } from 'undici';

const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

export type FetchInit = RequestInit & { insecure?: boolean };

export async function httpFetch(url: string, { insecure, ...init }: FetchInit = {}): Promise<Response> {
	if (!insecure || !url.startsWith('https:')) return fetch(url, init);
	return (await undiciFetch(url, { ...(init as object), dispatcher: insecureAgent })) as unknown as Response;
}

/** Toggle fields are stored as the string "true". */
export const isOn = (v: unknown) => v === true || v === 'true';
