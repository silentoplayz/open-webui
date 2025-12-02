<script lang="ts">
	import { onMount } from 'svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { showSidebar, showThemeEditor, themeEditorCollapsed } from '$lib/stores';

	import dayjs from '$lib/dayjs';
	import { createNoteHandler } from '$lib/components/notes/utils';

	import NoteEditor from '$lib/components/notes/NoteEditor.svelte';

	let loaded = false;

	onMount(async () => {
		loaded = true;
	});
</script>

{#if loaded}
	<div
		id="note-container"
		class="w-full h-full transition-all duration-300 ease-in-out {$showSidebar
			? 'md:max-w-[calc(100%-260px)]'
			: ''} {$showThemeEditor ? ($themeEditorCollapsed ? 'pr-5' : 'pr-[600px]') : ''}"
	>
		<NoteEditor id={$page.params.id} />
	</div>
{/if}
