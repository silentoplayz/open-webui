<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { createEventDispatcher, getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';

	import {
		resolveFileUrl,
		readFileAsDataUrl,
		downloadImage,
		IMAGE_SIZE_PRESETS
	} from '$lib/utils/image';
	import type { GalleryImageFile } from '$lib/utils/image';
	import { formatFileSize } from '$lib/utils';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import PanzoomContainer from '$lib/components/common/PanzoomContainer.svelte';

	import XMark from '$lib/components/icons/XMark.svelte';
	import InfoCircle from '$lib/components/icons/InfoCircle.svelte';
	import Download from '$lib/components/icons/Download.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';

	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();

	// --- Props ---
	export let imageUrl: string;
	export let imageId: string;
	export let initialPrompt: string;
	export let galleryImages: GalleryImageFile[] = [];

	// --- State ---

	// Current image being viewed/edited
	let currentImageUrl: string = imageUrl;
	let currentImageId: string = imageId;
	let currentPrompt: string = initialPrompt || '';

	// Edit controls
	let editPrompt = '';
	let editLoading = false;

	// Reference photo attachment
	let referencePhoto: { url: string; name: string } | null = null;

	// Info panel
	let showInfo = false;
	let imageDimensions = { width: 0, height: 0 };

	$: currentFile = galleryImages.find((f) => f.id === currentImageId) || null;

	// File input
	let fileInputElement: HTMLInputElement;

	// Refs
	let editInputElement: HTMLInputElement;
	let sidebarElement: HTMLDivElement;
	let panzoomRef: PanzoomContainer;

	// --- Functions ---

	const handleEdit = async () => {
		if (!editPrompt.trim()) {
			toast.error($i18n.t('Please enter a prompt'));
			return;
		}

		editLoading = true;

		try {
			// Build files array using existing backend file references (no need to re-upload)
			const files: Record<string, unknown>[] = [
				{
					type: 'image',
					id: currentImageId,
					url: currentImageId,
					name: `image-edit-${Date.now()}.png`,
					status: 'uploaded',
					content_type: 'image/png'
				}
			];

			if (referencePhoto) {
				files.push({
					type: 'image',
					url: referencePhoto.url,
					name: referencePhoto.name,
					status: 'uploaded'
				});
			}

			// Build the chat input draft with image attached and image generation enabled
			const chatDraft = {
				prompt: editPrompt,
				files,
				selectedToolIds: [],
				selectedSkillIds: [],
				selectedFilterIds: [],
				imageGenerationEnabled: true,
				webSearchEnabled: false,
				codeInterpreterEnabled: false
			};

			sessionStorage.setItem('chat-input', JSON.stringify(chatDraft));
			await goto('/?image-generation=true');
		} catch (error) {
			console.error('Failed to start edit chat:', error);
			toast.error(`${error}`);
			editLoading = false;
		}
	};

	const handleAddPhoto = () => {
		fileInputElement?.click();
	};

	const handleFileSelected = async (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		if (!file.type.startsWith('image/')) return;

		const dataUrl = await readFileAsDataUrl(file);
		referencePhoto = {
			url: dataUrl,
			name: file.name
		};

		// Reset input so the same file can be selected again
		input.value = '';
	};

	const removeReferencePhoto = () => {
		referencePhoto = null;
	};

	const scrollToSelected = (fileId: string) => {
		if (!sidebarElement) return;
		const el = sidebarElement.querySelector(`[data-image-id="${fileId}"]`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	};

	const switchGalleryImage = (file: (typeof galleryImages)[0]) => {
		const fileUrl = `/api/v1/files/${file.id}/content`;
		const prompt = (file.meta?.data as Record<string, unknown>)?.prompt as string;
		currentImageUrl = fileUrl;
		currentImageId = file.id;
		currentPrompt = prompt || '';
		imageDimensions = { width: 0, height: 0 };
		// Reset zoom when switching images
		panzoomRef?.reset();
		// Auto-scroll sidebar to keep selected thumbnail visible
		setTimeout(() => scrollToSelected(file.id), 50);
	};

	const handleImageLoad = (e: Event) => {
		const img = e.target as HTMLImageElement;
		imageDimensions = { width: img.naturalWidth, height: img.naturalHeight };
	};

	const handleKeydown = (event: KeyboardEvent) => {
		// Don't capture arrow keys when typing in the edit input
		const isTyping =
			event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

		if (event.key === 'Escape') {
			dispatch('close');
		} else if ((event.key === 'ArrowUp' || event.key === 'ArrowLeft') && !isTyping) {
			event.preventDefault();
			const idx = galleryImages.findIndex((f) => f.id === currentImageId);
			if (idx > 0) {
				switchGalleryImage(galleryImages[idx - 1]);
			}
		} else if ((event.key === 'ArrowDown' || event.key === 'ArrowRight') && !isTyping) {
			event.preventDefault();
			const idx = galleryImages.findIndex((f) => f.id === currentImageId);
			if (idx >= 0 && idx < galleryImages.length - 1) {
				switchGalleryImage(galleryImages[idx + 1]);
			}
		}
	};

	onMount(() => {
		// Focus the edit input
		setTimeout(() => editInputElement?.focus(), 100);
		// Scroll to initially selected image in sidebar
		setTimeout(() => scrollToSelected(currentImageId), 200);
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Hidden file input for Add Photo -->
<input
	bind:this={fileInputElement}
	type="file"
	accept="image/*"
	class="hidden"
	on:change={handleFileSelected}
/>

<div class="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
	<!-- Header Bar -->
	<div
		class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-white/10"
	>
		<div class="flex items-center gap-3 min-w-0 flex-1">
			<!-- Close button -->
			<button
				class="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors shrink-0"
				on:click={() => dispatch('close')}
			>
				<XMark className="size-5" />
			</button>

			<!-- Current image prompt -->
			<p
				class="text-sm text-gray-500 dark:text-white/70 line-clamp-1 min-w-0"
				title={currentPrompt || ''}
			>
				{currentPrompt || $i18n.t('Untitled')}
			</p>
		</div>

		<div class="flex items-center gap-1.5 shrink-0">
			<!-- Info -->
			<Tooltip content={$i18n.t('Info')} placement="bottom">
				<button
					class="p-1.5 rounded-lg transition-colors {showInfo
						? 'bg-gray-200 dark:bg-white/20 text-gray-900 dark:text-white'
						: 'hover:bg-gray-100 dark:hover:bg-white/10'}"
					on:click={() => (showInfo = !showInfo)}
				>
					<InfoCircle className="size-4.5" strokeWidth="2" />
				</button>
			</Tooltip>

			<!-- Download -->
			<Tooltip content={$i18n.t('Download')} placement="bottom">
				<button
					class="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
					on:click={() => downloadImage(currentImageUrl, 'generated-image.png', localStorage.token)}
				>
					<Download className="size-4.5" strokeWidth="2" />
				</button>
			</Tooltip>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex flex-1 min-h-0 relative">
		<!-- Gallery Sidebar -->
		<div
			bind:this={sidebarElement}
			class="w-16 border-r border-gray-200 dark:border-white/10 flex flex-col gap-1.5 p-2 overflow-y-auto scrollbar-none"
			on:wheel|preventDefault={(e) => {
				const idx = galleryImages.findIndex((f) => f.id === currentImageId);
				if (e.deltaY > 0 && idx < galleryImages.length - 1) {
					switchGalleryImage(galleryImages[idx + 1]);
				} else if (e.deltaY < 0 && idx > 0) {
					switchGalleryImage(galleryImages[idx - 1]);
				}
			}}
		>
			{#each galleryImages as file (file.id)}
				{@const fileUrl = `/api/v1/files/${file.id}/content`}
				{@const isSelected = currentImageId === file.id}
				<button
					data-image-id={file.id}
					class="shrink-0 w-full aspect-square rounded-lg overflow-hidden border-2 transition-all {isSelected
						? 'border-blue-500 dark:border-white/60 ring-1 ring-blue-300 dark:ring-white/30'
						: 'border-transparent hover:border-gray-300 dark:hover:border-white/20'}"
					on:click={() => switchGalleryImage(file)}
				>
					<img
						src={resolveFileUrl(fileUrl)}
						alt=""
						class="w-full h-full object-cover"
						loading="lazy"
					/>
				</button>
			{/each}
		</div>

		<!-- Canvas Area -->
		<div
			class="flex-1 flex items-center justify-center p-6 min-w-0 min-h-0 overflow-hidden isolate"
		>
			<PanzoomContainer
				bind:this={panzoomRef}
				className="flex h-full max-h-full w-full justify-center items-center"
				options={{ minZoom: 0.3, maxZoom: 5 }}
			>
				<img
					src={resolveFileUrl(currentImageUrl)}
					alt=""
					class="max-w-full max-h-full object-contain rounded-lg"
					on:load={handleImageLoad}
				/>
			</PanzoomContainer>
		</div>

		<!-- Info Sidebar (right) -->
		{#if showInfo}
			<div
				class="absolute top-0 right-0 bottom-0 w-56 border-l border-gray-200 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-4 overflow-y-auto scrollbar-none z-20"
			>
				<div class="space-y-4">
					{#if currentPrompt}
						<div>
							<div
								class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1"
							>
								{$i18n.t('Prompt')}
							</div>
							<p class="text-xs text-gray-700 dark:text-white/80 leading-relaxed break-words">
								{currentPrompt}
							</p>
						</div>
					{/if}

					{#if imageDimensions.width && imageDimensions.height}
						<div>
							<div
								class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1"
							>
								{$i18n.t('Resolution')}
							</div>
							<p class="text-xs text-gray-700 dark:text-white/80">
								{imageDimensions.width} × {imageDimensions.height}
							</p>
							<p class="text-[10px] text-gray-400 dark:text-white/50 mt-0.5">
								{((imageDimensions.width * imageDimensions.height) / 1_000_000).toFixed(1)} MP
							</p>
						</div>
					{/if}

					{#if imageDimensions.width && imageDimensions.height}
						{@const w = imageDimensions.width}
						{@const h = imageDimensions.height}
						{@const sizeKey = `${w}x${h}`}
						{@const preset = IMAGE_SIZE_PRESETS.find((p) => p.value === sizeKey)}
						{@const gcd = (() => {
							const fn = (a, b) => (b === 0 ? a : fn(b, a % b));
							return fn(w, h);
						})()}
						<div>
							<div
								class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1"
							>
								{$i18n.t('Aspect Ratio')}
							</div>
							<p class="text-xs text-gray-700 dark:text-white/80">
								{preset ? preset.label : `${w / gcd}:${h / gcd}`}
							</p>
						</div>
					{/if}

					{#if currentFile?.meta?.data?.model}
						<div>
							<div
								class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1"
							>
								{$i18n.t('Model')}
							</div>
							<p
								class="text-xs text-gray-700 dark:text-white/80 break-all"
								title={currentFile.meta.data.model}
							>
								{currentFile.meta.data.model}
							</p>
						</div>
					{/if}

					{#if currentFile?.meta?.data?.steps}
						<div>
							<div
								class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1"
							>
								{$i18n.t('Steps')}
							</div>
							<p class="text-xs text-gray-700 dark:text-white/80">
								{currentFile.meta.data.steps}
							</p>
						</div>
					{/if}

					{#if currentFile?.meta?.size}
						<div>
							<div
								class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1"
							>
								{$i18n.t('File Size')}
							</div>
							<p class="text-xs text-gray-700 dark:text-white/80">
								{formatFileSize(currentFile.meta.size)}
							</p>
						</div>
					{/if}

					{#if currentFile?.meta?.content_type}
						<div>
							<div
								class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1"
							>
								{$i18n.t('Type')}
							</div>
							<p class="text-xs text-gray-700 dark:text-white/80">
								{currentFile.meta.content_type}
							</p>
						</div>
					{/if}

					{#if currentFile?.created_at}
						<div>
							<div
								class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/40 mb-1"
							>
								{$i18n.t('Created')}
							</div>
							<p class="text-xs text-gray-700 dark:text-white/80">
								{new Date(currentFile.created_at * 1000).toLocaleDateString(undefined, {
									weekday: 'short',
									year: 'numeric',
									month: 'short',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								})}
							</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Edit Input Bar -->
	<div class="px-3 py-3">
		<div class="max-w-6xl mx-auto">
			<!-- Reference photo attachment -->
			{#if referencePhoto}
				<div class="flex items-start gap-2 mb-2">
					<div class="relative group">
						<img
							src={referencePhoto.url}
							alt={referencePhoto.name}
							class="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-white/20"
						/>
						<button
							class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-white/20 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
							on:click={removeReferencePhoto}
						>
							<XMark className="size-3" />
						</button>
					</div>
				</div>
			{/if}

			<div
				class="flex flex-col w-full shadow-lg rounded-3xl border border-gray-100/30 dark:border-gray-850/30 hover:border-gray-200 focus-within:border-gray-100 hover:dark:border-gray-800 focus-within:dark:border-gray-800 transition px-1 bg-white/5 dark:bg-gray-500/5 backdrop-blur-sm dark:text-gray-100"
			>
				<div class="px-2.5">
					<div class="pt-2.5 pb-1 px-1">
						<input
							bind:this={editInputElement}
							bind:value={editPrompt}
							type="text"
							class="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 outline-none"
							placeholder={$i18n.t('Describe edits...')}
							disabled={editLoading}
							on:paste={async (e) => {
								const items = e.clipboardData?.items;
								if (!items) return;
								for (const item of items) {
									if (item.type.startsWith('image/')) {
										e.preventDefault();
										const file = item.getAsFile();
										if (!file) break;
										const dataUrl = await readFileAsDataUrl(file);
										referencePhoto = {
											url: dataUrl,
											name: file.name || 'pasted-image.png'
										};
										break;
									}
								}
							}}
							on:keydown={(e) => {
								if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !editLoading) {
									e.preventDefault();
									handleEdit();
								}
							}}
						/>
					</div>
				</div>

				<div class="flex justify-between mt-0.5 mb-2.5 mx-0.5 max-w-full" dir="ltr">
					<div class="ml-1 self-end flex items-center gap-1">
						<Tooltip content={$i18n.t('Add Image')} placement="top">
							<button
								class="bg-transparent hover:bg-gray-100 text-gray-700 dark:text-white dark:hover:bg-gray-800 rounded-full size-8 flex justify-center items-center outline-hidden focus:outline-hidden"
								on:click={handleAddPhoto}
							>
								<Plus
									className="size-5 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 transition-colors"
									strokeWidth="2"
								/>
							</button>
						</Tooltip>
					</div>

					<div class="self-end flex items-center">
						{#if !editLoading}
							<button
								class="bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full p-2 disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={editPrompt.trim() === ''}
								on:click={handleEdit}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 16 16"
									fill="currentColor"
									class="size-4"
								>
									<path
										fill-rule="evenodd"
										d="M8 14a.75.75 0 0 1-.75-.75V4.56L4.03 7.78a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L8.75 4.56v8.69A.75.75 0 0 1 8 14Z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
						{:else}
							<div class="flex items-center gap-2 px-3.5 py-1.5 shrink-0">
								<Spinner className="size-4" />
								<span class="text-sm text-gray-500 dark:text-white/60">{$i18n.t('Editing...')}</span
								>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
