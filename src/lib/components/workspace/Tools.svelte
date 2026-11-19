<script lang="ts">
	import type { WorkspaceContext } from '$lib/types';
	import { getPageContext } from '$lib/utils/page';
	const { goto } = getPageContext();

	import Comments from '$lib/components/comments/Comments.svelte';
	import type { CommentsRequest } from '$lib/components/comments/CommentsPanel.svelte';
	let comments: CommentsRequest | null = null;
	import CommentButton from '$lib/components/comments/CommentButton.svelte';
	import WorkspaceAccessModal from './common/WorkspaceAccessModal.svelte';
	let accessModal: WorkspaceAccessModal;
	import { resolveLocalizedResource } from '$lib/utils/localizedContent';
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { toast } from 'svelte-sonner';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	dayjs.extend(relativeTime);

	import { onMount, getContext, tick, onDestroy } from 'svelte';
	const i18n = getContext<typeof import('$lib/i18n').default>('i18n');
	const { workspaceActions, workspaceCounts } = getContext<WorkspaceContext>('workspace');

	import { WEBUI_NAME, config, settings, tools as _tools, user } from '$lib/stores';

	import {
		createNewTool,
		loadToolByUrl,
		deleteToolById,
		exportTools,
		getToolById,
		getToolList,
		getTools,
		toggleToolById
	} from '$lib/apis/tools';
	import { capitalizeFirstLetter } from '$lib/utils';

	import Tooltip from '../common/Tooltip.svelte';
	import Switch from '../common/Switch.svelte';
	import ProfilePreview from '$lib/components/channel/Messages/Message/ProfilePreview.svelte';
	import ProfileImage from '$lib/components/chat/Messages/ProfileImage.svelte';
	import ConfirmDialog from '../common/ConfirmDialog.svelte';
	import ToolMenu from './Tools/ToolMenu.svelte';
	import EllipsisHorizontal from '../icons/EllipsisHorizontal.svelte';
	import ValvesModal from './common/ValvesModal.svelte';
	import ManifestModal from './common/ManifestModal.svelte';
	import Heart from '../icons/Heart.svelte';
	import DeleteConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import GarbageBin from '../icons/GarbageBin.svelte';
	import Search from '../icons/Search.svelte';
	import Spinner from '../common/Spinner.svelte';
	import XMark from '../icons/XMark.svelte';
	import ImportModal from '../ImportModal.svelte';
	import ViewSelector from './common/ViewSelector.svelte';
	import CommunityDiscover from './common/CommunityDiscover.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import DropdownOptions from '$lib/components/common/DropdownOptions.svelte';
	import Pagination from '../common/Pagination.svelte';
	import ChevronDown from '../icons/ChevronDown.svelte';
	import ChevronUp from '../icons/ChevronUp.svelte';

	let shiftKey = false;
	let loaded = false;

	let toolsImportInputElement: HTMLInputElement;
	let importFiles;

	let showConfirm = false;
	let query = '';
	let searchDebounceTimer: ReturnType<typeof setTimeout>;

	let showManifestModal = false;
	let showValvesModal = false;
	let selectedTool = null;

	let showDeleteConfirm = false;

	let tools = null;
	let updatingTools: Record<string, boolean> = {};
	let filteredItems = [];
	let page = 1;
	let perPage = 30;
	let gridWidth = 0;
	let innerHeight = 0;
	let gridHeight = 0;
	let gridRows = 1;
	let wrapperElement: HTMLDivElement;

	let tagsContainerElement: HTMLDivElement;
	let viewOption = '';
	let displayOption = null;
	$: hasFilters = Boolean(query || viewOption);

	let sortKey = 'updated_at';
	let sortDirection = 'desc';
	let openToolMenuId: string | null = null;

	let showImportModal = false;

	const toggleToolHandler = async (tool) => {
		if (updatingTools[tool.id]) return;
		const previousState = !tool.is_active;
		updatingTools = { ...updatingTools, [tool.id]: true };
		try {
			const updatedTool = await toggleToolById(localStorage.token, tool.id);
			tool.is_active = updatedTool.is_active;
			tool.updated_at = updatedTool.updated_at;
			tools = tools;
		} catch (error) {
			tool.is_active = previousState;
			tools = tools;
			toast.error(`${error?.detail ?? error}`);
			return;
		} finally {
			updatingTools = { ...updatingTools, [tool.id]: false };
		}

		try {
			_tools.set(await getTools(localStorage.token));
		} catch (error) {
			toast.error(`${error?.detail ?? error}`);
		}
	};

	$: if (loaded) {
		workspaceActions.set([
			{
				id: 'tools-new',
				label: $i18n.t('Create'),
				href: '/workspace/tools/create'
			},
			{
				id: 'tools-import-link',
				label: $i18n.t('Import from URL'),
				onClick: () => {
					showImportModal = true;
				},
				visible: $user?.role === 'admin'
			},
			{
				id: 'tools-import',
				label: $i18n.t('Import JSON'),
				onClick: () => toolsImportInputElement?.click(),
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.tools_import
			},
			{
				id: 'tools-export',
				label: $i18n.t('Export JSON'),
				onClick: async () => {
					const _tools = await exportTools(localStorage.token).catch((error) => {
						toast.error(`${error}`);
						return null;
					});

					if (_tools) {
						let blob = new Blob([JSON.stringify(_tools)], {
							type: 'application/json'
						});
						saveAs(blob, `tools-export-${Date.now()}.json`);
					}
				},
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.tools_export
			}
		]);
	}

	const handleSearchInput = () => {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			setFilteredItems();
		}, 300);
	};

	$: if (
		tools &&
		viewOption !== undefined &&
		sortKey !== undefined &&
		sortDirection !== undefined
	) {
		setFilteredItems();
	}

	const setPerPage = (value: number) => {
		if (value === perPage) return;
		page = Math.floor(((page - 1) * perPage) / value) + 1;
		perPage = value;
	};

	$: if (gridWidth && innerHeight && $settings) {
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const gap = rem * 0.625;
		const columns = Math.max(
			1,
			Math.floor((gridWidth + gap) / (Math.min(rem * 15, gridWidth) + gap))
		);
		gridHeight =
			columns > 1
				? Math.max(
						rem * 7.6,
						innerHeight -
							(wrapperElement?.firstElementChild?.getBoundingClientRect().bottom ?? 0) -
							rem * ($config?.features?.enable_community_sharing ? 13 : 5.5)
					)
				: 0;
		gridRows = gridHeight
			? Math.max(
					1,
					Math.min(Math.floor(100 / columns), Math.floor((gridHeight + gap) / (rem * 7.6 + gap)))
				)
			: 30;
		setPerPage(displayOption === 'grid' ? columns * gridRows : 30);
	}

	const setFilteredItems = () => {
		page = 1;
		const filtered = tools.filter((t) => {
			if (query === '' && viewOption === '') return true;
			const lowerQuery = query.toLowerCase();
			return (
				((t.name || '').toLowerCase().includes(lowerQuery) ||
					resolveLocalizedResource(t, $i18n.language).toLowerCase().includes(lowerQuery) ||
					(t.id || '').toLowerCase().includes(lowerQuery) ||
					(t.user?.name || '').toLowerCase().includes(lowerQuery) || // Search by user name
					(t.user?.email || '').toLowerCase().includes(lowerQuery)) && // Search by user email
				(viewOption === '' ||
					(viewOption === 'created' && t.user_id === $user?.id) ||
					(viewOption === 'shared' && t.user_id !== $user?.id))
			);
		});

		filteredItems = [...filtered].sort((a, b) => {
			const direction = sortDirection === 'asc' ? 1 : -1;

			if (sortKey === 'name') {
				return direction * (a.name ?? '').localeCompare(b.name ?? '');
			}

			return direction * ((a.updated_at ?? 0) - (b.updated_at ?? 0));
		});

		workspaceCounts.update((counts) => ({ ...counts, tools: filteredItems.length }));
	};

	const setSortKey = (key: string) => {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = key === 'updated_at' ? 'desc' : 'asc';
		}
	};

	const openTool = (tool) => {
		goto(`/workspace/tools/edit?id=${encodeURIComponent(tool.id)}`);
	};

	const shouldIgnoreRowClick = (target: EventTarget | null) => {
		return target instanceof Element && !!target.closest('button, a, input, [role="menu"]');
	};

	const shareHandler = async (tool) => {
		const item = await getToolById(localStorage.token, tool.id).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		// LICENSE covers this Open WebUI Community wordmark.
		// Do not alter, remove, obscure, or replace it except as LICENSE permits:
		// https://docs.openwebui.com/license.
		toast.success($i18n.t('Redirecting you to Open WebUI Community'));

		const url = 'https://openwebui.com';

		const tab = await window.open(`${url}/tools/create`, '_blank');

		const messageHandler = (event) => {
			if (event.origin !== url) return;
			if (event.data === 'loaded') {
				tab.postMessage(JSON.stringify(item), '*');
				window.removeEventListener('message', messageHandler);
			}
		};

		window.addEventListener('message', messageHandler, false);
		console.log(item);
	};

	const cloneHandler = async (tool) => {
		const _tool = await getToolById(localStorage.token, tool.id).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (_tool) {
			sessionStorage.tool = JSON.stringify({
				..._tool,
				id: `${_tool.id}_clone`,
				name: `${_tool.name} (Clone)`
			});
			goto('/workspace/tools/create');
		}
	};

	const exportHandler = async (tool) => {
		const _tool = await getToolById(localStorage.token, tool.id).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (_tool) {
			let blob = new Blob([JSON.stringify([_tool])], {
				type: 'application/json'
			});
			saveAs(blob, `tool-${_tool.id}-export-${Date.now()}.json`);
		}
	};

	const deleteHandler = async (tool) => {
		const res = await deleteToolById(localStorage.token, tool.id).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			toast.success($i18n.t('Tool deleted successfully'));
			await init();
		}
	};

	const init = async () => {
		tools = await getToolList(localStorage.token);
		_tools.set(await getTools(localStorage.token));
	};

	onMount(async () => {
		viewOption = localStorage?.workspaceViewOption || '';
		displayOption = localStorage?.workspaceDisplayOption ?? null;
		await init();
		loaded = true;

		let keyboardFocusedElement: Element | null = null;
		const onFocusIn = (event: FocusEvent) => {
			const target = event.target as Element;
			keyboardFocusedElement = target.matches(':focus-visible:not(input, textarea)')
				? target
				: null;
		};

		const onKeyDown = (event) => {
			if (event.key === 'Shift' && document.activeElement !== keyboardFocusedElement) {
				shiftKey = true;
			}
		};

		const onKeyUp = (event) => {
			if (event.key === 'Shift') {
				shiftKey = false;
			}
		};

		const onBlur = () => {
			shiftKey = false;
		};

		window.addEventListener('focusin', onFocusIn);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);

		return () => {
			clearTimeout(searchDebounceTimer);
			window.removeEventListener('focusin', onFocusIn);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
		};
	});

	onDestroy(() => {
		clearTimeout(searchDebounceTimer);
	});
	import PageTitle from '$lib/components/common/PageTitle.svelte';
</script>

<svelte:window bind:innerHeight />

<WorkspaceAccessModal bind:this={accessModal} resourceType="tools" onUpdated={init} />

<!-- LICENSE covers this Open WebUI browser-title identifier.
	Do not alter, remove, obscure, or replace it except as LICENSE permits:
	https://docs.openwebui.com/license. -->
<PageTitle title={$i18n.t('Tools') + ' / ' + $WEBUI_NAME} />

<h1 class="sr-only">{$i18n.t('Tools')}</h1>

<ImportModal
	bind:show={showImportModal}
	onImport={(tool) => {
		sessionStorage.tool = JSON.stringify({
			...tool
		});
		goto('/workspace/tools/create');
	}}
	loadUrlHandler={async (url) => {
		return await loadToolByUrl(localStorage.token, url);
	}}
	successMessage={$i18n.t('Tool imported successfully')}
/>

<Comments modal bind:view={comments} resourceType="tool">
	{#if loaded}
		<input
			id="documents-import-input"
			bind:this={toolsImportInputElement}
			bind:files={importFiles}
			type="file"
			accept=".json"
			hidden
			on:change={() => {
				console.log(importFiles);
				showConfirm = true;
			}}
		/>

		<div class="space-y-0" bind:this={wrapperElement} bind:clientWidth={gridWidth}>
			<div class="flex h-8 w-full items-center gap-2">
				<div class="flex min-w-0 flex-1">
					<div class=" self-center ml-1 mr-3">
						<Search className="size-3.5" />
					</div>
					<input
						class=" w-full text-sm pr-4 py-1 rounded-r-xl outline-hidden bg-transparent"
						bind:value={query}
						on:input={handleSearchInput}
						aria-label={$i18n.t('Search Tools')}
						placeholder={$i18n.t('Search Tools')}
					/>
					{#if query}
						<div class="self-center pl-1.5 translate-y-[0.5px] rounded-l-xl bg-transparent">
							<button
								class="py-0.5 rounded-full transition hover:text-gray-900 dark:hover:text-gray-100 text-gray-500 dark:text-gray-400 px-0"
								aria-label={$i18n.t('Clear search')}
								on:click={() => {
									query = '';
									handleSearchInput();
								}}
							>
								<XMark className="size-3" strokeWidth="2" />
							</button>
						</div>
					{/if}
				</div>

				<div
					class="flex max-w-[55%] shrink-0 overflow-x-auto scrollbar-none"
					bind:this={tagsContainerElement}
					on:wheel={(e) => {
						if (e.deltaY !== 0) {
							e.preventDefault();
							e.currentTarget.scrollLeft += e.deltaY;
						}
					}}
				>
					<div
						class="flex w-fit gap-0.5 text-center text-sm rounded-full bg-transparent whitespace-nowrap"
					>
						<ViewSelector
							bind:value={viewOption}
							align="end"
							onChange={async (value) => {
								localStorage.workspaceViewOption = value;

								await tick();
							}}
						/>

						<DropdownOptions
							align="end"
							bind:value={displayOption}
							items={[
								{ value: null, label: $i18n.t('List') },
								{ value: 'grid', label: $i18n.t('Grid') }
							]}
							onChange={() => {
								if (displayOption) {
									localStorage.workspaceDisplayOption = displayOption;
								} else {
									delete localStorage.workspaceDisplayOption;
								}
							}}
						/>
					</div>
				</div>
			</div>

			{#if (filteredItems ?? []).length !== 0}
				<div class="@container">
					{#if displayOption === null}
						<div
							class="grid grid-cols-[minmax(0,1fr)_9rem_8rem_9.5rem] items-center gap-x-4 px-2 @max-[48rem]:grid-cols-[minmax(0,1fr)_7rem_9.5rem] @max-[48rem]:gap-x-3 @max-[36rem]:grid-cols-[minmax(0,1fr)_9.5rem] @max-[36rem]:gap-x-2 min-h-6 text-xs text-gray-500 dark:text-gray-400"
						>
							<button
								class="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left"
								type="button"
								on:click={() => setSortKey('name')}
							>
								{$i18n.t('Name')}
								{#if sortKey === 'name'}
									{#if sortDirection === 'asc'}
										<ChevronUp className="size-2" />
									{:else}
										<ChevronDown className="size-2" />
									{/if}
								{/if}
							</button>

							<div class="@max-[48rem]:hidden">{$i18n.t('Owner')}</div>

							<button
								class="@max-[36rem]:hidden flex min-w-0 items-center gap-1 py-0.5 text-left"
								type="button"
								on:click={() => setSortKey('updated_at')}
							>
								{$i18n.t('Updated at')}
								{#if sortKey === 'updated_at'}
									{#if sortDirection === 'asc'}
										<ChevronUp className="size-2" />
									{:else}
										<ChevronDown className="size-2" />
									{/if}
								{/if}
							</button>
							<span class="sr-only">{$i18n.t('Actions')}</span>
						</div>

						<div class="grid gap-y-0.5">
							{#each filteredItems as tool}
								<div
									class="grid grid-cols-[minmax(0,1fr)_9rem_8rem_9.5rem] items-center gap-x-4 px-2 @max-[48rem]:grid-cols-[minmax(0,1fr)_7rem_9.5rem] @max-[48rem]:gap-x-3 @max-[36rem]:grid-cols-[minmax(0,1fr)_9.5rem] @max-[36rem]:gap-x-2 min-h-12 rounded-lg py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group text-left {tool.write_access
										? 'cursor-pointer'
										: ''}"
									role="presentation"
									on:click={(e) => {
										if (!tool.write_access || shouldIgnoreRowClick(e.target)) return;
										openTool(tool);
									}}
								>
									<div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
										<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
											<div class="flex min-w-0 items-center gap-2 overflow-hidden">
												<div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
													<Tooltip content={tool.id} className="min-w-0" placement="top-start">
														{#if tool.write_access}
															<a
																href={`/workspace/tools/edit?id=${encodeURIComponent(tool.id)}`}
																class="focus-ring block truncate rounded text-[0.8125rem] leading-5 text-gray-800 group-hover:underline focus-visible:underline dark:text-gray-200"
																>{resolveLocalizedResource(tool, $i18n.language)}</a
															>
														{:else}
															<span
																class="block truncate text-[0.8125rem] leading-5 text-gray-800 dark:text-gray-200"
																>{resolveLocalizedResource(tool, $i18n.language)}</span
															>
														{/if}
													</Tooltip>
													{#if !tool.write_access}
														<Badge type="subtle" content={$i18n.t('Read Only')} />
													{/if}

													{#if tool?.meta?.manifest?.version}
														<div
															class="min-w-0 max-w-[40%] shrink-0 truncate text-[0.6875rem] leading-5 text-gray-500"
														>
															v{tool?.meta?.manifest?.version ?? ''}
														</div>
													{/if}
												</div>
											</div>

											<div class="mt-0.5 min-w-0">
												{#if resolveLocalizedResource(tool, $i18n.language, 'description')}
													<Tooltip
														content={resolveLocalizedResource(tool, $i18n.language, 'description')}
														className="min-w-0"
														placement="top-start"
													>
														<div
															class="truncate text-xs leading-4 text-gray-500 dark:text-gray-400"
														>
															{resolveLocalizedResource(tool, $i18n.language, 'description')}
														</div>
													</Tooltip>
												{/if}
											</div>
										</div>
									</div>

									<div class="@max-[48rem]:hidden min-w-0 text-xs text-gray-600 dark:text-gray-400">
										<ProfilePreview
											user={tool?.user ?? null}
											side="bottom"
											className="w-full min-w-0"
										>
											<span class="flex w-full min-w-0 items-center gap-2">
												<ProfileImage
													src={tool?.user?.id
														? `/api/v1/users/${tool.user.id}/profile/image`
														: '/user.png'}
													className="size-5 shrink-0 rounded-full!"
												/>
												<span class="min-w-0 truncate">
													{capitalizeFirstLetter(
														tool?.user?.name ?? tool?.user?.email ?? $i18n.t('Deleted User')
													)}
												</span>
											</span>
										</ProfilePreview>
									</div>
									<Tooltip
										content={dayjs(tool.updated_at * 1000)
											.locale($i18n.language)
											.format('LLLL')}
										className="@max-[36rem]:hidden min-w-0"
									>
										<div
											class="shrink-0 truncate text-xs leading-5 text-gray-500 dark:text-gray-400"
										>
											{dayjs(tool.updated_at * 1000)
												.locale($i18n.language)
												.fromNow()}
										</div>
									</Tooltip>
									<div class="flex min-w-0 items-center justify-end gap-1.5">
										{#if tool.write_access}
											<div class="flex shrink-0 flex-row items-center gap-1.5 self-center">
												{#if shiftKey}
													<Tooltip content={$i18n.t('Delete')}>
														<button
															class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
															type="button"
															aria-label={$i18n.t('Delete')}
															on:click={(e) => {
																e.preventDefault();
																e.stopPropagation();
																deleteHandler(tool);
															}}
														>
															<GarbageBin className="size-4" />
														</button>
													</Tooltip>
												{:else}
													{#if tool?.meta?.manifest?.funding_url ?? false}
														<Tooltip content="Support">
															<button
																class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
																type="button"
																aria-label={$i18n.t('Support')}
																on:click={(e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	selectedTool = tool;
																	showManifestModal = true;
																}}
															>
																<Heart className="size-4" />
															</button>
														</Tooltip>
													{/if}

													<Tooltip content={$i18n.t('Valves')}>
														<button
															class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
															type="button"
															aria-label={$i18n.t('Valves')}
															on:click={(e) => {
																e.preventDefault();
																e.stopPropagation();
																selectedTool = tool;
																showValvesModal = true;
															}}
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
																stroke-width="1.5"
																stroke="currentColor"
																class="size-4"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
																/>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
																/>
															</svg>
														</button>
													</Tooltip>

													<CommentButton
														onComment={(request) => (comments = request)}
														modal
														className="flex size-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
														resource={{ resource_type: 'tool', resource_id: tool.id }}
													/>
													<ToolMenu
														onComment={(request) => (comments = request)}
														resourceId={tool.id}
														accessHandler={$user?.permissions?.sharing?.tools ||
														$user?.role === 'admin'
															? () => accessModal.open(tool.id)
															: null}
														show={openToolMenuId === tool.id}
														editHandler={() => {
															goto(`/workspace/tools/edit?id=${encodeURIComponent(tool.id)}`);
														}}
														shareHandler={() => {
															shareHandler(tool);
														}}
														cloneHandler={() => {
															cloneHandler(tool);
														}}
														exportHandler={() => {
															exportHandler(tool);
														}}
														deleteHandler={async () => {
															selectedTool = tool;
															showDeleteConfirm = true;
														}}
														onClose={() => {
															openToolMenuId = null;
														}}
													>
														<button
															class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
															type="button"
															aria-label={$i18n.t('Tool Menu')}
															on:click={(e) => {
																e.preventDefault();
																e.stopPropagation();
																openToolMenuId = openToolMenuId === tool.id ? null : tool.id;
															}}
														>
															<EllipsisHorizontal className="size-4" />
														</button>
													</ToolMenu>
													<Tooltip
														content={updatingTools[tool.id]
															? $i18n.t('Saving...')
															: tool.is_active
																? $i18n.t('Enabled')
																: $i18n.t('Disabled')}
													>
														<Switch
															bind:state={tool.is_active}
															disabled={updatingTools[tool.id] ?? false}
															ariaLabel={`${$i18n.t('Enabled')}: ${resolveLocalizedResource(tool, $i18n.language)}`}
															on:change={() => toggleToolHandler(tool)}
														/>
													</Tooltip>
												{/if}
											</div>
										{/if}
										{#if !tool.write_access}
											<CommentButton
												onComment={(request) => (comments = request)}
												modal
												className="flex size-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												resource={{ resource_type: 'tool', resource_id: tool.id }}
											/>
											<span class="size-6 shrink-0" aria-hidden="true"></span>
											<div
												class="flex h-6 items-center"
												role="presentation"
												on:click={(e) => {
													e.stopPropagation();
													e.preventDefault();
												}}
											>
												<Switch
													state={tool.is_active}
													disabled
													tooltip={$i18n.t('Read Only')}
													ariaLabel={`${$i18n.t('Enabled')}: ${resolveLocalizedResource(tool, $i18n.language)}`}
												/>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else if displayOption === 'grid'}
						<div
							class="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-2.5 py-1"
							style={gridHeight
								? `grid-template-rows: repeat(${gridRows}, minmax(0, 1fr)); height: ${gridHeight}px;`
								: ''}
						>
							{#each filteredItems.slice((page - 1) * perPage, page * perPage) as tool}
								<div
									class="group flex min-w-0 flex-col gap-2 rounded-xl border border-black/[0.06] bg-gray-50/40 p-3 text-left transition-colors duration-75 hover:bg-black/[0.03] dark:border-white/[0.06] dark:bg-gray-900 dark:hover:bg-white/[0.03] {tool.write_access
										? 'cursor-pointer'
										: ''}"
									role="presentation"
									on:click={(e) => {
										if (!tool.write_access || shouldIgnoreRowClick(e.target)) return;
										openTool(tool);
									}}
								>
									<div class="flex min-w-0 items-center gap-2">
										<div class="flex min-w-0 flex-1 items-center gap-1">
											<Tooltip content={tool.id} className="min-w-0" placement="top-start">
												{#if tool.write_access}
													<a
														href={`/workspace/tools/edit?id=${encodeURIComponent(tool.id)}`}
														class="focus-ring block truncate rounded text-[0.8125rem] leading-5 text-gray-800 group-hover:underline focus-visible:underline dark:text-gray-200"
														>{resolveLocalizedResource(tool, $i18n.language)}</a
													>
												{:else}
													<span
														class="block truncate text-[0.8125rem] leading-5 text-gray-800 dark:text-gray-200"
														>{resolveLocalizedResource(tool, $i18n.language)}</span
													>
												{/if}
											</Tooltip>
											{#if !tool.write_access}
												<Badge type="subtle" content={$i18n.t('Read Only')} />
											{/if}

											{#if tool?.meta?.manifest?.version}
												<span class="shrink-0 text-xs leading-5 text-gray-400 dark:text-gray-500"
													>v{tool?.meta?.manifest?.version ?? ''}</span
												>
											{/if}
										</div>
										<div class="flex shrink-0 items-center gap-0.5">
											{#if tool.write_access}
												{#if shiftKey}
													<Tooltip content={$i18n.t('Delete')}>
														<button
															class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
															type="button"
															aria-label={$i18n.t('Delete')}
															on:click={(e) => {
																e.preventDefault();
																e.stopPropagation();
																deleteHandler(tool);
															}}
														>
															<GarbageBin className="size-4" />
														</button>
													</Tooltip>
												{:else}
													{#if tool?.meta?.manifest?.funding_url ?? false}
														<Tooltip content={$i18n.t('Support')}>
															<button
																class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
																type="button"
																aria-label={$i18n.t('Support')}
																on:click={(e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	selectedTool = tool;
																	showManifestModal = true;
																}}
															>
																<Heart className="size-4" />
															</button>
														</Tooltip>
													{/if}

													<Tooltip content={$i18n.t('Valves')}>
														<button
															class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
															type="button"
															aria-label={$i18n.t('Valves')}
															on:click={(e) => {
																e.preventDefault();
																e.stopPropagation();
																selectedTool = tool;
																showValvesModal = true;
															}}
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
																stroke-width="1.5"
																stroke="currentColor"
																class="size-4"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
																/>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
																/>
															</svg>
														</button>
													</Tooltip>

													<ToolMenu
														onComment={(request) => (comments = request)}
														resourceId={tool.id}
														accessHandler={$user?.permissions?.sharing?.tools ||
														$user?.role === 'admin'
															? () => accessModal.open(tool.id)
															: null}
														show={openToolMenuId === tool.id}
														editHandler={() => {
															goto(`/workspace/tools/edit?id=${encodeURIComponent(tool.id)}`);
														}}
														shareHandler={() => {
															shareHandler(tool);
														}}
														cloneHandler={() => {
															cloneHandler(tool);
														}}
														exportHandler={() => {
															exportHandler(tool);
														}}
														deleteHandler={async () => {
															selectedTool = tool;
															showDeleteConfirm = true;
														}}
														onClose={() => {
															openToolMenuId = null;
														}}
													>
														<button
															class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
															type="button"
															aria-label={$i18n.t('Tool Menu')}
															on:click={(e) => {
																e.preventDefault();
																e.stopPropagation();
																openToolMenuId = openToolMenuId === tool.id ? null : tool.id;
															}}
														>
															<EllipsisHorizontal className="size-4" />
														</button>
													</ToolMenu>
												{/if}
											{/if}
										</div>
									</div>

									<Tooltip
										content={resolveLocalizedResource(tool, $i18n.language, 'description') ?? ''}
										className="min-w-0"
										placement="top-start"
									>
										<div
											class="line-clamp-2 min-h-8 break-words text-xs leading-4 text-gray-500 dark:text-gray-400"
										>
											{resolveLocalizedResource(tool, $i18n.language, 'description') ?? ''}
										</div>
									</Tooltip>

									<div class="mt-auto flex min-w-0 items-center justify-between gap-2">
										<div
											class="flex min-w-0 items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
										>
											<div class="min-w-0">
												<ProfilePreview
													user={tool?.user ?? null}
													side="bottom"
													className="w-full min-w-0"
												>
													<span class="flex w-full min-w-0 items-center gap-1.5">
														<ProfileImage
															src={tool?.user?.id
																? `/api/v1/users/${tool.user.id}/profile/image`
																: '/user.png'}
															className="size-4 shrink-0 rounded-full!"
														/>
														<span class="min-w-0 truncate">
															{capitalizeFirstLetter(
																tool?.user?.name ?? tool?.user?.email ?? $i18n.t('Deleted User')
															)}
														</span>
													</span>
												</ProfilePreview>
											</div>
											<Tooltip
												content={dayjs(tool.updated_at * 1000)
													.locale($i18n.language)
													.format('LLLL')}
												className="shrink-0"
											>
												<span class="whitespace-nowrap text-gray-400 dark:text-gray-500"
													>{dayjs(tool.updated_at * 1000)
														.locale($i18n.language)
														.fromNow()}</span
												>
											</Tooltip>
										</div>
										<div class="flex shrink-0 items-center gap-1.5">
											<CommentButton
												onComment={(request) => (comments = request)}
												modal
												className="flex size-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												resource={{ resource_type: 'tool', resource_id: tool.id }}
											/>
											{#if tool.write_access}
												<Tooltip
													content={updatingTools[tool.id]
														? $i18n.t('Saving...')
														: tool.is_active
															? $i18n.t('Enabled')
															: $i18n.t('Disabled')}
												>
													<Switch
														bind:state={tool.is_active}
														disabled={updatingTools[tool.id] ?? false}
														ariaLabel={`${$i18n.t('Enabled')}: ${resolveLocalizedResource(tool, $i18n.language)}`}
														on:change={() => toggleToolHandler(tool)}
													/>
												</Tooltip>
											{:else}
												<div
													class="flex h-6 items-center"
													role="presentation"
													on:click={(e) => {
														e.stopPropagation();
														e.preventDefault();
													}}
												>
													<Switch
														state={tool.is_active}
														disabled
														tooltip={$i18n.t('Read Only')}
														ariaLabel={`${$i18n.t('Enabled')}: ${resolveLocalizedResource(tool, $i18n.language)}`}
													/>
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				{#if displayOption === 'grid' && filteredItems.length > perPage}
					<div class="flex justify-center mt-4 mb-2">
						<Pagination bind:page count={filteredItems.length} {perPage} />
					</div>
				{/if}
			{:else}
				<div class="flex w-full flex-col items-center justify-center py-16 pb-24">
					<div class="max-w-sm text-center text-gray-900 dark:text-gray-100">
						<div class="mb-1.5 text-sm">
							{hasFilters ? $i18n.t('No tools found') : $i18n.t('No tools yet')}
						</div>
						<div class="text-center text-xs leading-5 text-gray-500">
							{hasFilters
								? $i18n.t('Try adjusting your search or filter to find what you are looking for.')
								: $i18n.t('Items you create or that are shared with you will appear here.')}
						</div>
					</div>
				</div>
			{/if}
		</div>

		{#if $config?.features.enable_community_sharing}
			<CommunityDiscover
				href="https://openwebui.com/search?type=tool"
				title={$i18n.t('Discover a tool')}
				description={$i18n.t('Discover, download, and explore custom tools')}
			/>
		{/if}

		<DeleteConfirmDialog
			bind:show={showDeleteConfirm}
			title={$i18n.t('Delete tool?')}
			on:confirm={() => {
				deleteHandler(selectedTool);
			}}
		>
			<div class=" text-sm text-gray-500 truncate">
				{$i18n.t('This will delete')}
				<span class="  font-normal">{resolveLocalizedResource(selectedTool, $i18n.language)}</span>.
			</div>
		</DeleteConfirmDialog>

		<ValvesModal
			bind:show={showValvesModal}
			type="tool"
			id={selectedTool?.id ?? null}
			meta={selectedTool?.meta}
		/>
		<ManifestModal bind:show={showManifestModal} manifest={selectedTool?.meta?.manifest ?? {}} />

		<ConfirmDialog
			bind:show={showConfirm}
			on:confirm={() => {
				const reader = new FileReader();
				reader.onload = async (event) => {
					const _tools = JSON.parse(event.target.result);
					console.log(_tools);

					for (const tool of _tools) {
						const res = await createNewTool(localStorage.token, tool).catch((error) => {
							toast.error(`${error}`);
							return null;
						});
					}

					toast.success($i18n.t('Tool imported successfully'));
					await init();
					importFiles = null;
					toolsImportInputElement.value = '';
				};

				reader.readAsText(importFiles[0]);
			}}
		>
			<div class="text-sm text-gray-500">
				<div class=" bg-yellow-500/20 text-yellow-700 dark:text-yellow-200 rounded-lg px-4 py-3">
					<div>{$i18n.t('Please carefully review the following warnings:')}</div>

					<ul class=" mt-1 list-disc pl-4 text-xs">
						<li>
							{$i18n.t(
								'Tools have a function calling system that allows arbitrary code execution.'
							)}.
						</li>
						<li>{$i18n.t('Do not install tools from sources you do not fully trust.')}</li>
					</ul>
				</div>

				<div class="my-3">
					{$i18n.t(
						'I acknowledge that I have read and I understand the implications of my action. I am aware of the risks associated with executing arbitrary code and I have verified the trustworthiness of the source.'
					)}
				</div>
			</div>
		</ConfirmDialog>
	{:else}
		<div class="w-full h-full flex justify-center items-center">
			<Spinner className="size-5" />
		</div>
	{/if}
</Comments>
