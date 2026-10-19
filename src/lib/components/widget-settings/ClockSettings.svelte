<script lang="ts">
	import { t } from '$lib/i18n';
	import type { ClockConfig } from '$lib/types';

	let { config = $bindable() }: { config: ClockConfig } = $props();
</script>

<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showSeconds} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showSeconds')}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.format12h} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.12HourClockAmPm')}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showDate} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showDate')}</span>
</label>
{#if config.showDate}
	<label class="toggle-switch indented">
		<input type="checkbox" bind:checked={config.showFullDate} />
		<span class="toggle-slider"></span>
		<span class="toggle-label">{$t('ws.fullDate')} <small>{$t('ws.eGSatOct10')}</small></span>
	</label>
	{#if !config.showFullDate}
		<div class="field indented-field">
			<span>{$t('ws.dateFormat')}</span>
			<div class="seg">
				<button type="button" class:active={config.dateFormat !== 'MM/DD'} onclick={() => (config.dateFormat = 'DD/MM')}>DD/MM</button>
				<button type="button" class:active={config.dateFormat === 'MM/DD'} onclick={() => (config.dateFormat = 'MM/DD')}>MM/DD</button>
			</div>
		</div>
	{/if}
{/if}

<style>
	.indented-field {
		padding-left: 28px;
	}
</style>
