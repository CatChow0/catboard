// Jenkins REST client: basic auth with a user API token (which also spares
// the CSRF crumb on POSTs; a crumb is fetched anyway if Jenkins asks for one).
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import type { JenkinsBuild, JenkinsData, JenkinsParameter } from '$lib/types';
import { AppError } from '$lib/server/api-error';

export type JenkinsConn = { base: string; publicBase: string; auth: string };

const TIMEOUT_MS = 10_000;
const BUILD_FIELDS = 'number,result,building,timestamp,duration,estimatedDuration,url';

export async function jenkinsConn(): Promise<JenkinsConn | null> {
	const c = (await getIntegrations()).jenkins;
	if (!c?.url) return null;
	const auth = c.username ? 'Basic ' + Buffer.from(`${c.username}:${c.apiToken ?? ''}`).toString('base64') : '';
	return { base: normalizeUrl(c.url), publicBase: normalizeUrl(c.publicUrl || c.url), auth };
}

/** "folder/job" -> "job/folder/job/job" (each segment URL-encoded). */
export function jobPath(fullName: string): string {
	return fullName
		.split('/')
		.filter(Boolean)
		.map((p) => `job/${encodeURIComponent(p)}`)
		.join('/');
}

/** Links Jenkins returns use its own URL setting: point them at the public base. */
export function publicLink(conn: JenkinsConn, url: string): string {
	try {
		const u = new URL(url);
		const pub = new URL(conn.publicBase + '/');
		const basePath = new URL(conn.base + '/').pathname;
		const rest = u.pathname.startsWith(basePath) ? u.pathname.slice(basePath.length) : u.pathname.replace(/^\//, '');
		return new URL(rest + u.search, pub).toString();
	} catch {
		return url;
	}
}

export async function jenkins(conn: JenkinsConn, path: string, init: RequestInit = {}): Promise<Response> {
	const send = (extra: Record<string, string> = {}) =>
		fetch(`${conn.base}/${path.replace(/^\//, '')}`, {
			...init,
			headers: { Accept: 'application/json', ...(conn.auth ? { Authorization: conn.auth } : {}), ...(init.headers as Record<string, string>), ...extra },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	let res = await send();
	// Without an API token (or with an old Jenkins) a POST needs a CSRF crumb.
	if (res.status === 403 && init.method === 'POST') {
		const c = await fetch(`${conn.base}/crumbIssuer/api/json`, {
			headers: { Accept: 'application/json', ...(conn.auth ? { Authorization: conn.auth } : {}) },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		})
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null);
		if (c?.crumbRequestField) res = await send({ [c.crumbRequestField]: c.crumb });
	}
	return res;
}

export async function jenkinsJson<T>(conn: JenkinsConn, path: string): Promise<T> {
	const res = await jenkins(conn, path);
	if (res.status === 401) throw new AppError('errors.jenkinsAuth');
	if (res.status === 403) throw new AppError('errors.jenkinsRead');
	if (res.status === 404) throw new AppError('errors.jenkinsJob');
	if (!res.ok) throw new AppError('errors.answeredHttp', { name: 'Jenkins', status: res.status });
	return res.json() as Promise<T>;
}

type RawBuild = { number: number; result: string | null; building: boolean; timestamp: number; duration: number; estimatedDuration: number; url: string };
type RawJob = { _class?: string; name: string; fullName?: string; url: string; color?: string; buildable?: boolean; builds?: RawBuild[]; jobs?: RawJob[] };

function toBuild(conn: JenkinsConn, job: string, b: RawBuild): JenkinsBuild {
	return {
		job,
		number: b.number,
		result: (b.result as JenkinsBuild['result']) ?? null,
		building: !!b.building,
		timestamp: b.timestamp,
		duration: b.duration,
		estimatedDuration: b.estimatedDuration > 0 ? b.estimatedDuration : 0,
		url: publicLink(conn, b.url)
	};
}

/** Nested tree query for jobs inside folders, `depth` levels deep. */
function jobsTree(fields: string, depth: number): string {
	return depth <= 0 ? `jobs[${fields}]` : `jobs[${fields},${jobsTree(fields, depth - 1)}]`;
}

function flatten(jobs: RawJob[] = [], prefix = ''): (RawJob & { fullName: string })[] {
	const out: (RawJob & { fullName: string })[] = [];
	for (const j of jobs) {
		const fullName = j.fullName || (prefix ? `${prefix}/${j.name}` : j.name);
		if (j.jobs) out.push(...flatten(j.jobs, fullName));
		else out.push({ ...j, fullName });
	}
	return out;
}

/** Every buildable job (folders opened up to 3 levels), for the project picker. */
export async function listJobs(conn: JenkinsConn): Promise<{ fullName: string; color: string }[]> {
	const data = await jenkinsJson<{ jobs: RawJob[] }>(conn, `api/json?tree=${jobsTree('_class,name,fullName,color', 3)}`);
	return flatten(data.jobs)
		.filter((j) => j.color !== undefined)
		.map((j) => ({ fullName: j.fullName, color: j.color ?? '' }))
		.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** Latest builds of one job, or of every job (most recent first). */
export async function recentBuilds(conn: JenkinsConn, job: string, limit: number): Promise<JenkinsData> {
	if (!job) {
		const data = await jenkinsJson<{ jobs: RawJob[] }>(conn, `api/json?tree=${jobsTree(`name,fullName,builds[${BUILD_FIELDS}]{0,5}`, 3)}`);
		const jobs = flatten(data.jobs);
		const builds = jobs
			.flatMap((j) => (j.builds ?? []).map((b) => toBuild(conn, j.fullName, b)))
			.sort((a, b) => b.timestamp - a.timestamp)
			.slice(0, limit);
		// A project is failing while its latest finished build failed: a later
		// success clears it, a build still running does not hide it.
		const failing = jobs
			.map((j) => ({ job: j.fullName, last: (j.builds ?? []).filter((b) => !b.building).sort((a, b) => b.number - a.number)[0] }))
			.filter((j) => j.last?.result === 'FAILURE')
			.sort((a, b) => b.last.timestamp - a.last.timestamp)
			.map((j) => ({ job: j.job, number: j.last.number, url: publicLink(conn, j.last.url) }));
		return { builds, failing };
	}
	const data = await jenkinsJson<RawJob & { inQueue?: boolean; property?: { parameterDefinitions?: unknown[] }[] }>(
		conn,
		`${jobPath(job)}/api/json?tree=url,buildable,inQueue,property[parameterDefinitions[name]],builds[${BUILD_FIELDS}]{0,${limit}}`
	);
	return {
		builds: (data.builds ?? []).map((b) => toBuild(conn, job, b)),
		jobUrl: publicLink(conn, data.url),
		inQueue: !!data.inQueue,
		buildable: data.buildable !== false,
		hasParameters: (data.property ?? []).some((p) => (p.parameterDefinitions ?? []).length > 0)
	};
}

type RawParam = { name: string; type: string; description?: string; defaultParameterValue?: { value?: unknown }; choices?: string[] };

const PARAM_TYPES: Record<string, JenkinsParameter['type']> = {
	StringParameterDefinition: 'string',
	TextParameterDefinition: 'text',
	BooleanParameterDefinition: 'boolean',
	ChoiceParameterDefinition: 'choice',
	PasswordParameterDefinition: 'password'
};

export async function jobParameters(conn: JenkinsConn, job: string): Promise<JenkinsParameter[]> {
	const data = await jenkinsJson<{ property?: { parameterDefinitions?: RawParam[] }[] }>(
		conn,
		`${jobPath(job)}/api/json?tree=property[parameterDefinitions[name,type,description,defaultParameterValue[value],choices]]`
	);
	return (data.property ?? [])
		.flatMap((p) => p.parameterDefinitions ?? [])
		.map((p) => {
			const type = PARAM_TYPES[p.type] ?? 'other';
			const def = p.defaultParameterValue?.value;
			return {
				name: p.name,
				type,
				description: p.description ?? '',
				default: type === 'boolean' ? def === true : def == null ? '' : String(def),
				choices: p.choices
			};
		});
}

/** Queue a build; with parameters it goes through buildWithParameters. */
export async function startBuild(conn: JenkinsConn, job: string, params?: Record<string, string | boolean>): Promise<void> {
	const withParams = params && Object.keys(params).length > 0;
	const body = withParams ? new URLSearchParams(Object.entries(params!).map(([k, v]) => [k, String(v)])) : undefined;
	const res = await jenkins(conn, `${jobPath(job)}/${withParams ? 'buildWithParameters' : 'build'}`, {
		method: 'POST',
		headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
		body
	});
	if (res.status === 401) throw new AppError('errors.jenkinsAuth');
	if (res.status === 403) throw new AppError('errors.jenkinsBuild');
	if (res.status === 404) throw new AppError('errors.jenkinsJob');
	if (res.status === 400) throw new AppError('errors.jenkinsBuildRefused');
	if (!res.ok && res.status !== 201) throw new AppError('errors.answeredHttp', { name: 'Jenkins', status: res.status });
}
