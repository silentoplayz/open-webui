<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';

	import { toast } from 'svelte-sonner';
	import { config, models, settings } from '$lib/stores';
	import { getContext, onMount, tick } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import {
		getPipelineValves,
		getPipelineValvesSpec,
		updatePipelineValves,
		getPipelines,
		getModels,
		getPipelinesList,
		downloadPipeline,
		deletePipeline,
		uploadPipeline
	} from '$lib/apis';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import TrashSolid from '$lib/components/icons/TrashSolid.svelte';
	import ArrowUpTray from '$lib/components/icons/ArrowUpTray.svelte';
	import ArrowDownTray from '$lib/components/icons/ArrowDownTray.svelte';

	const i18n: Writable<i18nType> = getContext('i18n');

	export let saveHandler: Function;

	let downloading = false;
	let uploading = false;

	let pipelineFiles;

	let PIPELINES_LIST = null;
	let selectedPipelinesUrlIdx = '';

	let pipelines = null;

	let valves = null;
	let valves_spec = null;
	let selectedPipelineIdx = null;

	let pipelineDownloadUrl = '';

	const updateHandler = async () => {
		const pipeline = pipelines[selectedPipelineIdx];

		if (pipeline && (pipeline?.valves ?? false)) {
			for (const property in valves_spec.properties) {
				if (valves_spec.properties[property]?.type === 'array') {
					valves[property] = valves[property].split(',').map((v) => v.trim());
				}
			}

			const res = await updatePipelineValves(
				localStorage.token,
				pipeline.id,
				valves,
				selectedPipelinesUrlIdx
			).catch((error) => {
				toast.error(`${error}`);
			});

			if (res) {
				toast.success($i18n.t('Valves updated successfully'));
				setPipelines();
				models.set(
					await getModels(
						localStorage.token,
						$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null)
					)
				);
				saveHandler();
			}
		} else {
			toast.error($i18n.t('No valves to update'));
		}
	};

	const getValves = async (idx) => {
		valves = null;
		valves_spec = null;

		valves_spec = await getPipelineValvesSpec(
			localStorage.token,
			pipelines[idx].id,
			selectedPipelinesUrlIdx
		);
		valves = await getPipelineValves(
			localStorage.token,
			pipelines[idx].id,
			selectedPipelinesUrlIdx
		);

		for (const property in valves_spec.properties) {
			if (valves_spec.properties[property]?.type === 'array') {
				valves[property] = valves[property].join(',');
			}
		}
	};

	const setPipelines = async () => {
		pipelines = null;
		valves = null;
		valves_spec = null;

		if (PIPELINES_LIST.length > 0) {
			console.debug(selectedPipelinesUrlIdx);
			pipelines = await getPipelines(localStorage.token, selectedPipelinesUrlIdx);

			if (pipelines.length > 0) {
				selectedPipelineIdx = 0;
				await getValves(selectedPipelineIdx);
			}
		} else {
			pipelines = [];
		}
	};

	const addPipelineHandler = async () => {
		downloading = true;
		const res = await downloadPipeline(
			localStorage.token,
			pipelineDownloadUrl,
			selectedPipelinesUrlIdx
		).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			toast.success($i18n.t('Pipeline downloaded successfully'));
			setPipelines();
			models.set(
				await getModels(
					localStorage.token,
					$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null)
				)
			);
		}

		downloading = false;
	};

	const uploadPipelineHandler = async () => {
		uploading = true;

		if (pipelineFiles && pipelineFiles.length !== 0) {
			const file = pipelineFiles[0];

			console.log(file);

			const res = await uploadPipeline(localStorage.token, file, selectedPipelinesUrlIdx).catch(
				(error) => {
					console.error(error);
					toast.error('Something went wrong :/');
					return null;
				}
			);

			if (res) {
				toast.success($i18n.t('Pipeline downloaded successfully'));
				setPipelines();
				models.set(
					await getModels(
						localStorage.token,
						$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null)
					)
				);
			}
		} else {
			toast.error($i18n.t('No file selected'));
		}

		pipelineFiles = null;
		const pipelineUploadInputElement = document.getElementById('pipelines-upload-input');

		if (pipelineUploadInputElement) {
			pipelineUploadInputElement.value = null;
		}

		uploading = false;
	};

	const deletePipelineHandler = async () => {
		const res = await deletePipeline(
			localStorage.token,
			pipelines[selectedPipelineIdx].id,
			selectedPipelinesUrlIdx
		).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			toast.success($i18n.t('Pipeline deleted successfully'));
			setPipelines();
			models.set(
				await getModels(
					localStorage.token,
					$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null)
				)
			);
		}
	};

	onMount(async () => {
		PIPELINES_LIST = await getPipelinesList(localStorage.token);
		console.log(PIPELINES_LIST);

		if (PIPELINES_LIST.length > 0) {
			selectedPipelinesUrlIdx = PIPELINES_LIST[0]['idx'].toString();
		}

		await setPipelines();
	});
</script>

<form
	class="flex flex-col h-full justify-between space-y-3 text-sm"
	on:submit|preventDefault={async () => {
		updateHandler();
	}}
>
	<div class="overflow-y-scroll scrollbar-hidden h-full">
		{#if PIPELINES_LIST !== null}
			<div class="flex w-full justify-between mb-2">
				<div class=" self-center text-sm font-semibold">
					{$i18n.t('Manage Pipelines')}
				</div>
			</div>

			{#if PIPELINES_LIST.length > 0}
				<div class="space-y-1">
					<div class="flex gap-2">
						<div class="flex-1">
							<select
								class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
								bind:value={selectedPipelinesUrlIdx}
								placeholder={$i18n.t('Select a pipeline url')}
								on:change={async () => {
									await tick();
									await setPipelines();
								}}
							>
								<option value="" selected disabled class="bg-gray-100 dark:bg-gray-700"
									>{$i18n.t('Select a pipeline url')}</option
								>

								{#each PIPELINES_LIST as pipelines, idx}
									<option value={pipelines.idx.toString()} class="bg-gray-100 dark:bg-gray-700"
										>{pipelines.url}</option
									>
								{/each}
							</select>
						</div>
					</div>
				</div>

				<div class=" my-2">
					<div class=" mb-2 text-sm font-medium">
						{$i18n.t('Upload Pipeline')}
					</div>
					<div class="flex w-full">
						<div class="flex-1 mr-2">
							<input
								id="pipelines-upload-input"
								bind:files={pipelineFiles}
								type="file"
								accept=".py"
								hidden
							/>

							<button
								class="w-full text-sm font-medium py-2 bg-transparent hover:bg-gray-100 border border-dashed dark:border-gray-850 dark:hover:bg-gray-850 text-center rounded-xl"
								type="button"
								on:click={() => {
									document.getElementById('pipelines-upload-input')?.click();
								}}
							>
								{#if pipelineFiles}
									{pipelineFiles.length > 0 ? `${pipelineFiles.length}` : ''} pipeline(s) selected.
								{:else}
									{$i18n.t('Click here to select a py file.')}
								{/if}
							</button>
						</div>
						<button
							class="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-850 dark:hover:bg-gray-800 dark:text-gray-100 rounded-lg transition"
							on:click={() => {
								uploadPipelineHandler();
							}}
							disabled={uploading}
							type="button"
						>
							{#if uploading}
								<div class="self-center">
									<Spinner />
								</div>
							{:else}
								<ArrowUpTray className={'size-4'} />
							{/if}
						</button>
					</div>
				</div>

				<div class=" my-2">
					<div class=" mb-2 text-sm font-medium">
						{$i18n.t('Install from Github URL')}
					</div>
					<div class="flex w-full">
						<div class="flex-1 mr-2">
							<input
								class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
								placeholder={$i18n.t('Enter Github Raw URL')}
								bind:value={pipelineDownloadUrl}
							/>
						</div>
						<button
							class="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-850 dark:hover:bg-gray-800 dark:text-gray-100 rounded-lg transition"
							on:click={() => {
								addPipelineHandler();
							}}
							disabled={downloading}
							type="button"
						>
							{#if downloading}
								<div class="self-center">
									<Spinner />
								</div>
							{:else}
								<ArrowDownTray className={'size-4'} />
							{/if}
						</button>
					</div>

					<div class="mt-2 text-xs text-gray-500">
						<span class=" font-semibold dark:text-gray-200">Warning:</span> Pipelines are a plugin
						system with arbitrary code execution —
						<span class=" font-medium dark:text-gray-400"
							>don't fetch random pipelines from sources you don't trust.</span
						>
					</div>
				</div>

				<hr class="border-gray-100 dark:border-gray-850 my-3 w-full" />

				{#if pipelines !== null}
					{#if pipelines.length > 0}
						<div class="flex w-full justify-between mb-2">
							<div class=" self-center text-sm font-semibold">
								{$i18n.t('Pipelines Valves')}
							</div>
						</div>
						<div class="space-y-1">
							{#if pipelines.length > 0}
								<div class="flex gap-2">
									<div class="flex-1">
										<select
											class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
											bind:value={selectedPipelineIdx}
											placeholder={$i18n.t('Select a pipeline')}
											on:change={async () => {
												await tick();
												await getValves(selectedPipelineIdx);
											}}
										>
											{#each pipelines as pipeline, idx}
												<option value={idx} class="bg-gray-100 dark:bg-gray-700"
													>{pipeline.name} ({pipeline.type ?? 'pipe'})</option
												>
											{/each}
										</select>
									</div>

									<button
										class="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-850 dark:hover:bg-gray-800 dark:text-gray-100 rounded-lg transition"
										on:click={() => {
											deletePipelineHandler();
										}}
										type="button"
									>
										<TrashSolid className={'size-4'} />
									</button>
								</div>
							{/if}

							<div class="space-y-1">
								{#if pipelines[selectedPipelineIdx].valves}
									{#if valves}
										{#each Object.keys(valves_spec.properties) as property, idx}
											<div class=" py-0.5 w-full justify-between">
												<div class="flex w-full justify-between">
													<div class=" self-center text-xs font-medium">
														{valves_spec.properties[property].title}
													</div>

													<button
														class="p-1 px-3 text-xs flex rounded-sm transition"
														type="button"
														on:click={() => {
															valves[property] = (valves[property] ?? null) === null ? '' : null;
														}}
													>
														{#if (valves[property] ?? null) === null}
															<span class="ml-2 self-center"> {$i18n.t('None')} </span>
														{:else}
															<span class="ml-2 self-center"> {$i18n.t('Custom')} </span>
														{/if}
													</button>
												</div>

												{#if (valves[property] ?? null) !== null}
													<!-- {valves[property]} -->
													<div class="flex mt-0.5 mb-1.5 space-x-2">
														<div class=" flex-1">
															{#if valves_spec.properties[property]?.enum ?? null}
																<select
																	class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
																	bind:value={valves[property]}
																>
																	{#each valves_spec.properties[property].enum as option}
																		<option value={option} selected={option === valves[property]}>
																			{option}
																		</option>
																	{/each}
																</select>
															{:else if (valves_spec.properties[property]?.type ?? null) === 'boolean'}
																<div class="flex justify-between items-center">
																	<div class="text-xs text-gray-500">
																		{valves[property] ? 'Enabled' : 'Disabled'}
																	</div>

																	<div class=" pr-2">
																		<Switch bind:state={valves[property]} />
																	</div>
																</div>
															{:else}
																<input
																	class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
																	type="text"
																	placeholder={valves_spec.properties[property].title}
																	bind:value={valves[property]}
																	autocomplete="off"
																	required
																/>
															{/if}
														</div>
													</div>
												{/if}
											</div>
										{/each}
									{:else}
										<Spinner className="size-5" />
									{/if}
								{:else}
									<div>No valves</div>
								{/if}
							</div>
						</div>
					{:else if pipelines.length === 0}
						<div>Pipelines Not Detected</div>
					{/if}
				{:else}
					<div class="flex justify-center">
						<div class="my-auto">
							<Spinner className="size-4" />
						</div>
					</div>
				{/if}
			{:else}
				<div>{$i18n.t('Pipelines Not Detected')}</div>
			{/if}
		{:else}
			<div class="flex justify-center h-full">
				<div class="my-auto">
					<Spinner className="size-6" />
				</div>
			</div>
		{/if}
	</div>

	{#if PIPELINES_LIST !== null && PIPELINES_LIST.length > 0}
		<div class="flex justify-end pt-3 text-sm font-medium">
			<button
				class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
				type="submit"
			>
				{$i18n.t('Save')}
			</button>
		</div>
	{/if}
</form>
