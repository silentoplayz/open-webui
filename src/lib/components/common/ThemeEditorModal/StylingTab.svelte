<script lang="ts">
	import { createEventDispatcher, getContext, tick } from 'svelte';
	import type { Theme } from '$lib/types';
	import Switch from '$lib/components/common/Switch.svelte';
	import Collapsible from '$lib/components/common/Collapsible.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import CodeBlock from '$lib/components/chat/Messages/CodeBlock.svelte';
	import { objectToCss, cssToObject } from '$lib/utils/theme';
	import { toast } from 'svelte-sonner';
	import { Vibrant } from 'node-vibrant/browser';
	import exifr from 'exifr';
	import heic2any from 'heic2any';
	import ColorPicker from 'svelte-awesome-color-picker';
	import variables from '$lib/themes/variables.json';

	export let themeCopy: Theme;
	export let variablesText: string;
	export let cssText: string;

	export let initialVariables: Record<string, string> = {};

	import { generatePalette } from '$lib/utils/palette-generator';

	let seedColor = '#2563eb'; // Default Blue
	let useNeutralSeed = false;
	let neutralSeedColor = '#171717'; // Default Dark Gray
	let showPaletteGenerator = false;

	const handleGeneratePalette = () => {
		const newPalette = generatePalette(seedColor, useNeutralSeed ? neutralSeedColor : undefined);

		themeCopy.variables = {
			...themeCopy.variables,
			...newPalette
		};
		variablesText = objectToCss(themeCopy.variables);
		dispatch('update', { ...themeCopy });
		toast.success('Palette generated successfully!');
		showPaletteGenerator = false;
	};

	let imageImportInput: HTMLInputElement;

	const dispatch = createEventDispatcher();

	const i18n = getContext('i18n');

	const handleVariablesInput = (e: CustomEvent<string>) => {
		variablesText = e.detail;
		themeCopy.variables = cssToObject(variablesText);
		dispatch('update', { ...themeCopy });
	};

	const handleCssInput = (e: CustomEvent<string>) => {
		cssText = e.detail;
		themeCopy.css = cssText;
		dispatch('update', { ...themeCopy });
	};

	const resetVariables = () => {
		// Reset to initial state (either what it was when modal opened, or empty if new)
		themeCopy.variables = JSON.parse(JSON.stringify(initialVariables));
		variablesText = objectToCss(themeCopy.variables);
		dispatch('update', { ...themeCopy });
		activeVariable = null; // Close color picker if open
		toast.success($i18n.t('Theme variables reset to initial state.'));
	};

	const generateRandomColors = () => {
		const getRandomHexColor = () => {
			const letters = '0123456789ABCDEF';
			let color = '#';
			for (let i = 0; i < 6; i++) {
				color += letters[Math.floor(Math.random() * 16)];
			}
			return color;
		};

		const newVariables = {
			...cssToObject(variablesText),
			'--color-gray-950': getRandomHexColor(),
			'--color-gray-900': getRandomHexColor(),
			'--color-gray-850': getRandomHexColor(),
			'--color-gray-800': getRandomHexColor(),
			'--color-gray-100': getRandomHexColor(),
			'--color-gray-50': getRandomHexColor(),
			'--color-blue-600': getRandomHexColor()
		};

		variablesText = objectToCss(newVariables);
		themeCopy.variables = newVariables;

		const updatedTheme = { ...themeCopy };
		dispatch('update', updatedTheme);

		toast.success(`Theme variables updated with random colors.`);
	};

	const processImageFile = async (file: File): Promise<string | null> => {
		try {
			if (
				file.type === 'image/heic' ||
				file.type === 'image/heif' ||
				file.name.toLowerCase().endsWith('.heic')
			) {
				const blob = await heic2any({ blob: file, toType: 'image/jpeg' });
				return URL.createObjectURL(Array.isArray(blob) ? blob[0] : blob);
			} else if (
				file.name.toLowerCase().match(/\.(cr2|nef|arw|dng|orf|rw2|raf|cr3)$/) ||
				file.type.startsWith('image/x-')
			) {
				const thumbnail = await exifr.thumbnail(file, { thumbnail: true, preview: true });
				if (thumbnail) {
					return URL.createObjectURL(new Blob([thumbnail], { type: 'image/jpeg' }));
				} else {
					toast.error('No embedded preview found in RAW file.');
					return null;
				}
			} else {
				return URL.createObjectURL(file);
			}
		} catch (error) {
			console.error('Error processing image:', error);
			toast.error(`Failed to process image: ${error.message}`);
			return null;
		}
	};

	const generateThemeFromImage = async (event) => {
		const file = event.target.files[0];
		if (!file) {
			return;
		}

		const imageUrl = await processImageFile(file);
		if (!imageUrl) return;

		Vibrant.from(imageUrl)
			.getPalette()
			.then((palette) => {
				const newVariables = {
					...cssToObject(variablesText),
					'--color-gray-950': palette.DarkMuted?.hex ?? '#0d0d0d',
					'--color-gray-900': palette.DarkVibrant?.hex ?? '#171717',
					'--color-gray-850': palette.Muted?.hex ?? '#262626',
					'--color-gray-800': palette.Vibrant?.hex ?? '#333333',
					'--color-gray-100': palette.LightMuted?.hex ?? '#ececec',
					'--color-gray-50': palette.LightVibrant?.hex ?? '#f9f9f9',
					'--color-blue-600': palette.Vibrant?.hex ?? '#2563eb'
				};

				variablesText = objectToCss(newVariables);
				themeCopy.variables = newVariables;
				// Note: We don't store imageFingerprint to avoid false duplicate detection
				// when different themes use the same image file for color generation

				const updatedTheme = { ...themeCopy };
				dispatch('update', updatedTheme);

				toast.success(`Theme variables updated from ${file.name}`);
				URL.revokeObjectURL(imageUrl);
			})
			.catch((err) => {
				console.error('Vibrant error:', err);
				toast.error('Failed to extract colors from image.');
				URL.revokeObjectURL(imageUrl);
			});
	};

	let showColorPicker = false;
	let activeVariable: (typeof variables)[0] | null = null;
	let activeVariableIndex: number | null = null;
	let activeColor = '';

	let isUpdatingFromPicker = false;

	const openColorPicker = (variable: typeof activeVariable, index: number) => {
		if (activeVariable === variable) {
			showColorPicker = !showColorPicker;
		} else {
			activeVariable = variable;
			activeVariableIndex = index;
			activeColor = themeCopy.variables?.[variable.name] ?? variable.defaultValue;
			showColorPicker = true;
		}
	};

	const handleColorPickerInput = (event: CustomEvent<any>) => {
		if (activeVariable) {
			activeColor = event.detail.hex;
			if (themeCopy.variables?.[activeVariable.name] !== activeColor) {
				if (!themeCopy.variables) themeCopy.variables = {};

				isUpdatingFromPicker = true;
				themeCopy.variables[activeVariable.name] = activeColor;
				variablesText = objectToCss(themeCopy.variables);
				dispatch('update', { ...themeCopy });

				// Reset flag after a delay to ensure incoming theme updates from round-trip don't override picker
				setTimeout(() => {
					isUpdatingFromPicker = false;
				}, 100);
			}
		}
	};

	// Only sync from theme if we are NOT currently updating from the picker
	$: if (themeCopy && showColorPicker && activeVariable && !isUpdatingFromPicker) {
		const val = themeCopy.variables?.[activeVariable.name] ?? activeVariable.defaultValue;
		if (val && val !== activeColor) {
			activeColor = val;
		}
	}
</script>

<input
	bind:this={imageImportInput}
	type="file"
	accept="image/*,.heic,.heif,.dng,.cr2,.nef,.arw,.orf,.rw2,.raf,.cr3"
	class="hidden"
	on:change={generateThemeFromImage}
/>

<div class="space-y-4">
	<div>
		<div class="flex items-center gap-2">
			<Switch
				bind:state={themeCopy.toggles.cssVariables}
				on:change={() => {
					// Only dispatch update if there are actual variables to apply
					if (variablesText?.trim()) {
						dispatch('update', { ...themeCopy });
					}
				}}
			/>
			<Tooltip
				content="Define custom CSS variables to be used in your theme. These are the core of the theming system."
			>
				<label
					for="theme-variables"
					class="block text-sm font-medium text-gray-700 dark:text-gray-300"
					>{$i18n.t('Custom CSS Variables')}</label
				>
			</Tooltip>
		</div>
		{#if themeCopy.toggles.cssVariables}
			<!-- Palette Generator -->
			<div class="mt-2 mb-4">
				<button
					class="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
					on:click={() => (showPaletteGenerator = !showPaletteGenerator)}
				>
					<span class="text-lg">{showPaletteGenerator ? '−' : '+'}</span>
					{$i18n.t('Advanced Palette Generator')}
				</button>

				{#if showPaletteGenerator}
					<div
						class="mt-2 p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200 space-y-4"
					>
						<div class="space-y-2">
							<label
								for="seed-color"
								class="block text-xs font-medium text-gray-700 dark:text-gray-300"
							>
								{$i18n.t('Primary Brand Color')}
							</label>
							<div class="flex items-center gap-3">
								<div
									class="relative w-10 h-10 rounded-full overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 group cursor-pointer"
								>
									<input
										id="seed-color"
										type="color"
										class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
										bind:value={seedColor}
									/>
								</div>
								<div class="flex-1">
									<input
										type="text"
										class="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500"
										bind:value={seedColor}
									/>
								</div>
							</div>
						</div>

						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<label
									for="neutral-seed-toggle"
									class="text-xs font-medium text-gray-700 dark:text-gray-300"
								>
									{$i18n.t('Custom Neutral Base')}
								</label>
								<Switch bind:state={useNeutralSeed} />
							</div>

							{#if useNeutralSeed}
								<div class="flex items-center gap-3 animate-in fade-in duration-200">
									<div
										class="relative w-10 h-10 rounded-full overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 group cursor-pointer"
									>
										<input
											type="color"
											class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
											bind:value={neutralSeedColor}
										/>
									</div>
									<div class="flex-1">
										<input
											type="text"
											class="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500"
											bind:value={neutralSeedColor}
										/>
									</div>
								</div>
							{:else}
								<p class="text-[10px] text-gray-500">
									{$i18n.t('Neutral colors will be derived from the primary color (desaturated).')}
								</p>
							{/if}
						</div>

						<button
							class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-sm"
							on:click={handleGeneratePalette}
						>
							{$i18n.t('Generate Palette')}
						</button>
					</div>
				{/if}
			</div>

			<!-- Visual Editor -->
			<div class="mt-2 text-sm text-gray-500 font-medium">Standard Colors</div>
			<div class="mt-2 grid grid-cols-2 gap-2 mb-4">
				{#each variables as variable, i}
					<button
						class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 transition group border-2 {activeVariable ===
							variable && showColorPicker
							? 'border-blue-500'
							: 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'}"
						on:click={() => openColorPicker(variable, i)}
					>
						<div class="flex flex-col text-left overflow-hidden mr-2">
							<span
								class="text-xs font-semibold truncate {activeVariable === variable &&
								showColorPicker
									? 'text-blue-600 dark:text-blue-400'
									: 'text-gray-700 dark:text-gray-200'}"
								>{variable.name.replace('--color-', '').replace(/-/g, ' ')}</span
							>
							<Tooltip content={variable.description} placement="bottom-start">
								<span class="text-[10px] text-gray-500 line-clamp-2">{variable.description}</span>
							</Tooltip>
						</div>
						<div
							class="flex-shrink-0 w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm"
							style="background-color: {themeCopy.variables?.[variable.name] ||
								variable.defaultValue}"
						></div>
					</button>

					{#if showColorPicker && activeVariable && activeVariableIndex !== null && ((i % 2 === 1 && Math.floor(i / 2) === Math.floor(activeVariableIndex / 2)) || (i === variables.length - 1 && Math.floor(i / 2) === Math.floor(activeVariableIndex / 2)))}
						<div
							class="col-span-2 mb-2 p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200"
						>
							<div class="flex items-center justify-between mb-2">
								<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
									Editing: <span class="text-blue-600 dark:text-blue-400"
										>{activeVariable.name}</span
									>
								</span>
								<button
									class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
									on:click={() => {
										if (activeVariable) {
											themeCopy.variables[activeVariable.name] = activeVariable.defaultValue;
											variablesText = objectToCss(themeCopy.variables);
											activeColor = activeVariable.defaultValue;
											dispatch('update', { ...themeCopy });
										}
									}}
								>
									Reset to Default
								</button>
							</div>
							<div class="flex justify-center color-picker-wrapper">
								<ColorPicker hex={activeColor} isDialog={false} on:input={handleColorPickerInput} />
							</div>
						</div>
					{/if}
				{/each}
			</div>

			<div class="flex justify-end mt-2 mb-4 space-x-2">
				<button
					class="px-3.5 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-black dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 transition rounded-full disabled:opacity-50 whitespace-nowrap"
					on:click={resetVariables}
				>
					{$i18n.t('Reset')}
				</button>
				<button
					class="px-3.5 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-black dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 transition rounded-full disabled:opacity-50 whitespace-nowrap"
					on:click={generateRandomColors}
				>
					{$i18n.t('Random')}
				</button>
				<button
					class="px-3.5 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-black dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 transition rounded-full disabled:opacity-50 whitespace-nowrap"
					on:click={() => {
						imageImportInput.click();
					}}
				>
					{$i18n.t('Generate from Image')}
				</button>
			</div>

			{#key 'css-variables'}
				<div class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Advanced</div>
				<div class="rounded-lg overflow-hidden">
					<Collapsible title={$i18n.t('Raw CSS Variables')}>
						<div class="mt-1" slot="content">
							<CodeBlock
								id="theme-variables-editor"
								code={variablesText}
								lang={'css'}
								edit={true}
								on:change={handleVariablesInput}
							/>
						</div>
					</Collapsible>
				</div>
			{/key}
		{/if}
	</div>
	<div>
		<div class="flex items-center gap-2">
			<Switch
				bind:state={themeCopy.toggles.customCss}
				on:change={() => {
					// Only dispatch update if there's actual CSS to apply
					if (cssText?.trim()) {
						dispatch('update', { ...themeCopy });
					}
				}}
			/>
			<Tooltip
				content="Add custom CSS rules to style the UI. This is for more advanced styling that can't be achieved with variables alone."
			>
				<label for="theme-css" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
					>{$i18n.t('Custom CSS')}</label
				>
			</Tooltip>
		</div>
		{#if themeCopy.toggles.customCss}
			{#key 'custom-css'}
				<div class="mt-1 rounded-lg overflow-hidden">
					<CodeBlock
						id="theme-css-editor"
						code={cssText}
						lang={'css'}
						edit={true}
						on:change={handleCssInput}
					/>
				</div>
			{/key}
		{/if}
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
