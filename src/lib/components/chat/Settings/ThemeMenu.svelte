<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { flyAndScale } from '$lib/utils/transitions';
	import { getContext } from 'svelte';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Clipboard from '$lib/components/icons/Clipboard.svelte';
	import Share from '$lib/components/icons/Share.svelte';
	import DocumentArrowDown from '$lib/components/icons/DocumentArrowDown.svelte';
	import DocumentDuplicate from '$lib/components/icons/DocumentDuplicate.svelte';
	import ArrowPath from '$lib/components/icons/ArrowPath.svelte';

	const i18n = getContext('i18n');

	export let copyHandler: Function;
	export let shareHandler: Function;
	export let exportHandler: Function;
	export let duplicateHandler: Function;
	export let checkForUpdateHandler: Function | null = null;
	export let hasSourceUrl: boolean = false;

	export let onClose: Function;
	export let onOpenChange: ((open: boolean) => void) | undefined = undefined;

	let show = false;
</script>

<Dropdown
	bind:show
	portal={null}
	on:change={(e) => {
		if (e.detail === false) {
			onClose();
		}
		if (onOpenChange) {
			onOpenChange(e.detail);
		}
	}}
>
	<Tooltip content={$i18n.t('More')}>
		<slot />
	</Tooltip>

	<div slot="content">
		<DropdownMenu.Content
			strategy="absolute"
			class="w-full max-w-[180px] rounded-xl p-1 border border-gray-100  dark:border-gray-800 z-[9999] bg-white dark:bg-gray-850 dark:text-white shadow-lg"
			sideOffset={4}
			side="bottom"
			align="end"
			transition={flyAndScale}
		>
			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm  font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800  rounded-md"
				on:click={() => {
					copyHandler();
					show = false;
				}}
			>
				<Clipboard className="w-4 h-4" />
				<div class="flex items-center">{$i18n.t('Copy')}</div>
			</DropdownMenu.Item>

			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm  font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800  rounded-md"
				on:click={() => {
					shareHandler();
					show = false;
				}}
			>
				<Share className="w-4 h-4" />
				<div class="flex items-center">{$i18n.t('Share')}</div>
			</DropdownMenu.Item>

			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm  font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
				on:click={() => {
					exportHandler();
					show = false;
				}}
			>
				<DocumentArrowDown className="w-4 h-4" />
				<div class="flex items-center">{$i18n.t('Export')}</div>
			</DropdownMenu.Item>

			<DropdownMenu.Item
				class="flex gap-2 items-center px-3 py-1.5 text-sm  font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
				on:click={() => {
					duplicateHandler();
					show = false;
				}}
			>
				<DocumentDuplicate className="w-4 h-4" />
				<div class="flex items-center">{$i18n.t('Clone')}</div>
			</DropdownMenu.Item>

			{#if hasSourceUrl && checkForUpdateHandler}
				<DropdownMenu.Item
					class="flex gap-2 items-center px-3 py-1.5 text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
					on:click={() => {
						checkForUpdateHandler();
						show = false;
					}}
				>
					<ArrowPath class="w-4 h-4" />
					<div class="flex items-center">{$i18n.t('Check for Update')}</div>
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</div>
</Dropdown>
