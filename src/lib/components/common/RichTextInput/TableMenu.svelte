<script lang="ts">
	import type { Editor } from '@tiptap/core';

	export let editor: Editor;
	export let closeMenu: () => void;
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex flex-col gap-1">
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => {
			editor.chain().focus().addRowBefore().run();
			closeMenu();
		}}
	>
		Insert Row Above
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => {
			editor.chain().focus().addRowAfter().run();
			closeMenu();
		}}
	>
		Insert Row Below
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => {
			editor.chain().focus().deleteRow().run();
			closeMenu();
		}}
	>
		Delete Row
	</button>
	<hr class="my-1 border-gray-100 dark:border-gray-700" />
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => {
			editor.chain().focus().addColumnBefore().run();
			closeMenu();
		}}
	>
		Insert Column Before
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => {
			editor.chain().focus().addColumnAfter().run();
			closeMenu();
		}}
	>
		Insert Column After
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => {
			editor.chain().focus().deleteColumn().run();
			closeMenu();
		}}
	>
		Delete Column
	</button>
	<hr class="my-1 border-gray-100 dark:border-gray-700" />
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => {
			editor.chain().focus().deleteTable().run();
			closeMenu();
		}}
	>
		Delete Table
	</button>
</div>
