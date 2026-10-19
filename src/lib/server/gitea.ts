// Gitea / Forgejo client (same API): an access token, the user's repositories
// sorted by last update, and the open issues and pull requests of the
// repositories the token can read, with their totals.
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import type { GiteaData, GiteaIssue, GiteaRepo } from '$lib/types';
import { AppError } from '$lib/server/api-error';

const TIMEOUT_MS = 10_000;

export type GiteaConn = { base: string; publicBase: string; token: string };

export function giteaConnOf(c: { url: string; publicUrl?: string; apiToken?: string }): GiteaConn {
	return { base: normalizeUrl(c.url), publicBase: normalizeUrl(c.publicUrl || c.url), token: c.apiToken ?? '' };
}

export async function giteaConn(): Promise<GiteaConn | null> {
	const c = (await getIntegrations()).gitea;
	return c?.url ? giteaConnOf(c) : null;
}

export async function gitea(conn: GiteaConn, path: string): Promise<Response> {
	const res = await fetch(`${conn.base}/api/v1${path}`, {
		headers: { Accept: 'application/json', ...(conn.token ? { Authorization: `token ${conn.token}` } : {}) },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (res.status === 401) throw new AppError('errors.giteaAuth');
	if (res.status === 403) throw new AppError('errors.giteaScope');
	if (!res.ok) throw new AppError('errors.answeredHttp', { name: 'Gitea', status: res.status });
	return res;
}

type ApiUser = { login?: string; full_name?: string };
type ApiRepo = { full_name: string; html_url: string; updated_at: string; stars_count?: number; open_issues_count?: number; open_pr_counter?: number; private?: boolean };
type ApiIssue = { number: number; title: string; html_url: string; updated_at: string; user?: { login?: string }; repository?: { full_name?: string }; pull_request?: unknown };

export async function giteaUser(conn: GiteaConn): Promise<ApiUser> {
	return (await gitea(conn, '/user')).json();
}

/** Repositories the user owns or belongs to, last updated first. */
async function recentRepos(conn: GiteaConn, limit: number): Promise<GiteaRepo[]> {
	const list = (await (await gitea(conn, '/user/repos?limit=50')).json()) as ApiRepo[];
	return list
		.map((r) => ({
			name: r.full_name,
			url: r.html_url,
			updated: Date.parse(r.updated_at) || 0,
			stars: r.stars_count ?? 0,
			issues: r.open_issues_count ?? 0,
			pulls: r.open_pr_counter ?? 0,
			private: !!r.private
		}))
		.sort((a, b) => b.updated - a.updated)
		.slice(0, limit);
}

async function openOf(conn: GiteaConn, type: 'issues' | 'pulls', limit: number): Promise<{ total: number; items: GiteaIssue[] }> {
	const res = await gitea(conn, `/repos/issues/search?state=open&type=${type}&limit=${Math.max(1, limit)}`);
	const list = (await res.json()) as ApiIssue[];
	return {
		total: Number(res.headers.get('x-total-count') ?? list.length) || 0,
		items: list.map((i) => ({
			title: i.title,
			number: i.number,
			repo: i.repository?.full_name ?? '',
			url: i.html_url,
			updated: Date.parse(i.updated_at) || 0,
			pull: type === 'pulls' || !!i.pull_request,
			author: i.user?.login ?? ''
		}))
	};
}

export async function overview(conn: GiteaConn, opts: { repos: number; issues: number }): Promise<GiteaData> {
	const [user, repos, issues, pulls] = await Promise.all([
		giteaUser(conn),
		opts.repos > 0 ? recentRepos(conn, opts.repos) : Promise.resolve([]),
		opts.issues > 0 ? openOf(conn, 'issues', opts.issues) : Promise.resolve(null),
		opts.issues > 0 ? openOf(conn, 'pulls', opts.issues) : Promise.resolve(null)
	]);
	return {
		user: user.full_name || user.login || '',
		url: conn.publicBase,
		repos,
		// Issues and pull requests together, last updated first.
		open: issues && pulls ? [...issues.items, ...pulls.items].sort((a, b) => b.updated - a.updated).slice(0, opts.issues) : [],
		counts: issues && pulls ? { issues: issues.total, pulls: pulls.total } : null
	};
}
