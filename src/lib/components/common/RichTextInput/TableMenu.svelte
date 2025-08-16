<script lang="ts">
	export let editor;
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex flex-col gap-1">
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().addRowBefore().run()}
	>
		Insert Row Above
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().addRowAfter().run()}
	>
		Insert Row Below
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().deleteRow().run()}
	>
		Delete Row
	</button>
	<hr class="my-1 border-gray-100 dark:border-gray-700" />
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().addColumnBefore().run()}
	>
		Insert Column Before
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().addColumnAfter().run()}
	>
		Insert Column After
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().deleteColumn().run()}
	>
		Delete Column
	</button>
	<hr class="my-1 border-gray-100 dark:border-gray-700" />
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().setCellAttribute('textAlign', 'left').run()}
	>
		Align Left
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().setCellAttribute('textAlign', 'center').run()}
	>
		Align Center
	</button>
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().setCellAttribute('textAlign', 'right').run()}
	>
		Align Right
	</button>
	<hr class="my-1 border-gray-100 dark:border-gray-700" />
	<button
		class="p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
		on:click={() => editor.chain().focus().deleteTable().run()}
	>
		Delete Table
	</button>
</div>
