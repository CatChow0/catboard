// Service icon URL. The server resolves the icon (picked library icon, custom
// URL / upload, name match, then favicon) and caches it; the URL changes when
// the service's icon settings change, so browsers can cache it for long.
export function iconSrc(s: { icon?: string; name?: string; url?: string }): string {
	const p = new URLSearchParams();
	if (s.icon) p.set('icon', s.icon);
	if (s.name) p.set('name', s.name);
	if (s.url) p.set('url', s.url);
	return `/api/icon?${p}`;
}

/** Human description of an icon value ("selfh.st · orca-slicer", "Custom URL"...). */
export function describeIcon(value: string): string {
	if (!value) return 'Auto (by name, then favicon)';
	if (value.startsWith('custom:')) return 'Uploaded image';
	if (value.startsWith('url:')) return `URL · ${value.slice(4)}`;
	const m = value.match(/^(selfhst|homarr):(.+)$/);
	if (m) return `${m[1] === 'selfhst' ? 'selfh.st' : 'homarr'} · ${m[2]}`;
	return value;
}
