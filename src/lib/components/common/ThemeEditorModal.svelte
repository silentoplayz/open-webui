<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
	import { getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { fly, fade } from 'svelte/transition';
	import CodeEditor from '$lib/components/common/CodeEditor.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import { WEBUI_VERSION } from '$lib/constants';
	import type { Theme } from '$lib/types';
	import Info from '$lib/components/icons/Info.svelte';
	import Collapsible from '$lib/components/common/Collapsible.svelte';
	import CodeBlock from '$lib/components/chat/Messages/CodeBlock.svelte';
	import { themes, communityThemes } from '$lib/theme';
	import { Vibrant } from 'node-vibrant/browser';
	import GradientPicker from '$lib/components/common/GradientPicker.svelte';
	import GeneralTab from './ThemeEditorModal/GeneralTab.svelte';
	import StylingTab from './ThemeEditorModal/StylingTab.svelte';
	import BackgroundsTab from './ThemeEditorModal/BackgroundsTab.svelte';
	import AnimationsTab from './ThemeEditorModal/AnimationsTab.svelte';
	import DocumentationTab from './ThemeEditorModal/DocumentationTab.svelte';
	import Sidebar from '$lib/components/icons/Sidebar.svelte';

	export let theme: Theme;
	export let show: boolean;
	export let isEditing: boolean;

	let chatBgInputValue: string | undefined;
	let systemBgInputValue: string | undefined;

	const dispatch = createEventDispatcher();
	const i18n = getContext('i18n');

	let themeCopy: Theme;
	let initialVariables: Record<string, string>;
	let variablesText: string;
	let cssText: string;
	let animationScriptText: string;
	let tsParticleConfigText: string;
	let manualEditMode = false;
	let themeJsonText = '';

	let activeTab = 'General';

	import variables from '$lib/themes/variables.json';
	import {
		WEBUI_NAME,
		banners,
		chatId,
		config,
		mobile,
		settings,
		showArchivedChats,
		showControls,
		showSidebar,
		showThemeEditor,
		themeEditorCollapsed,
		temporaryChatEnabled,
		user,
		codeMirrorTheme
	} from '$lib/stores';
	import { objectToCss, cssToObject } from '$lib/utils/theme';

	let originalCodeMirrorTheme = $codeMirrorTheme;

	let lastThemeId: string | undefined;

	$: if (theme && theme.id !== lastThemeId) {
		lastThemeId = theme.id;

		if (!manualEditMode) {
			init();
		}
	}

	const init = () => {
		if (theme) {
			themeCopy = JSON.parse(JSON.stringify(theme));

			if (!isEditing) {
				const importantVariables = [
					'--color-gray-950',
					'--color-gray-900',
					'--color-gray-850',
					'--color-gray-800',
					'--color-gray-100',
					'--color-gray-50',
					'--color-blue-600'
				];

				const newVariables = {};
				for (const v of variables) {
					if (importantVariables.includes(v.name)) {
						newVariables[v.name] = v.defaultValue;
					}
				}
				themeCopy.variables = newVariables;
			}

			chatBgInputValue =
				themeCopy.chatBackgroundImageUrl &&
				themeCopy.chatBackgroundImageUrl.startsWith('data:image')
					? 'Uploaded Image'
					: themeCopy.chatBackgroundImageUrl;

			systemBgInputValue =
				themeCopy.systemBackgroundImageUrl &&
				themeCopy.systemBackgroundImageUrl.startsWith('data:image')
					? 'Uploaded Image'
					: themeCopy.systemBackgroundImageUrl;

			if (typeof themeCopy.systemBackgroundImageDarken === 'undefined') {
				themeCopy.systemBackgroundImageDarken = 75;
			}
			if (typeof themeCopy.chatBackgroundImageDarken === 'undefined') {
				themeCopy.chatBackgroundImageDarken = 75;
			}

			if (!themeCopy.gradient) {
				themeCopy.gradient = {
					enabled: false,
					colors: ['#0d0d0d', '#333333'],
					direction: 45,
					intensity: 100
				};
			} else if (typeof themeCopy.gradient.enabled === 'undefined') {
				themeCopy.gradient.enabled = false;
			}

			originalCodeMirrorTheme = themeCopy.codeMirrorTheme ?? $codeMirrorTheme;

			// Safeguard/Clone initial variables for Reset functionality
			initialVariables = JSON.parse(JSON.stringify(themeCopy.variables || {}));

			variablesText = objectToCss(themeCopy.variables);
			cssText = themeCopy.css ?? '';
			animationScriptText = themeCopy.animationScript ?? '';
			tsParticleConfigText = themeCopy.tsparticlesConfig
				? JSON.stringify(themeCopy.tsparticlesConfig, null, 2)
				: '';
			themeJsonText = JSON.stringify(themeCopy, null, 2);

			if (!themeCopy.toggles) {
				themeCopy.toggles = {
					cssVariables: isEditing ? !!variablesText : true,
					customCss: isEditing ? !!cssText : false,
					animationScript: isEditing ? !!animationScriptText : false,
					tsParticles: isEditing
						? !!tsParticleConfigText &&
							tsParticleConfigText.trim() !== '{}' &&
							tsParticleConfigText.trim() !== 'null'
						: false,
					gradient: isEditing ? (themeCopy.gradient?.enabled ?? false) : false,
					systemBackgroundImage: isEditing ? !!themeCopy.systemBackgroundImageUrl : false,
					chatBackgroundImage: isEditing ? !!themeCopy.chatBackgroundImageUrl : false
				};
			}
		}
	};

	let sidebarElement: HTMLDivElement | null = null;

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && show) {
			cancel();
		}
	};

	// Enforce sidebar closing on mobile when the editor is visible AND NOT collapsed
	$: if ($mobile && show && !$themeEditorCollapsed && $showSidebar) {
		// Use setTimeout to avoid interfering with the current render cycle
		setTimeout(() => {
			showSidebar.set(false);
		}, 0);
	}

	$: if (show && sidebarElement) {
		document.body.appendChild(sidebarElement);
		window.addEventListener('keydown', handleKeyDown);
		document.body.style.overflow = 'hidden';
	} else if (sidebarElement) {
		window.removeEventListener('keydown', handleKeyDown);
		if (sidebarElement.parentNode) {
			document.body.removeChild(sidebarElement);
		}
		document.body.style.overflow = 'unset';
	}

	onDestroy(() => {
		if (sidebarElement && sidebarElement.parentNode) {
			document.body.removeChild(sidebarElement);
		}
		window.removeEventListener('keydown', handleKeyDown);
		document.body.style.overflow = 'unset';
	});

	const save = () => {
		if (manualEditMode) {
			try {
				const newTheme = JSON.parse(themeJsonText);
				themeCopy = newTheme;
			} catch (e) {
				toast.error('Invalid JSON format. Please fix it before saving.');
				return;
			}
		} else {
			// Form-based validation
			if (!themeCopy.name) {
				toast.error('Theme name cannot be empty.');
				return;
			}
			if (!themeCopy.author) {
				toast.error('Author name cannot be empty.');
				return;
			}
			if (!themeCopy.version || !/^\d+(\.\d+){0,2}$/.test(themeCopy.version)) {
				toast.error('Version must be in the format X, X.Y, or X.Y.Z (e.g., 1.0.0).');
				return;
			}
			if (themeCopy.repository && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(themeCopy.repository)) {
				toast.error('Repository must be a valid URL.');
				return;
			}

			themeCopy.variables = cssToObject(variablesText);
			themeCopy.css = cssText;
			themeCopy.animationScript = animationScriptText;
			try {
				themeCopy.tsparticlesConfig = tsParticleConfigText
					? JSON.parse(tsParticleConfigText)
					: undefined;
			} catch (e) {
				toast.error('Invalid JSON format for Particle Config. Please fix it before saving.');
				return;
			}
		}

		if (!themeCopy.targetWebUIVersion) {
			themeCopy.targetWebUIVersion = WEBUI_VERSION;
		}

		dispatch('save', themeCopy);
	};

	const handleManualJsonInput = (event) => {
		themeJsonText = event.detail;
		try {
			themeCopy = JSON.parse(themeJsonText);
			dispatch('update', themeCopy);
		} catch (e) {
			// Do not dispatch update if JSON is invalid
		}
	};

	const toggleView = () => {
		if (manualEditMode) {
			// Switching from manual to form
			if (themeJsonText.trim()) {
				// If there's valid JSON, parse and apply it
				try {
					const newTheme = JSON.parse(themeJsonText);
					themeCopy = newTheme;

					if (!themeCopy.gradient) {
						themeCopy.gradient = {
							enabled: false,
							colors: ['#0d0d0d', '#333333'],
							direction: 45,
							intensity: 100
						};
					} else if (typeof themeCopy.gradient.enabled === 'undefined') {
						themeCopy.gradient.enabled = false;
					}

					variablesText = objectToCss(themeCopy.variables);
					cssText = themeCopy.css ?? '';
					animationScriptText = themeCopy.animationScript ?? '';
					tsParticleConfigText = themeCopy.tsparticlesConfig
						? JSON.stringify(themeCopy.tsparticlesConfig, null, 2)
						: '';

					// Re-evaluate toggles based on content when switching from manual to form
					themeCopy.toggles = {
						cssVariables: !!variablesText,
						customCss: !!cssText,
						animationScript: !!animationScriptText,
						tsParticles:
							!!themeCopy.tsparticlesConfig && Object.keys(themeCopy.tsparticlesConfig).length > 0,
						gradient: themeCopy.gradient?.enabled ?? false,
						systemBackgroundImage: !!themeCopy.systemBackgroundImageUrl,
						chatBackgroundImage: !!themeCopy.chatBackgroundImageUrl
					};
				} catch (e) {
					toast.error('Invalid JSON format.');
					return; // Don't switch view if JSON is invalid
				}
			} else {
				// Codeblock is empty - re-sync form fields from themeCopy and update preview
				variablesText = objectToCss(themeCopy.variables);
				cssText = themeCopy.css ?? '';
				animationScriptText = themeCopy.animationScript ?? '';
				tsParticleConfigText = themeCopy.tsparticlesConfig
					? JSON.stringify(themeCopy.tsparticlesConfig, null, 2)
					: '';
				// Dispatch update to refresh the preview back to themeCopy state
				dispatch('update', themeCopy);
			}
		} else {
			// Switching from form to manual
			// themeCopy is already the source of truth - just serialize it to JSON
			// Don't overwrite themeCopy from text fields, as they may not be in sync
			themeJsonText = JSON.stringify(themeCopy, null, 2);
		}
		manualEditMode = !manualEditMode;
	};

	$: if (themeCopy && themeCopy.toggles && themeCopy.gradient) {
		themeCopy.gradient.enabled = themeCopy.toggles.gradient;
	}

	const cancel = () => {
		codeMirrorTheme.set(originalCodeMirrorTheme);
		dispatch('cancel');
	};
</script>

{#if show}
	<div bind:this={sidebarElement}>
		<!-- Sidebar Panel -->
		<div
			data-theme-editor-open
			class="fixed right-0 top-0 h-[100dvh] w-full pointer-events-none {$themeEditorCollapsed
				? 'max-w-[42px] bg-transparent'
				: 'max-w-[600px] bg-gray-50/70 dark:bg-gray-950/70 shadow-2xl'} z-[100] flex flex-col transition-all duration-300"
			transition:fly={{ x: 600, duration: 300 }}
		>
			<!-- Header -->
			<div
				class="flex-shrink-0 py-1.5 pointer-events-auto {$themeEditorCollapsed
					? 'px-2'
					: 'px-4 border-b border-gray-200 dark:border-gray-700'}"
			>
				<div class="flex justify-between items-center">
					<div class="flex items-center space-x-2">
						<Tooltip
							content={$themeEditorCollapsed ? $i18n.t('Open Sidebar') : $i18n.t('Close Sidebar')}
						>
							<button
								class="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg transition"
								on:click={() => ($themeEditorCollapsed = !$themeEditorCollapsed)}
								aria-label={$themeEditorCollapsed ? 'Open Sidebar' : 'Close Sidebar'}
							>
								<Sidebar className="w-5 h-5" />
							</button>
						</Tooltip>
						{#if !$themeEditorCollapsed}
							<h2 class="text-lg font-medium">{$i18n.t('Edit Theme')}</h2>
						{/if}
					</div>
					{#if !$themeEditorCollapsed}
						<div class="flex items-center space-x-2">
							<button
								class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
								on:click={toggleView}
							>
								{manualEditMode
									? $i18n.t('Return to Form Editor')
									: $i18n.t('Swap to Manual Editor')}
							</button>
							<button
								class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
								on:click={cancel}
								aria-label="Close"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
									class="w-5 h-5"
								>
									<path
										d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
									/>
								</svg>
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Content -->

			<!-- Tab Navigation (outside scrollable area) -->
			{#if !$themeEditorCollapsed}
				{#if themeCopy && !manualEditMode}
					<div
						class="flex-shrink-0 px-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden scrollbar-hidden"
					>
						<nav class="-mb-px flex justify-between space-x-4 sm:space-x-8" aria-label="Tabs">
							<button
								class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
								class:border-blue-500={activeTab === 'General'}
								class:text-blue-600={activeTab === 'General'}
								class:border-transparent={activeTab !== 'General'}
								class:text-gray-500={activeTab !== 'General'}
								class:hover:text-gray-700={activeTab !== 'General'}
								class:hover:border-gray-300={activeTab !== 'General'}
								on:click={() => (activeTab = 'General')}
							>
								{$i18n.t('General')}
							</button>
							<button
								class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
								class:border-blue-500={activeTab === 'Styling'}
								class:text-blue-600={activeTab === 'Styling'}
								class:border-transparent={activeTab !== 'Styling'}
								class:text-gray-500={activeTab !== 'Styling'}
								class:hover:text-gray-700={activeTab !== 'Styling'}
								class:hover:border-gray-300={activeTab !== 'Styling'}
								on:click={() => (activeTab = 'Styling')}
							>
								{$i18n.t('Styling')}
							</button>
							<button
								class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
								class:border-blue-500={activeTab === 'Animations'}
								class:text-blue-600={activeTab === 'Animations'}
								class:border-transparent={activeTab !== 'Animations'}
								class:text-gray-500={activeTab !== 'Animations'}
								class:hover:text-gray-700={activeTab !== 'Animations'}
								class:hover:border-gray-300={activeTab !== 'Animations'}
								on:click={() => (activeTab = 'Animations')}
							>
								{$i18n.t('Animations')}
							</button>
							<button
								class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
								class:border-blue-500={activeTab === 'Backgrounds'}
								class:text-blue-600={activeTab === 'Backgrounds'}
								class:border-transparent={activeTab !== 'Backgrounds'}
								class:text-gray-500={activeTab !== 'Backgrounds'}
								class:hover:text-gray-700={activeTab !== 'Backgrounds'}
								class:hover:border-gray-300={activeTab !== 'Backgrounds'}
								on:click={() => (activeTab = 'Backgrounds')}
							>
								{$i18n.t('Backgrounds')}
							</button>
							<button
								class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
								class:border-blue-500={activeTab === 'Documentation'}
								class:text-blue-600={activeTab === 'Documentation'}
								class:border-transparent={activeTab !== 'Documentation'}
								class:text-gray-500={activeTab !== 'Documentation'}
								class:hover:text-gray-700={activeTab !== 'Documentation'}
								class:hover:border-gray-300={activeTab !== 'Documentation'}
								on:click={() => (activeTab = 'Documentation')}
							>
								{$i18n.t('Documentation')}
							</button>
						</nav>
					</div>
				{/if}
			{/if}

			<!-- Scrollable Content Area -->
			{#if !$themeEditorCollapsed}
				<div class="flex-1 overflow-y-auto p-4 pointer-events-auto">
					{#if themeCopy}
						{#if !manualEditMode}
							<div>
								{#if activeTab === 'General'}
									<GeneralTab bind:themeCopy on:update />
								{/if}
								{#if activeTab === 'Styling'}
									<StylingTab
										bind:themeCopy
										bind:variablesText
										bind:cssText
										{initialVariables}
										on:update
									/>
								{/if}
								{#if activeTab === 'Animations'}
									<AnimationsTab
										bind:themeCopy
										bind:animationScriptText
										bind:tsParticleConfigText
										on:update
									/>
								{/if}
								{#if activeTab === 'Backgrounds'}
									<BackgroundsTab
										bind:themeCopy
										bind:systemBgInputValue
										bind:chatBgInputValue
										on:update
									/>
								{/if}
								{#if activeTab === 'Documentation'}
									<DocumentationTab />
								{/if}
							</div>
						{:else}
							<div class="rounded-lg overflow-hidden">
								<CodeBlock
									id="theme-json-editor"
									code={themeJsonText}
									lang={'json'}
									edit={true}
									on:change={handleManualJsonInput}
								/>
							</div>
						{/if}
					{/if}
				</div>
			{/if}

			<!-- Fixed Footer -->
			{#if !$themeEditorCollapsed}
				<div class="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
					<div class="flex justify-end space-x-2">
						<button
							class="px-3.5 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition rounded-full"
							on:click={cancel}
						>
							{$i18n.t('Cancel')}
						</button>
						<button
							class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
							on:click={save}
						>
							{$i18n.t('Save')}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Allow interaction with specific elements within the pointer-events-none container */
	:global([data-theme-editor-open] button),
	:global([data-theme-editor-open] a),
	:global([data-theme-editor-open] input),
	:global([data-theme-editor-open] textarea),
	:global([data-theme-editor-open] select),
	:global([data-theme-editor-open] label),
	:global([data-theme-editor-open] span),
	:global([data-theme-editor-open] p),
	:global([data-theme-editor-open] h1),
	:global([data-theme-editor-open] h2),
	:global([data-theme-editor-open] h3),
	:global([data-theme-editor-open] h4),
	:global([data-theme-editor-open] h5),
	:global([data-theme-editor-open] h6),
	:global([data-theme-editor-open] code),
	:global([data-theme-editor-open] pre),
	:global([data-theme-editor-open] img),
	:global([data-theme-editor-open] nav),
	:global([data-theme-editor-open] [role='button']),
	:global([data-theme-editor-open] .cursor-pointer),
	:global([data-theme-editor-open] .scrollbar-hidden),
	:global([data-theme-editor-open] table),
	:global([data-theme-editor-open] .cm-editor),
	:global([data-theme-editor-open] .cm-scroller),
	:global([data-theme-editor-open] .cm-content),
	:global([data-theme-editor-open] .color-picker-wrapper *) {
		pointer-events: auto;
	}
</style>
