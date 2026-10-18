<script lang="ts">
	// "Run" button of a Jenkins job (admins only): starts the build at once,
	// or first asks for the job's parameters, pre-filled with their defaults.
	import type { JenkinsParameter } from '$lib/types';
	import { currentUser } from '$lib/stores/dashboard';
	import WidgetModal from '../widget/WidgetModal.svelte';

	let { job, hasParameters = false, onqueued }: { job: string; hasParameters?: boolean; onqueued?: () => void } = $props();

	const isAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');

	let busy = $state(false);
	let message = $state<{ ok: boolean; text: string } | null>(null);
	let parameters = $state<JenkinsParameter[] | null>(null);
	let values = $state<Record<string, string | boolean>>({});

	function flash(ok: boolean, text: string) {
		message = { ok, text };
		setTimeout(() => (message = null), ok ? 3000 : 6000);
	}

	async function start(params?: Record<string, string | boolean>) {
		busy = true;
		try {
			const res = await fetch('/api/integrations/jenkins/build', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ job, params })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			parameters = null;
			flash(true, 'Queued');
			onqueued?.();
		} catch (e) {
			flash(false, e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}

	async function run() {
		if (!hasParameters) return start();
		busy = true;
		try {
			const res = await fetch(`/api/integrations/jenkins/params?job=${encodeURIComponent(job)}`);
			const body = await res.json();
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			parameters = body.parameters;
			values = Object.fromEntries((body.parameters as JenkinsParameter[]).map((p) => [p.name, p.default]));
		} catch (e) {
			flash(false, e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}
</script>

{#if isAdmin && job}
	<span class="jr">
		{#if message}<span class="msg" class:err={!message.ok} title={message.text}>{message.text}</span>{/if}
		<button class="run" onclick={run} onpointerdown={(e) => e.stopPropagation()} disabled={busy} title="Start a build of {job}" aria-label="Start a build of {job}">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
			Run
		</button>
	</span>
{/if}

{#if parameters}
	<WidgetModal title="Run {job.split('/').pop()}" saveLabel={busy ? 'Starting…' : 'Run'} saveDisabled={busy} onclose={() => (parameters = null)} onsave={() => start($state.snapshot(values))}>
		{#each parameters as p (p.name)}
			{#if p.type === 'boolean'}
				<label class="toggle-switch">
					<input type="checkbox" checked={values[p.name] === true} onchange={(e) => (values[p.name] = e.currentTarget.checked)} />
					<span class="toggle-slider"></span>
					<span class="toggle-label">{p.name}{#if p.description} <small>{p.description}</small>{/if}</span>
				</label>
			{:else}
				<label class="field">
					<span>{p.name}</span>
					{#if p.type === 'choice'}
						<select value={String(values[p.name])} onchange={(e) => (values[p.name] = e.currentTarget.value)}>
							{#each p.choices ?? [] as c (c)}<option value={c}>{c}</option>{/each}
						</select>
					{:else if p.type === 'text'}
						<textarea rows="3" value={String(values[p.name] ?? '')} oninput={(e) => (values[p.name] = e.currentTarget.value)}></textarea>
					{:else}
						<input type={p.type === 'password' ? 'password' : 'text'} value={String(values[p.name] ?? '')} oninput={(e) => (values[p.name] = e.currentTarget.value)} />
					{/if}
					{#if p.description}<span class="hint">{p.description}</span>{/if}
				</label>
			{/if}
		{:else}
			<p class="hint">This job has no parameters.</p>
		{/each}
		{#if message && !message.ok}<p class="hint err">{message.text}</p>{/if}
	</WidgetModal>
{/if}

<style>
	.jr {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.run {
		display: flex;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
		padding: 4px 10px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-size: 0.76rem;
		font-weight: 600;
	}

	.run:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.run:disabled {
		opacity: 0.6;
	}

	.msg {
		font-size: 0.72rem;
		color: var(--success, #22c55e);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.msg.err,
	.err {
		color: var(--danger);
	}
</style>
