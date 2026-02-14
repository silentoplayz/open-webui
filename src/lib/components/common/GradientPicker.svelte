<script lang="ts">
	import { createEventDispatcher, getContext, onMount } from 'svelte';
	import type { Theme } from '$lib/types';
	import ColorPicker from 'svelte-awesome-color-picker';
	import { Vibrant } from 'node-vibrant/browser';
	import { toast } from 'svelte-sonner';
	import exifr from 'exifr';
	import heic2any from 'heic2any';
	import Sortable from 'sortablejs';
	import { v4 as uuidv4 } from 'uuid';

	export let gradient: Theme['gradient'] | undefined = {
		enabled: false,
		colors: [],
		direction: 90,
		intensity: 0
	};
	export let initialGradient: Theme['gradient'] | undefined = undefined;

	const i18n = getContext('i18n') as any;

	const dispatch = createEventDispatcher();

	// Initialize items with unique IDs for stable sorting
	let items = (gradient?.colors ?? []).map((color) => ({ id: uuidv4(), color }));

	let direction = gradient?.direction ?? 90;
	let intensity = gradient?.intensity ?? 0;
	let selectedColorIndex = 0;
	let colorsContainer: HTMLDivElement;

	// Derived colors array for parent updates
	$: colors = items.map((item) => item.color);

	onMount(() => {
		if (colorsContainer) {
			Sortable.create(colorsContainer, {
				animation: 150,
				draggable: '.draggable-color-block',
				onEnd: (event: any) => {
					if (event.oldIndex !== undefined && event.newIndex !== undefined) {
						// Reorder items array
						const movedItem = items[event.oldIndex];
						items.splice(event.oldIndex, 1);
						items.splice(event.newIndex, 0, movedItem);
						items = [...items]; // Trigger reactivity
						selectedColorIndex = event.newIndex; // Keep the moved color selected
					}
				}
			});
		}
	});

	$: {
		// Reactive statement to dispatch updates when any value changes
		dispatch('update', {
			colors,
			direction,
			intensity
		});
	}

	const addColor = () => {
		if (items.length < 6) {
			items = [...items, { id: uuidv4(), color: '#ffffff' }];
		}
	};

	const removeColor = (index: number) => {
		items = items.filter((_, i) => i !== index);
		if (selectedColorIndex >= items.length) {
			selectedColorIndex = Math.max(0, items.length - 1);
		}
	};

	const generateRandomGradient = () => {
		const numColors = Math.floor(Math.random() * 5) + 2; // 2 to 6 colors
		// Generate new items with fresh IDs
		const newItems = [];
		for (let i = 0; i < numColors; i++) {
			newItems.push({
				id: uuidv4(),
				color: '#' + Math.floor(Math.random() * 16777215).toString(16)
			});
		}
		items = newItems;
		direction = Math.floor(Math.random() * 361);
		intensity = Math.floor(Math.random() * 101);
		selectedColorIndex = 0;
		toast.success(`Generated a random ${numColors}-color gradient.`);
	};

	const resetGradient = () => {
		if (initialGradient) {
			items = initialGradient.colors.map((color) => ({ id: uuidv4(), color }));
			direction = initialGradient.direction;
			intensity = initialGradient.intensity;
			selectedColorIndex = 0;
			toast.success('Gradient settings reset to initial state.');
		}
	};

	const processImageFile = async (file: File): Promise<string | null> => {
		try {
			if (
				file.type === 'image/heic' ||
				file.type === 'image/heif' ||
				file.name.toLowerCase().endsWith('.heic')
			) {
				const blob = await heic2any({ blob: file, toType: 'image/jpeg' });
				return URL.createObjectURL(Array.isArray(blob) ? blob[0] : (blob as Blob));
			} else if (
				file.name.toLowerCase().match(/\.(cr2|nef|arw|dng|orf|rw2|raf|cr3)$/) ||
				file.type.startsWith('image/x-')
			) {
				const thumbnail = await (exifr as any).thumbnail(file);
				if (thumbnail) {
					return URL.createObjectURL(new Blob([thumbnail] as any, { type: 'image/jpeg' }));
				} else {
					toast.error('No embedded preview found in RAW file.');
					return null;
				}
			} else {
				return URL.createObjectURL(file);
			}
		} catch (error: any) {
			console.error('Error processing image:', error);
			toast.error(`Failed to process image: ${error.message}`);
			return null;
		}
	};

	const generateGradientFromImage = async (event: Event) => {
		const target = (event.target as HTMLInputElement);
		const file = target ? (target.files ? target.files[0] : null) : null;
		if (!file) {
			return;
		}

		const imageUrl = await processImageFile(file);
		if (!imageUrl) return;

		Vibrant.from(imageUrl)
			.getPalette()
			.then((palette) => {
				const newColorHexes = [];
				if (palette.Vibrant) newColorHexes.push(palette.Vibrant.hex);
				if (palette.Muted) newColorHexes.push(palette.Muted.hex);
				if (palette.DarkVibrant) newColorHexes.push(palette.DarkVibrant.hex);
				if (palette.DarkMuted) newColorHexes.push(palette.DarkMuted.hex);
				if (palette.LightVibrant) newColorHexes.push(palette.LightVibrant.hex);
				if (palette.LightMuted) newColorHexes.push(palette.LightMuted.hex);

				if (newColorHexes.length > 0) {
					items = newColorHexes.slice(0, 6).map((color) => ({ id: uuidv4(), color }));
					toast.success(`Generated a ${items.length}-color gradient from ${file.name}.`);
				} else {
					toast.error('Could not extract a palette from the image.');
				}

				URL.revokeObjectURL(imageUrl);
			})
			.catch((err) => {
				console.error('Vibrant error:', err);
				toast.error('Failed to extract colors from image.');
				URL.revokeObjectURL(imageUrl);
			});
	};
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-medium mb-2">Colors</h3>
		<div class="flex items-center justify-center space-x-2">
			<!-- Sortable Container for Colors ONLY -->
			<div class="flex items-center space-x-2" bind:this={colorsContainer}>
				{#each items as item, i (item.id)}
					<div
						class="relative group border-2 rounded-md p-1 cursor-pointer draggable-color-block"
						class:border-blue-500={selectedColorIndex === i}
						class:border-transparent={selectedColorIndex !== i}
						on:click={() => (selectedColorIndex = i)}
						role="button"
						tabindex="0"
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') selectedColorIndex = i;
						}}
					>
						<div class="w-10 h-10 rounded-sm" style="background-color: {item.color};"></div>
						<button
							type="button"
							on:click|stopPropagation={() => removeColor(i)}
							class="absolute top-0 right-0 -mt-2 -mr-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
						>
							&times;
						</button>
					</div>
				{/each}
			</div>

			<!-- Add Button Outside Sortable Container -->
			{#if items.length < 6}
				<button
					type="button"
					on:click={addColor}
					class="w-12 h-12 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-md flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-500 dark:hover:border-gray-500 transition-colors"
				>
					+
				</button>
			{/if}
		</div>

		<div class="mt-4 color-picker-wrapper flex justify-center">
			{#if items.length > 0 && items[selectedColorIndex]}
				<ColorPicker bind:hex={items[selectedColorIndex].color} isDialog={false} />
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400">
					{$i18n
						? $i18n.t('No colors selected. Add a color to start.')
						: 'No colors selected. Add a color to start.'}
				</p>
			{/if}
		</div>
	</div>

	<div>
		<h3 class="text-lg font-medium mb-2">Controls</h3>
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<label for="direction" class="font-medium">Gradient Direction</label>
				<span class="text-gray-500 dark:text-gray-400">{direction}°</span>
			</div>
			<input type="range" id="direction" min="0" max="360" bind:value={direction} class="w-full" />

			<div class="flex items-center justify-between">
				<label for="intensity" class="font-medium">Color Intensity</label>
				<span class="text-gray-500 dark:text-gray-400">{intensity}%</span>
			</div>
			<input type="range" id="intensity" min="0" max="100" bind:value={intensity} class="w-full" />

			<div class="flex justify-end mt-2 space-x-2">
				{#if initialGradient}
					<button
						type="button"
						class="px-3.5 py-1.5 text-sm font-medium bg-gray-300 dark:bg-gray-800 hover:bg-gray-400 dark:hover:bg-gray-700 transition rounded-full"
						on:click={resetGradient}
					>
						Reset
					</button>
				{/if}
				<button
					type="button"
					class="px-3.5 py-1.5 text-sm font-medium bg-gray-300 dark:bg-gray-800 hover:bg-gray-400 dark:hover:bg-gray-700 transition rounded-full"
					on:click={generateRandomGradient}
				>
					Random
				</button>
				<input
					id="image-import-input-gradient"
					type="file"
					accept="image/*,.heic,.heif,.dng,.cr2,.nef,.arw,.orf,.rw2,.raf,.cr3"
					class="hidden"
					on:change={generateGradientFromImage}
				/>
				<button
					type="button"
					class="px-3.5 py-1.5 text-sm font-medium bg-gray-300 dark:bg-gray-800 hover:bg-gray-400 dark:hover:bg-gray-700 transition rounded-full"
					on:click={() => document.getElementById('image-import-input-gradient')?.click()}
				>
					Generate from Image
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.dark .color-picker-wrapper) {
		--cp-bg-color: transparent;
		--cp-border-color: #374151; /* bg-gray-700 */
		--cp-text-color: #f9fafb; /* text-gray-50 */
		--cp-input-color: #374151; /* bg-gray-700 */
		--cp-button-hover-color: #4b5563; /* bg-gray-600 */
	}
	:global(.color-picker-wrapper) {
		--cp-bg-color: transparent;
		--cp-border-color: #d1d5db; /* bg-gray-300 */
		--cp-text-color: #111827; /* text-gray-900 */
		--cp-input-color: #e5e7eb; /* bg-gray-200 */
		--cp-button-hover-color: #d1d5db; /* bg-gray-300 */
	}
</style>
