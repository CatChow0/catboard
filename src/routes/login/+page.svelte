<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let isSetup = $state(false);
	let loading = $state(true);
	let error = $state('');
	let username = $state('');
	let password = $state('');

	async function checkAuth() {
		const res = await fetch('/api/auth/check');
		const data = await res.json();
		isSetup = data.needsSetup;
		if (data.authenticated) {
			goto('/');
		}
		loading = false;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		const endpoint = isSetup ? '/api/auth/setup' : '/api/auth/login';
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, password })
		});

		const data = await res.json();
		if (!res.ok) {
			error = data.error || 'Something went wrong';
			return;
		}

		goto('/');
	}

	onMount(() => {
		checkAuth();
	});
</script>

<div class="login-page">
	<div class="login-card">
		<h1>{isSetup ? 'Create Admin Account' : 'Login'}</h1>
		<p class="subtitle">{isSetup ? 'Set up your dashboard credentials' : 'Sign in to your dashboard'}</p>
		{#if error}
			<div class="error">{error}</div>
		{/if}
		<form onsubmit={handleSubmit}>
			<div class="field">
				<label for="username">Username</label>
				<input id="username" type="text" bind:value={username} required autocomplete="username" />
			</div>
			<div class="field">
				<label for="password">Password</label>
				<input id="password" type="password" bind:value={password} required autocomplete={isSetup ? 'new-password' : 'current-password'} />
			</div>
			{#if isSetup}
				<p class="hint">Minimum 6 characters</p>
			{/if}
			<button type="submit" class="btn-login" disabled={loading}>
				{isSetup ? 'Create Account' : 'Sign In'}
			</button>
		</form>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--bg-primary);
		padding: 20px;
	}

	.login-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 40px;
		max-width: 400px;
		width: 100%;
	}

	.login-card h1 {
		font-size: 1.5rem;
		margin-bottom: 4px;
	}

	.subtitle {
		color: var(--text-secondary);
		margin-bottom: 24px;
		font-size: 0.9rem;
	}

	.error {
		background: var(--danger);
		color: white;
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		margin-bottom: 16px;
		font-size: 0.9rem;
	}

	.field {
		margin-bottom: 16px;
	}

	.field label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}

	.field input {
		width: 100%;
		padding: 10px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		transition: border-color var(--transition);
	}

	.field input:focus {
		border-color: var(--accent);
	}

	.hint {
		color: var(--text-muted);
		font-size: 0.8rem;
		margin-top: -8px;
		margin-bottom: 16px;
	}

	.btn-login {
		width: 100%;
		padding: 12px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 1rem;
		transition: background var(--transition);
		margin-top: 8px;
	}

	.btn-login:hover {
		background: var(--accent-hover);
	}

	.btn-login:disabled {
		opacity: 0.5;
	}
</style>