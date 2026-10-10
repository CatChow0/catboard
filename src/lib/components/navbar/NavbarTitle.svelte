<script lang="ts">
	import { settings } from '$lib/stores/dashboard';
</script>

<h1 class="navbar-title">{$settings.title || 'Dashboard'}</h1>

<style>
	.navbar-title {
		font-size: calc(1.2rem * var(--nb-text, 1));
		font-weight: 700;
		letter-spacing: -0.02em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>