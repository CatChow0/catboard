<script lang="ts">
	let { status }: { status: 'online' | 'offline' | 'error' | 'checking' } = $props();

	const colors: Record<string, string> = {
		online: 'var(--success)',
		offline: 'var(--danger)',
		error: 'var(--warning)',
		checking: 'var(--text-muted)'
	};
</script>

<span
	class="status-dot"
	style="background-color: {colors[status] || 'var(--text-muted)'}"
	title={status}
></span>

<style>
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
		flex-shrink: 0;
		transition: background-color var(--transition);
	}
</style>