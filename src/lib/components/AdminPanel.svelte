<script lang="ts">
	import { currentUser } from '$lib/stores/dashboard';

	let users = $state<{ username: string; role: string; isMainAdmin: boolean }[]>([]);
	let loading = $state(true);
	let error = $state('');
	let newUsername = $state('');
	let newPassword = $state('');
	let newRole = $state('user');
	let editingUser = $state<string | null>(null);
	let editRole = $state('');
	let editPassword = $state('');

	async function fetchUsers() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/users');
			if (!res.ok) throw new Error('Failed to fetch users');
			const data = await res.json();
			users = data.users;
		} catch (e: any) {
			error = e.message;
		}
		loading = false;
	}

	async function createUser() {
		if (!newUsername || !newPassword || newPassword.length < 6) {
			error = 'Username and password (min 6 chars) required';
			return;
		}
		try {
			const res = await fetch('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to create user');
			}
			newUsername = '';
			newPassword = '';
			newRole = 'user';
			await fetchUsers();
		} catch (e: any) {
			error = e.message;
		}
	}

	async function deleteUser(username: string) {
		if (!confirm(`Delete user "${username}"?`)) return;
		try {
			const res = await fetch(`/api/users/${username}`, { method: 'DELETE' });
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to delete user');
			}
			await fetchUsers();
		} catch (e: any) {
			error = e.message;
		}
	}

	async function saveUserEdit(username: string) {
		const updates: { role?: string; password?: string } = {};
		if (editRole) updates.role = editRole;
		if (editPassword) updates.password = editPassword;
		try {
			const res = await fetch(`/api/users/${username}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates)
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to update user');
			}
			editingUser = null;
			editRole = '';
			editPassword = '';
			await fetchUsers();
		} catch (e: any) {
			error = e.message;
		}
	}

	function startEdit(user: { username: string; role: string }) {
		editingUser = user.username;
		editRole = user.role;
		editPassword = '';
	}

	let isAdmin = $derived($currentUser?.role === 'admin');

	import { onMount } from 'svelte';
	onMount(fetchUsers);
</script>

<div class="admin-panel">
	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if loading}
		<p>Loading users...</p>
	{:else}
		<div class="user-list">
			{#each users as user}
				<div class="user-row">
					<div class="user-info">
						<span class="username">{user.username}</span>
						<span class="role-badge" class:admin={user.role === 'admin'} class:mini-admin={user.role === 'mini-admin'}>{user.role}</span>
						{#if user.isMainAdmin}
							<span class="main-badge">Main</span>
						{/if}
					</div>
					<div class="user-actions">
						{#if !user.isMainAdmin && (isAdmin || user.role === 'user')}
							{#if editingUser === user.username}
								<div class="edit-form">
									{#if isAdmin}
										<select bind:value={editRole}>
											<option value="admin">Admin</option>
											<option value="mini-admin">Mini-Admin</option>
											<option value="user">User</option>
										</select>
									{/if}
									<input type="password" bind:value={editPassword} placeholder="New password" />
									<button class="btn-sm btn-save" onclick={() => saveUserEdit(user.username)}>Save</button>
									<button class="btn-sm btn-cancel" onclick={() => (editingUser = null)}>Cancel</button>
								</div>
							{:else}
								<button class="btn-sm" onclick={() => startEdit(user)}>Edit</button>
								{#if isAdmin}
									<button class="btn-sm btn-danger" onclick={() => deleteUser(user.username)}>Delete</button>
								{/if}
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>

		{#if isAdmin}
			<div class="create-user">
				<h4>Create User</h4>
				<div class="create-form">
					<input type="text" bind:value={newUsername} placeholder="Username" />
					<input type="password" bind:value={newPassword} placeholder="Password (min 6)" />
					<select bind:value={newRole}>
						<option value="user">User</option>
						<option value="mini-admin">Mini-Admin</option>
						<option value="admin">Admin</option>
					</select>
					<button class="btn-create" onclick={createUser}>Create</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.admin-panel {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.error-msg {
		background: var(--danger);
		color: white;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.user-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		flex-wrap: wrap;
		gap: 8px;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.username {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.role-badge {
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		background: var(--bg-card);
		color: var(--text-secondary);
	}

	.role-badge.admin {
		background: rgba(79, 143, 255, 0.15);
		color: var(--accent);
	}

	.role-badge.mini-admin {
		background: rgba(255, 191, 79, 0.15);
		color: var(--warning);
	}

	.main-badge {
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.7rem;
		background: rgba(79, 221, 143, 0.15);
		color: var(--success);
	}

	.user-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.btn-sm {
		padding: 4px 10px;
		font-size: 0.8rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: none;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--transition);
	}

	.btn-sm:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.btn-sm.btn-danger:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.btn-sm.btn-save {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.btn-sm.btn-cancel {
		background: none;
	}

	.edit-form {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.edit-form input,
	.edit-form select {
		padding: 4px 8px;
		font-size: 0.8rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 4px;
		outline: none;
	}

	.edit-form input:focus,
	.edit-form select:focus {
		border-color: var(--accent);
	}

	.create-user {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.create-user h4 {
		font-size: 0.9rem;
		margin-bottom: 10px;
	}

	.create-form {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.create-form input,
	.create-form select {
		padding: 8px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.85rem;
		min-width: 0;
		flex: 1;
	}

	.create-form input:focus,
	.create-form select:focus {
		border-color: var(--accent);
	}

	.btn-create {
		padding: 8px 16px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-size: 0.85rem;
		transition: background var(--transition);
	}

	.btn-create:hover {
		background: var(--accent-hover);
	}
</style>