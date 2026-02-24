<script lang="ts">
	import { createEventDispatcher, getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import { firstResponseReceived } from '$lib/stores';

	const dispatch = createEventDispatcher();
	const i18n: Writable<i18nType> = getContext('i18n');

	const newChat = () => {
		firstResponseReceived.set(false);
		dispatch('newChat');
	};
</script>

<div class="fixed bottom-32 right-0 left-0 flex justify-center" style="z-index: 100;">
	<button
		class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 shadow-lg"
		on:mousedown={newChat}
	>
		{$i18n.t('New Chat')}
	</button>
</div>
