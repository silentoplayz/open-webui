<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/common/Modal.svelte';
	import { getContext } from 'svelte';

	export let show = false;
	export let themeName = '';
	export let themeVersion = '';
	export let webuiVersion = '';
	export let skipWarning = false;

	const dispatch = createEventDispatcher();
	const i18n = getContext('i18n');

	const confirm = () => {
		dispatch('confirm');
	};

	const cancel = () => {
		dispatch('cancel');
	};
</script>

<Modal bind:show {cancel} width="max-w-md" containerClassName="z-[99999]">
	<div class="p-4">
		<h2 class="text-lg font-medium">{$i18n.t('Theme Import Warning')}</h2>
		<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
			{$i18n.t('The theme')}
			<span class="font-bold">{themeName}</span>
			{$i18n.t('targets Open WebUI version')}
			<span class="font-bold">v{themeVersion}</span>
			{$i18n.t('but you are on')}
			<span class="font-bold">v{webuiVersion}</span>.
			{$i18n.t('Some theme elements may not apply correctly.')}
		</p>
		<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
			{$i18n.t('Do you want to continue importing this theme?')}
		</p>
		<div class="mt-4 flex items-center">
			<input
				id="skip-warning"
				type="checkbox"
				bind:checked={skipWarning}
				class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
			/>
			<label for="skip-warning" class="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
				{$i18n.t("Don't show again for this import session")}
			</label>
		</div>

		<div class="mt-6 flex justify-end space-x-2">
			<button
				class="px-3.5 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition rounded-full"
				on:click={cancel}
			>
				{$i18n.t('Cancel')}
			</button>
			<button
				class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
				on:click={confirm}
			>
				{$i18n.t('Continue')}
			</button>
		</div>
	</div>
</Modal>
