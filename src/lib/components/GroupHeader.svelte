<script lang="ts">
	let { group, collapsed = false, ontoggle }: {
		group: { id: string; name: string; collapsed: boolean };
		collapsed?: boolean;
		ontoggle?: () => void;
	} = $props();
</script>

<div class="group-header" class:collapsed>
	<button class="group-name" onclick={ontoggle}>
		<svg
			class="chevron"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			class:rotated={!collapsed}
		>
			<path d="M9 18l6-6-6-6" />
		</svg>
		{group.name}
	</button>
</div>

<style>
	.group-header {
		margin-bottom: 8px;
		margin-top: 24px;
	}

	.group-header:first-child {
		margin-top: 0;
	}

	.group-name {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		user-select: none;
		padding: 4px 0;
		background: none;
		border: none;
		font: inherit;
		text-align: left;
	}

	.chevron {
		transition: transform var(--transition);
	}

	.chevron.rotated {
		transform: rotate(90deg);
	}

	.collapsed .group-name {
		opacity: 0.7;
	}
</style>