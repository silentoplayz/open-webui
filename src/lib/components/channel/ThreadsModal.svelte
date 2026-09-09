<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getContext, onMount } from 'svelte';
	const i18n = getContext('i18n');

	import { user } from '$lib/stores';
	import { getChannelThreads, pinMessage } from '$lib/apis/channels';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Modal from '$lib/components/common/Modal.svelte';

	import XMark from '$lib/components/icons/XMark.svelte';
	import Message from './Messages/Message.svelte';
	import Loader from '../common/Loader.svelte';

	export let show = false;
	export let channel = null;
	export let onPin: Function = () => {};
	export let onThread: Function = () => {};

	let page = 1;
	let threads = null;
	let query = '';
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	let allItemsLoaded = false;
	let loading = false;

	const ACTIVE_THREAD_WINDOW = 7 * 24 * 60 * 60;

	$: joinedThreads = (threads ?? []).filter((message) => message.joined);
	$: activeThreads = (threads ?? []).filter(
		(message) =>
			!message.joined &&
			message.latest_reply_at / 1000000000 > Date.now() / 1000 - ACTIVE_THREAD_WINDOW
	);
	$: olderThreads = (threads ?? []).filter(
		(message) =>
			!message.joined &&
			message.latest_reply_at / 1000000000 <= Date.now() / 1000 - ACTIVE_THREAD_WINDOW
	);

	const getThreads = async () => {
		if (!channel) return;
		if (allItemsLoaded) return;

		loading = true;
		try {
			const res = await getChannelThreads(localStorage.token, channel.id, page, query).catch(
				(error) => {
					toast.error(`${error}`);
					return null;
				}
			);

			if (res) {
				threads = [...(threads ?? []), ...res];

				if (res.length === 0) {
					allItemsLoaded = true;
				}
			}
		} catch (error) {
			console.error('Error fetching threads:', error);
		} finally {
			loading = false;
		}
	};

	const init = () => {
		page = 1;
		threads = null;
		allItemsLoaded = false;

		getThreads();
	};

	const handleSearchInput = () => {
		if (channel === null) return;

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			init();
		}, 300);
	};

	$: if (show) {
		query = '';
		init();
	}

	onMount(() => {
		init();
	});
</script>

{#if channel}
	<Modal size="sm" bind:show>
		<div>
			<div class=" flex justify-between dark:text-gray-100 px-4 pt-3 mb-1">
				<div class="self-center text-base">
					<div class="flex items-center gap-0.5 shrink-0">
						{$i18n.t('Threads')}
					</div>
				</div>
				<button
					class="self-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
					on:click={() => {
						show = false;
					}}
				>
					<XMark className={'size-4'} />
				</button>
			</div>

			<div class="flex flex-col md:flex-row w-full px-4 pb-4 md:space-x-4 dark:text-gray-200">
				<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
					<div class="flex flex-col w-full h-full pb-2 gap-1">
						<div class="flex gap-1 px-1 mb-1">
							<div class=" flex w-full space-x-2">
								<div class="flex flex-1 items-center">
									<div class=" self-center ml-1 mr-3">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="w-4 h-4"
										>
											<path
												fill-rule="evenodd"
												d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<input
										class=" w-full text-sm pr-4 py-1 rounded-r-xl outline-hidden bg-transparent"
										bind:value={query}
										on:input={handleSearchInput}
										placeholder={$i18n.t('Search Threads')}
									/>
								</div>
							</div>
						</div>

						{#if threads === null}
							<div class="my-10">
								<Spinner className="size-5" />
							</div>
						{:else}
							<div
								class="flex flex-col gap-2 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent pt-7 pb-2"
							>
								{#if threads.length === 0}
									<div class=" text-center text-xs text-gray-500 dark:text-gray-400 py-6">
										{$i18n.t('No threads')}
									</div>
								{:else}
									{#each [[$i18n.t('Joined Threads'), joinedThreads], [$i18n.t('Other Active Threads'), activeThreads], [$i18n.t('Older Threads'), olderThreads]] as [label, group], groupIdx}
										{#if group.length > 0}
											<div
												class="w-full text-xs text-gray-500 dark:text-gray-500 font-normal {groupIdx ===
												0
													? ''
													: 'pt-5'} pb-2 px-2"
											>
												{label}
											</div>

											{#each group as message (message.id)}
												<Message
													id="thread"
													className="rounded-xl px-2"
													{message}
													{channel}
													onThread={(id) => {
														show = false;
														onThread(id);
													}}
													onPin={async (message) => {
														const pinned = !message.is_pinned;
														const pinnedBy = pinned ? ($user?.id ?? null) : null;
														const pinnedAt = pinned ? Date.now() * 1000000 : null;

														threads = threads.map((m) => {
															if (m.id === message.id) {
																m.is_pinned = pinned;
																m.pinned_by = pinnedBy;
																m.pinned_at = pinnedAt;
															}
															return m;
														});

														onPin(message.id, pinned, pinnedBy, pinnedAt);

														await pinMessage(
															localStorage.token,
															message.channel_id,
															message.id,
															pinned
														).catch((error) => {
															toast.error(`${error}`);
															return null;
														});
													}}
													onReaction={false}
													onReply={false}
													onEdit={false}
													onDelete={false}
												/>
											{/each}
										{/if}
									{/each}

									{#if !allItemsLoaded}
										<Loader
											on:visible={(e) => {
												if (!loading) {
													page += 1;
													getThreads();
												}
											}}
										>
											<div
												class="w-full flex justify-center py-1 text-xs animate-pulse items-center gap-2"
											>
												<Spinner className=" size-4" />
												<div class=" ">{$i18n.t('Loading...')}</div>
											</div>
										</Loader>
									{/if}
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</Modal>
{/if}
