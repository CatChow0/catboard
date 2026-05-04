export const pausedInstances = new Map<string, number>(); // instanceId → pausedUntil timestamp

export function basicAuth(username: string, password: string): string {
	const creds = Buffer.from(`${username}:${password}`).toString('base64');
	return `Basic ${creds}`;
}

export async function setAdGuardProtection(url: string, auth: string, enabled: boolean) {
	const res = await fetch(`${url.replace(/\/+$/, '')}/control/protection`, {
		method: 'POST',
		headers: {
			Authorization: auth,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({ enabled }),
		signal: AbortSignal.timeout(5000)
	});
	if (!res.ok) throw new Error(`Protection ${res.status}`);
}
