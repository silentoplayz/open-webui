<script lang="ts">
	const i18n = getContext('i18n');
	import { getContext } from 'svelte';
	import { settings } from '$lib/stores';
	import EyeSlashSolid from '../icons/EyeSlashSolid.svelte';
	import EyeSolid from '../icons/EyeSolid.svelte';
	export let value: string = '';
	export let placeholder = '';
	export let required = true;
	export let readOnly = false;
	export let outerClassName = 'flex flex-1 bg-transparent';
	export let inputClassName = 'w-full text-sm py-0.5 bg-transparent';
	export let showButtonClassName = 'pl-1.5  transition bg-transparent';

	let show = false;
</script>

<div class={outerClassName}>
	<label class="sr-only" for="password-input">{placeholder || $i18n.t('Password')}</label>
	<input
		class={`${inputClassName} ${show ? '' : 'password'} ${($settings?.highContrastMode ?? false) ? 'placeholder:text-gray-700 dark:placeholder:text-gray-100' : ' outline-hidden placeholder:text-gray-300 dark:placeholder:text-gray-700'}`}
		{placeholder}
		id="password-input"
		bind:value
		required={required && !readOnly}
		disabled={readOnly}
		autocomplete="off"
		type="text"
	/>
	<button
		class={showButtonClassName}
		type="button"
		aria-pressed={show}
		aria-label={$i18n.t('Make password visible in the user interface')}
		on:click={(e) => {
			e.preventDefault();
			show = !show;
		}}
	>
		{#if show}
			<EyeSlashSolid className={'size-4'} />
		{:else}
			<EyeSolid className={'size-4'} />
		{/if}
	</button>
</div>
