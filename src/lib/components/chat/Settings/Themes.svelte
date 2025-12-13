<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { v4 as uuidv4 } from 'uuid';
	import { WEBUI_VERSION } from '$lib/constants';
	import {
		themes,
		communityThemes,
		addCommunityTheme,
		updateCommunityTheme,
		removeCommunityTheme,
		applyTheme,
		isNewerVersion,
		themeUpdates,
		themeUpdateErrors,
		updateCommunityThemeFromUrl,
		retryThemeUpdateCheck,
		checkForThemeUpdates
	} from '$lib/theme';
	import {
		settings,
		theme as themeStore,
		showSettings,
		showThemeEditor,
		editingThemeId,
		mobile
	} from '$lib/stores';
	import type { Theme } from '$lib/types';
	import XMark from '$lib/components/icons/XMark.svelte';
	import Download from '$lib/components/icons/Download.svelte';
	import DocumentArrowDown from '$lib/components/icons/DocumentArrowDown.svelte';
	import Clipboard from '$lib/components/icons/Clipboard.svelte';
	import Pencil from '$lib/components/icons/Pencil.svelte';
	import Share from '$lib/components/icons/Share.svelte';
	import EllipsisVertical from '$lib/components/icons/EllipsisVertical.svelte';
	import ThemeEditorModal from '$lib/components/common/ThemeEditorModal.svelte';
	import ThemeImportWarningModal from '$lib/components/common/ThemeImportWarningModal.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import ThemeMenu from './ThemeMenu.svelte';
	import ChevronRight from '$lib/components/icons/ChevronRight.svelte';
	import ChevronDown from '$lib/components/icons/ChevronDown.svelte';
	import ChevronUp from '$lib/components/icons/ChevronUp.svelte';
	import ChevronUpDown from '$lib/components/icons/ChevronUpDown.svelte';
	import ArrowPath from '$lib/components/icons/ArrowPath.svelte';
	import ArchiveBox from '$lib/components/icons/ArchiveBox.svelte';
	import DocumentArrowUp from '$lib/components/icons/DocumentArrowUp.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Search from '$lib/components/icons/Search.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import emojiGroups from '$lib/emoji-groups.json';
	import { config, user } from '$lib/stores';
	import variables from '$lib/themes/variables.json';
	import { validateTheme, isDuplicateTheme, isMismatchedVersion } from '$lib/utils/theme';

	const i18n = getContext('i18n');

	const defaultVariables = variables.reduce((acc, curr) => {
		acc[curr.name] = curr.defaultValue;
		return acc;
	}, {});

	let selectedThemeId = 'system';
	let themeUrl = '';
	let isLoading = false;
	let fileInput: HTMLInputElement;
	let showConfirmDialog = false;
	let showExportConfirmDialog = false;
	let showEditThemeWarning = false;
	let showActiveThemeChangeConfirm = false;
	let pendingActiveThemeId: string | null = null;
	let themeToDeleteId = '';
	let searchQuery = '';
	let showThemeImportWarning = false;
	let themeToImport: Theme | null = null;
	let themeToEdit: Theme | null = null;
	let sortOrder = 'default';
	let isCheckingForUpdates = false;

	let showAnimationScriptWarning = false;
	let acceptAllScriptWarning = false;
	let skipAnimationScriptWarning = false;
	let themeWithScriptToImport: { theme: Theme; source: string } | null = null;

	let importQueue: Theme[] = [];
	let importSuccessCount = 0;
	let importErrorCount = 0;

	let themesScrollContainer: HTMLDivElement;
	let isScrolling = false;
	let scrollTimeout: NodeJS.Timeout;
	let openMenuThemeId: string | null = null;

	const handleCheckForUpdates = async () => {
		isCheckingForUpdates = true;
		await checkForThemeUpdates(true); // Pass true for manual check
		isCheckingForUpdates = false;
	};

	/**
	 * Returns the active feature toggles for a theme
	 */
	const getActiveFeatures = (theme: Theme): string[] => {
		const features: string[] = [];

		if (theme.toggles?.cssVariables && theme.variables && Object.keys(theme.variables).length > 0) {
			const hasCustomVariables = Object.keys(theme.variables).some((key) => {
				return defaultVariables[key] !== theme.variables[key];
			});
			if (hasCustomVariables) {
				features.push('CSS Variables');
			}
		}
		if (theme.toggles?.customCss && theme.css) {
			features.push('Custom CSS');
		}
		if (theme.toggles?.animationScript && theme.animationScript) {
			features.push('Animation');
		}
		if (
			theme.toggles?.tsParticles &&
			theme.tsparticlesConfig &&
			Object.keys(theme.tsparticlesConfig).length > 0
		) {
			features.push('Particles');
		}
		if (theme.toggles?.gradient) {
			features.push('Gradient');
		}
		if (theme.toggles?.systemBackgroundImage && theme.systemBackgroundImageUrl) {
			features.push('Background');
		}
		if (theme.toggles?.chatBackgroundImage && theme.chatBackgroundImageUrl) {
			features.push('Chat BG');
		}

		return features;
	};

	/**
	 * Returns a styled HTML model-card-like tooltip for the theme
	 */
	const getTooltipContent = (theme: Theme) => {
		// Skip tooltip for built-in themes
		if ($themes.has(theme.id)) {
			return '';
		}

		const features = getActiveFeatures(theme);

		// Base theme badge colors
		const baseColors: Record<string, { bg: string; text: string; label: string }> = {
			light: { bg: '#fef3c7', text: '#92400e', label: 'Light' },
			dark: { bg: '#1e3a5f', text: '#93c5fd', label: 'Dark' },
			'oled-dark': { bg: '#0a0a0a', text: '#a3a3a3', label: 'OLED' },
			her: { bg: '#fce7f3', text: '#be185d', label: 'Her' }
		};

		const baseStyle = baseColors[theme.base] || baseColors['dark'];

		// Build the HTML card
		let html = `
			<div style="
				max-width: 280px;
				font-family: system-ui, -apple-system, sans-serif;
				line-height: 1.4;
			">`;

		// Header: Name + Version
		html += `
			<div style="
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 8px;
				margin-bottom: 6px;
			">
				<div style="
					font-size: 14px;
					font-weight: 600;
					color: #f9fafb;
					display: flex;
					align-items: center;
					gap: 6px;
				">
					${theme.emoji ? `<span style="font-size: 16px;">${theme.emoji}</span>` : ''}
					<span style="overflow-wrap: break-word; word-break: break-word;">${theme.name}</span>
				</div>`;

		// Version badge
		if (theme.version) {
			html += `
				<span style="
					font-size: 10px;
					padding: 2px 6px;
					border-radius: 9999px;
					background: rgba(255, 255, 255, 0.15);
					color: #d1d5db;
					white-space: nowrap;
					flex-shrink: 0;
				">v${theme.version}</span>`;
		}

		html += `</div>`;

		// Author row
		if (theme.author) {
			html += `
				<div style="
					font-size: 11px;
					color: #9ca3af;
					margin-bottom: 8px;
					display: flex;
					align-items: center;
					gap: 4px;
				">
					<span>by</span>
					<span style="color: #d1d5db; font-weight: 500;">${theme.author}</span>
					${
						theme.repository
							? `<span style="color: #6b7280;">•</span>
					   <span style="color: #60a5fa;">🔗</span>`
							: ''
					}
				</div>`;
		}

		// Base theme badge
		html += `
			<div style="margin-bottom: 8px;">
				<span style="
					font-size: 10px;
					padding: 2px 8px;
					border-radius: 4px;
					background: ${baseStyle.bg};
					color: ${baseStyle.text};
					font-weight: 500;
					text-transform: uppercase;
					letter-spacing: 0.5px;
				">${baseStyle.label} Base</span>
			</div>`;

		// Description
		if (theme.description) {
			const truncatedDesc =
				theme.description.length > 150
					? theme.description.substring(0, 147) + '...'
					: theme.description;
			html += `
				<div style="
					font-size: 12px;
					color: #d1d5db;
					margin-bottom: 10px;
					line-height: 1.5;
				">${truncatedDesc}</div>`;
		}

		// Feature pills
		if (features.length > 0) {
			html += `
				<div style="
					display: flex;
					flex-wrap: wrap;
					gap: 4px;
				">`;

			for (const feature of features) {
				// Unique colors for each feature type
				const featureColors: Record<string, { bg: string; text: string }> = {
					'CSS Variables': { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' }, // Blue
					'Custom CSS': { bg: 'rgba(168, 85, 247, 0.2)', text: '#c084fc' }, // Purple
					Animation: { bg: 'rgba(251, 146, 60, 0.2)', text: '#fb923c' }, // Orange
					Particles: { bg: 'rgba(34, 211, 238, 0.2)', text: '#22d3ee' }, // Cyan
					Gradient: { bg: 'rgba(244, 114, 182, 0.2)', text: '#f472b6' }, // Pink
					Background: { bg: 'rgba(251, 191, 36, 0.2)', text: '#fbbf24' }, // Amber
					'Chat BG': { bg: 'rgba(45, 212, 191, 0.2)', text: '#2dd4bf' } // Teal
				};
				const colors = featureColors[feature] || { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80' };
				html += `
					<span style="
						font-size: 10px;
						padding: 3px 8px;
						border-radius: 9999px;
						background: ${colors.bg};
						color: ${colors.text};
						font-weight: 500;
					">${feature}</span>`;
			}

			html += `</div>`;
		}

		html += `</div>`;

		return html;
	};

	$: allThemes = new Map([...$themes, ...$communityThemes]);
	$: sortedThemes = (() => {
		const themes = [...allThemes.values()];
		if (sortOrder === 'default') {
			return themes;
		}
		return themes.sort((a, b) => {
			if (sortOrder === 'asc') {
				return a.name.localeCompare(b.name);
			} else {
				return b.name.localeCompare(a.name);
			}
		});
	})();
	$: filteredThemes = sortedThemes.filter(
		(theme) =>
			theme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(theme.author && theme.author.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	const themeChangeHandler = (_theme: string) => {
		if (_theme === selectedThemeId) {
			return;
		}

		// If theme editor is open, show confirmation before changing active theme
		if ($showThemeEditor) {
			pendingActiveThemeId = _theme;
			showActiveThemeChangeConfirm = true;
			return;
		}

		selectedThemeId = _theme;
		themeStore.set(_theme);
		localStorage.setItem('theme', _theme);
	};

	onMount(() => {
		selectedThemeId = localStorage.theme ?? 'system';

		const handleScroll = () => {
			// Hide tooltips
			document.querySelectorAll('[data-tippy-root]').forEach((tooltip) => {
				const instance = (tooltip as any)._tippy;
				if (instance) {
					instance.hide();
				}
			});

			// Close dropdown menus by triggering outside click
			// This works because bits-ui DropdownMenu closes on outside clicks by default
			const clickEvent = new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				view: window
			});
			// Click on body to trigger outside click detection
			document.body.dispatchEvent(clickEvent);

			// Set scrolling state
			isScrolling = true;

			// Clear existing timeout
			clearTimeout(scrollTimeout);

			// Reset scrolling state after scroll ends
			scrollTimeout = setTimeout(() => {
				isScrolling = false;
			}, 150);
		};

		if (themesScrollContainer) {
			themesScrollContainer.addEventListener('scroll', handleScroll);
			return () => {
				themesScrollContainer.removeEventListener('scroll', handleScroll);
			};
		}
	});

	const _finalizeAddTheme = (theme: Theme, source: string = ''): boolean => {
		// Version compatibility check
		const versionMismatch =
			theme.targetWebUIVersion && isMismatchedVersion(WEBUI_VERSION, theme.targetWebUIVersion);

		if (versionMismatch) {
			themeToImport = { ...theme, sourceUrl: source };
			showThemeImportWarning = true;
			return false;
		} else {
			if (source) {
				theme.sourceUrl = source;
			}
			const success = addCommunityTheme(theme);
			if (success) {
				toast.success($i18n.t('Theme "{{name}}" added successfully!', { name: theme.name }));
				themeUrl = ''; // Clear input on success
			}
			return success;
		}
	};

	const processAndAddTheme = (theme: any, source: string = ''): boolean => {
		const validation = validateTheme(theme);
		if (!validation.valid) {
			toast.error($i18n.t(validation.error ?? ''));
			return false;
		}

		if ($themes.has(theme.id)) {
			toast.error($i18n.t('A theme with this ID already exists as a default theme.'));
			return false;
		}

		if (isDuplicateTheme(theme, Array.from($communityThemes.values()), false)) {
			toast.error($i18n.t('This exact theme is already installed.'));
			return false;
		}

		// Security check for animation script
		if (theme.animationScript && !skipAnimationScriptWarning) {
			themeWithScriptToImport = { theme, source };
			showAnimationScriptWarning = true;
			return false;
		} else {
			return _finalizeAddTheme(theme, source);
		}
	};

	const addThemeHandler = async () => {
		if (!themeUrl) {
			toast.error($i18n.t('Please enter a theme URL.'));
			return;
		}

		isLoading = true;
		try {
			const res = await fetch(themeUrl);
			if (!res.ok) {
				throw new Error(`Failed to fetch theme: ${res.statusText}`);
			}
			const theme = await res.json();
			importQueue = [theme];
			importSuccessCount = 0;
			importErrorCount = 0;
			skipAnimationScriptWarning = false;
			acceptAllScriptWarning = false;
			processNextThemeInQueue();
		} catch (error) {
			console.error(`Failed to load theme from ${themeUrl}:`, error);
			toast.error(
				$i18n.t('Failed to load theme. Check the URL and browser console for more details.')
			);
		} finally {
			isLoading = false;
		}
	};

	const processNextThemeInQueue = () => {
		if (importQueue.length === 0) {
			if (importSuccessCount > 0) {
				toast.success(`${importSuccessCount} theme(s) imported successfully.`);
			}
			if (importErrorCount > 0) {
				toast.error(`${importErrorCount} theme(s) could not be imported.`);
			}
			importSuccessCount = 0;
			importErrorCount = 0;
			return;
		}

		const themeToProcess = importQueue.shift();
		if (themeToProcess) {
			const success = processAndAddTheme(themeToProcess);

			if (showAnimationScriptWarning || showThemeImportWarning) {
				return;
			}

			if (success) {
				importSuccessCount++;
			} else {
				importErrorCount++;
			}
			processNextThemeInQueue();
		}
	};

	const importThemeFromFile = (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) {
			return;
		}
		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const content = JSON.parse(reader.result as string);
				importSuccessCount = 0;
				importErrorCount = 0;
				skipAnimationScriptWarning = false;
				acceptAllScriptWarning = false;

				if (Array.isArray(content)) {
					importQueue = [...content];
				} else {
					importQueue = [content];
				}
				processNextThemeInQueue();
			} catch (e) {
				toast.error($i18n.t('Invalid JSON file.'));
				console.error(e);
			}
		};
		reader.readAsText(file);
		// Reset file input so the same file can be loaded again
		input.value = '';
	};

	const openThemeEditor = (theme: Theme) => {
		// Check if already editing a different theme
		if ($editingThemeId && $editingThemeId !== theme.id) {
			themeToEdit = theme;
			showEditThemeWarning = true;
			return;
		}

		// Set the theme data for the layout to consume
		window.dispatchEvent(
			new CustomEvent('open-theme-editor', {
				detail: { theme, isEditing: true, previousThemeId: selectedThemeId }
			})
		);

		// Update global stores
		editingThemeId.set(theme.id);
		showThemeEditor.set(true);
		showSettings.set(false);
	};

	const getRandomEmoji = () => {
		const groups = Object.values(emojiGroups);
		const randomGroup = groups[Math.floor(Math.random() * groups.length)];
		const randomEmojiCode = randomGroup[Math.floor(Math.random() * randomGroup.length)];
		return String.fromCodePoint(...randomEmojiCode.split('-').map((code) => parseInt(code, 16)));
	};

	let showNewThemeWarning = false;

	const _proceedCreateNewTheme = () => {
		const newTheme = {
			id: `theme-${uuidv4()}`,
			name: 'My Custom Theme',
			description: 'A custom theme created by me.',
			author: $user?.name ?? 'Me',
			version: '1.0.0',
			targetWebUIVersion: WEBUI_VERSION,
			base: 'dark' as 'light' | 'dark' | 'oled-dark' | 'her',
			emoji: getRandomEmoji(),
			variables: variables.reduce((acc, curr) => {
				acc[curr.name] = curr.defaultValue;
				return acc;
			}, {}),
			css: ``,
			systemBackgroundImageUrl: '',
			systemBackgroundImageDarken: 75,
			chatBackgroundImageUrl: '',
			chatBackgroundImageDarken: 75,
			toggles: {
				cssVariables: false,
				customCss: false,
				animationScript: false,
				tsParticles: false,
				gradient: false,
				systemBackgroundImage: false,
				chatBackgroundImage: false
			}
		};

		// Set the theme data for the layout to consume
		window.dispatchEvent(
			new CustomEvent('open-theme-editor', {
				detail: { theme: newTheme, isEditing: false, previousThemeId: selectedThemeId }
			})
		);

		// Update global stores
		editingThemeId.set(null);
		showThemeEditor.set(true);
		showSettings.set(false);
		applyTheme(newTheme, true);
	};

	const createNewTheme = () => {
		if ($showThemeEditor) {
			showNewThemeWarning = true;
			return;
		}
		_proceedCreateNewTheme();
	};

	// Note: Save handling is now done in +layout.svelte since this component
	// gets unmounted when the settings modal closes
	onMount(() => {
		// Listen for open theme editor events to set the selected theme
		const handleOpenThemeEditor = (event: CustomEvent) => {
			// This event is dispatched by openThemeEditor and createNewTheme
			// We don't need to do anything here as the layout handles the theme editor
		};

		window.addEventListener('open-theme-editor', handleOpenThemeEditor as EventListener);

		return () => {
			window.removeEventListener('open-theme-editor', handleOpenThemeEditor as EventListener);
		};
	});

	const copyTheme = (theme: Theme) => {
		const themeJson = JSON.stringify(theme, null, 2);
		navigator.clipboard.writeText(themeJson);
		toast.success($i18n.t('Theme copied to clipboard!'));
	};

	const exportTheme = (theme: Theme) => {
		const themeJson = JSON.stringify(theme, null, 2);
		const blob = new Blob([themeJson], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${theme.name}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const duplicateTheme = (theme: Theme) => {
		// Prevent cloning theme while it's being edited
		if ($editingThemeId === theme.id) {
			toast.error($i18n.t('Cannot clone theme while editing it'));
			return;
		}

		const duplicatedTheme = {
			...theme,
			id: `theme-${uuidv4()}`,
			name: `${theme.name} (Copy)`,
			sourceUrl: undefined
		};
		if (processAndAddTheme(duplicatedTheme)) {
			toast.success($i18n.t('Theme cloned successfully!'));
		}
	};

	const exportAllThemes = () => {
		const allThemes = [...$themes.values(), ...$communityThemes.values()];
		const themesJson = JSON.stringify(allThemes, null, 2);
		const blob = new Blob([themesJson], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'open-webui-themes.json';
		a.click();
		URL.revokeObjectURL(url);
	};
</script>

<div class="flex flex-col h-full justify-between text-sm">
	<div class="space-y-3">
		<div class="space-y-2">
			<div class="flex justify-between items-center">
				<div class="flex items-center self-center text-sm font-medium whitespace-nowrap">
					{$i18n.t('Themes')}
					<div class="flex self-center w-[1px] h-4 mx-2 bg-gray-50 dark:bg-gray-850" />
					<span class="text-gray-500 dark:text-gray-300">{filteredThemes.length}</span>
					<Tooltip content={$i18n.t('Export All')} placement="top" className="ml-2">
						<button
							class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
							on:click={() => {
								showExportConfirmDialog = true;
							}}
						>
							<ArchiveBox class="w-4 h-4" />
						</button>
					</Tooltip>
				</div>
				<div class="flex items-center gap-2">
					<div class="flex w-full rounded-xl" id="chat-search">
						<div class="self-center py-2 rounded-l-xl bg-transparent dark:text-gray-300">
							<Search />
						</div>
						<input
							class="w-full rounded-r-xl py-1.5 pl-2.5 text-sm bg-transparent dark:text-gray-300 outline-none"
							placeholder={$i18n.t('Search themes...')}
							autocomplete="off"
							bind:value={searchQuery}
						/>
					</div>
					<Tooltip
						content={sortOrder === 'default'
							? $i18n.t('Sort Ascending')
							: sortOrder === 'asc'
								? $i18n.t('Sort Descending')
								: $i18n.t('Default Sort Order')}
						placement="top"
					>
						<button
							class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
							on:click={() => {
								if (sortOrder === 'default') {
									sortOrder = 'asc';
								} else if (sortOrder === 'asc') {
									sortOrder = 'desc';
								} else {
									sortOrder = 'default';
								}
							}}
						>
							{#if sortOrder === 'default'}
								<ChevronUpDown class="w-4 h-4" />
							{:else if sortOrder === 'asc'}
								<ChevronUp class="w-4 h-4" />
							{:else}
								<ChevronDown class="w-4 h-4" />
							{/if}
						</button>
					</Tooltip>
					<Tooltip content="Check for Updates" placement="top">
						<button
							class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
							on:click={handleCheckForUpdates}
							disabled={isCheckingForUpdates}
						>
							<ArrowPath class={`w-4 h-4 ${isCheckingForUpdates ? 'animate-spin' : ''}`} />
						</button>
					</Tooltip>
					<Tooltip content="New Theme" placement="top">
						<button
							class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
							on:click={createNewTheme}
							disabled={isLoading}
						>
							<Plus class="w-4 h-4" />
						</button>
					</Tooltip>
				</div>
			</div>
			<!-- Clipping wrapper to contain dropdown menus within visible bounds -->
			<div class="overflow-hidden rounded-lg" style="contain: paint;">
				<div
					bind:this={themesScrollContainer}
					class="grid grid-cols-2 gap-2 overflow-x-clip overflow-y-auto max-h-[24rem] min-h-[14.5rem] content-start relative"
				>
					{#if filteredThemes.length}
						{#each filteredThemes as theme (theme.id)}
							{@const tooltipContent = getTooltipContent(theme)}
							<Tooltip
								content={tooltipContent}
								placement="bottom"
								touch={false}
								tippyOptions={{
									flipOnUpdate: true,
									popperOptions: {
										modifiers: [
											{
												name: 'flip',
												options: {
													fallbackPlacements: ['top', 'bottom'],
													boundary: themesScrollContainer
												}
											},
											{
												name: 'preventOverflow',
												options: {
													boundary: themesScrollContainer,
													altAxis: true,
													tether: false
												}
											}
										]
									},
									appendTo: () => themesScrollContainer || document.body
								}}
								className={`w-full h-full rounded-lg transition group ${
									selectedThemeId === theme.id
										? 'bg-gray-100 dark:bg-gray-800'
										: 'hover:bg-gray-100 dark:hover:bg-gray-800'
								}`}
							>
								<div
									class={`flex h-full items-center p-2 w-full text-left cursor-pointer ${
										$showThemeEditor && $editingThemeId === theme.id
											? selectedThemeId === theme.id
												? 'border-l-3 border-purple-500 dark:border-purple-400 rounded-l'
												: 'border-l-3 border-blue-500 dark:border-blue-400 rounded-l'
											: selectedThemeId === theme.id
												? 'border-l-3 border-green-500 dark:border-green-400 rounded-l'
												: ''
									}`}
									on:click={() => themeChangeHandler(theme.id)}
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											themeChangeHandler(theme.id);
										}
									}}
									role="button"
									tabindex="0"
								>
									<span class="text-xl mr-2">{theme.emoji}</span>
									<div class="text-left overflow-hidden">
										<div class="flex items-center gap-1.5">
											<p
												class="font-medium leading-tight truncate"
												class:text-red-500={$themeUpdateErrors.has(theme.id)}
												title={theme.name}
											>
												{theme.name}
											</p>
										</div>
										{#if !$themes.has(theme.id)}
											<div class="text-xs text-gray-500 leading-tight truncate">
												<span>
													{#if theme.version}v{theme.version}{/if}
													{$i18n.t('by {{author}}', { author: theme.author ?? 'Unknown' })}
												</span>
												{#if $themeUpdates.has(theme.id)}
													<span class="text-green-500 font-medium">
														(v{$themeUpdates.get(theme.id).version} available)
													</span>
												{:else if $themeUpdateErrors.has(theme.id)}
													<span class="text-red-500 font-medium"> (Update Failed) </span>
												{/if}
											</div>
											{#if theme.description}
												<div class="text-xs text-gray-500 leading-tight truncate">
													{theme.description}
												</div>
											{/if}
										{/if}
									</div>

									{#if !$themes.has(theme.id)}
										<div
											class="ml-auto items-center flex"
											on:click|stopPropagation
											on:keydown|stopPropagation
											role="button"
											tabindex="0"
										>
											{#if $themeUpdateErrors.has(theme.id)}
												<Tooltip content="Retry Update Check" placement="top">
													<button
														class="p-1.5 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition rounded-full"
														on:click|stopPropagation={() => retryThemeUpdateCheck(theme)}
														aria-label={$i18n.t('Retry update check')}
													>
														<ArrowPath class="w-4 h-4" />
													</button>
												</Tooltip>
											{/if}
											{#if $themeUpdates.has(theme.id)}
												<Tooltip content="Update Theme" placement="top">
													<button
														class="p-1.5 text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition rounded-full"
														on:click|stopPropagation={() => updateCommunityThemeFromUrl(theme)}
														aria-label={$i18n.t('Update theme')}
													>
														<Download class="w-4 h-4" />
													</button>
												</Tooltip>
											{/if}

											<div
												class={`items-center flex transition-opacity ${
													openMenuThemeId === theme.id
														? 'opacity-100'
														: 'opacity-0 group-hover:opacity-100'
												}`}
											>
												<Tooltip content="Edit Theme" placement="top">
													<button
														class="p-1.5 text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition rounded-full"
														on:click|stopPropagation={() => openThemeEditor(theme)}
														aria-label={$i18n.t('Edit theme')}
													>
														<Pencil className="w-4 h-4" />
													</button>
												</Tooltip>
												<Tooltip content="Remove Theme" placement="top">
													<button
														class="p-1.5 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition rounded-full"
														on:click|stopPropagation={() => {
															// Prevent deleting theme while it's being edited
															if ($editingThemeId === theme.id) {
																toast.error($i18n.t('Cannot delete theme while editing it'));
																return;
															}
															themeToDeleteId = theme.id;
															showConfirmDialog = true;
														}}
														aria-label={$i18n.t('Remove theme')}
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 0 20 20"
															fill="currentColor"
															class="w-4 h-4"
														>
															<path
																fill-rule="evenodd"
																d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
																clip-rule="evenodd"
															/>
														</svg>
													</button>
												</Tooltip>
												<ThemeMenu
													copyHandler={() => copyTheme(theme)}
													shareHandler={() => window.open('https://openwebui.com/', '_blank')}
													exportHandler={() => exportTheme(theme)}
													duplicateHandler={() => duplicateTheme(theme)}
													checkForUpdateHandler={() => retryThemeUpdateCheck(theme)}
													hasSourceUrl={!!theme.sourceUrl}
													onClose={() => {}}
													onOpenChange={(open) => {
														openMenuThemeId = open ? theme.id : null;
													}}
												>
													<button
														class="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition rounded-full"
														aria-label={$i18n.t('More options')}
													>
														<EllipsisVertical className="w-4 h-4" />
													</button>
												</ThemeMenu>
											</div>
										</div>
									{/if}
								</div>
							</Tooltip>
						{/each}
					{:else}
						<div class="col-span-2 text-center text-gray-500 mt-4">
							{$i18n.t('No themes found.')}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<hr class="border-gray-50 dark:border-gray-850 my-3" />

		<div class="mb-3.5">
			<div class=" mb-2.5 text-sm font-medium">{$i18n.t('Import Community Theme')}</div>

			<div class="space-y-3">
				<p class="text-sm text-gray-500">
					{$i18n.t('Load a custom theme by providing a URL to a valid theme.json file.')}
				</p>

				<div class="flex items-center gap-2">
					<div class="relative flex items-center flex-1">
						<input
							type="url"
							class="w-full rounded-lg py-2 pl-4 pr-28 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-none"
							placeholder="https://example.com/theme.json"
							bind:value={themeUrl}
							disabled={isLoading}
							on:keydown={(e) => {
								if (e.key === 'Enter' && !isLoading) {
									addThemeHandler();
								}
							}}
						/>
						<div class="absolute right-2 flex items-center gap-1">
							<input
								type="file"
								accept=".json"
								class="hidden"
								bind:this={fileInput}
								on:change={importThemeFromFile}
							/>
							<Tooltip content={$i18n.t('Import File')} placement="top">
								<button
									class="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition rounded-full"
									on:click={() => fileInput.click()}
									disabled={isLoading}
									aria-label={$i18n.t('Import File')}
								>
									<DocumentArrowUp class="w-4 h-4" />
								</button>
							</Tooltip>
							<button
								class="px-3 py-1 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-md disabled:opacity-50"
								on:click={addThemeHandler}
								disabled={isLoading}
							>
								{#if isLoading && !themeUrl}
									{$i18n.t('Loading...')}
								{:else}
									{$i18n.t('Load URL')}
								{/if}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	{#if $config?.features.enable_community_sharing && ($user.role === 'admin' || $user.permissions.public_sharing)}
		<div class=" mb-1.5">
			<div class=" text-sm font-medium mb-1 line-clamp-1">
				{$i18n.t('Made by Open WebUI Community')}
			</div>

			<a
				class=" flex cursor-pointer items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-850 w-full mb-2 px-3.5 py-1.5 rounded-xl transition"
				href="https://openwebui.com/"
				target="_blank"
			>
				<div class=" self-center">
					<div class=" font-semibold line-clamp-1">{$i18n.t('Discover Community-made Themes')}</div>
					<div class=" text-sm line-clamp-1">
						{$i18n.t('Discover, Download, & Explore')}
					</div>
				</div>

				<div>
					<div>
						<ChevronRight />
					</div>
				</div>
			</a>
		</div>
	{/if}
</div>

<ThemeImportWarningModal
	bind:show={showThemeImportWarning}
	themeName={themeToImport?.name ?? ''}
	themeVersion={themeToImport?.targetWebUIVersion ?? ''}
	webuiVersion={WEBUI_VERSION}
	on:confirm={() => {
		if (themeToImport) {
			if (addCommunityTheme(themeToImport)) {
				importSuccessCount++;
			} else {
				importErrorCount++;
			}
			themeUrl = ''; // Clear input on success
		}
		showThemeImportWarning = false;
		themeToImport = null;
		setTimeout(processNextThemeInQueue, 0);
	}}
	on:cancel={() => {
		showThemeImportWarning = false;
		themeToImport = null;
		importErrorCount++;
		setTimeout(processNextThemeInQueue, 0);
	}}
/>

<ConfirmDialog
	bind:show={showConfirmDialog}
	title={$i18n.t('Delete Theme')}
	message={$i18n.t('Are you sure you want to delete this theme?')}
	on:confirm={() => {
		removeCommunityTheme(themeToDeleteId);
		showConfirmDialog = false;
	}}
/>

<ConfirmDialog
	bind:show={showExportConfirmDialog}
	title={$i18n.t('Export All Themes')}
	message={$i18n.t('Are you sure you want to export all themes?')}
	on:confirm={() => {
		exportAllThemes();
		showExportConfirmDialog = false;
	}}
/>

<ConfirmDialog
	bind:show={showAnimationScriptWarning}
	title="Security Warning"
	on:confirm={() => {
		if (acceptAllScriptWarning) {
			skipAnimationScriptWarning = true;
		}

		if (themeWithScriptToImport) {
			const success = _finalizeAddTheme(
				themeWithScriptToImport.theme,
				themeWithScriptToImport.source
			);

			if (success) {
				importSuccessCount++;
			} else {
				importErrorCount++;
			}

			// If theme editor is open, close it and revert to previous theme
			if ($showThemeEditor) {
				if (success) {
					showThemeEditor.set(false);
					editingThemeId.set(null);
				}
				// Theme revert is handled by the layout component
			}
		}
		showAnimationScriptWarning = false;
		themeWithScriptToImport = null;
		setTimeout(processNextThemeInQueue, 0);
	}}
	on:cancel={() => {
		showAnimationScriptWarning = false;
		themeWithScriptToImport = null;
		importErrorCount++;
		setTimeout(processNextThemeInQueue, 0);
	}}
>
	<div class="text-sm text-gray-500">
		<div class=" bg-yellow-500/20 text-yellow-700 dark:text-yellow-200 rounded-lg px-4 py-3">
			<div>{$i18n.t('Please carefully review the following warnings:')}</div>

			<ul class=" mt-1 list-disc pl-4 text-xs">
				<li>{$i18n.t('Animation scripts allow arbitrary code execution.')}</li>
				<li>{$i18n.t('Do not install themes from sources you do not fully trust.')}</li>
			</ul>
		</div>

		<div class="my-3">
			{$i18n.t(
				'I acknowledge that I have read and I understand the implications of my action. I am aware of the risks associated with executing arbitrary code and I have verified the trustworthiness of the source.'
			)}
		</div>

		{#if importQueue.length > 0}
			<div class=" mt-2 flex items-center">
				<input
					id="accept-all-checkbox"
					type="checkbox"
					class="size-4 rounded border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
					bind:checked={acceptAllScriptWarning}
				/>
				<label for="accept-all-checkbox" class="ml-2 text-sm font-medium">
					{$i18n.t('Apply to all {{count}} themes in the queue', {
						count: importQueue.length + 1
					})}
				</label>
			</div>
		{/if}
	</div>
</ConfirmDialog>

<!-- Edit Theme Warning Modal -->
<ConfirmDialog
	bind:show={showEditThemeWarning}
	title={$i18n.t('Switch Theme Editor')}
	message={$i18n.t(
		'You are currently editing another theme. Do you want to switch to editing this theme? Your current changes will be saved.'
	)}
	on:confirm={() => {
		showEditThemeWarning = false;
		if (themeToEdit) {
			// User confirmed, dispatch the event directly to bypass the guard check
			window.dispatchEvent(
				new CustomEvent('open-theme-editor', {
					detail: { theme: themeToEdit, isEditing: true, previousThemeId: selectedThemeId }
				})
			);
			// Update global stores
			editingThemeId.set(themeToEdit.id);
			showThemeEditor.set(true);
			themeToEdit = null;
		}
	}}
	on:cancel={() => {
		showEditThemeWarning = false;
		themeToEdit = null;
	}}
/>

<!-- Active Theme Change Confirmation Modal -->
<ConfirmDialog
	bind:show={showActiveThemeChangeConfirm}
	title={$i18n.t('Change Active Theme')}
	message={$i18n.t(
		'You are currently editing a theme. This will change which theme is applied when you close the editor. Your current preview will not be affected. Do you want to proceed?'
	)}
	on:confirm={() => {
		if (pendingActiveThemeId) {
			// Only update selectedThemeId and localStorage, NOT the theme store
			// This prevents visual theme change while editing, but persists the selection
			selectedThemeId = pendingActiveThemeId;
			localStorage.setItem('theme', pendingActiveThemeId);

			// Notify the layout to update its previousThemeId so closing the editor
			// applies the correct theme
			window.dispatchEvent(
				new CustomEvent('active-theme-changed', {
					detail: { themeId: pendingActiveThemeId }
				})
			);

			pendingActiveThemeId = null;
		}
		showActiveThemeChangeConfirm = false;
	}}
	on:cancel={() => {
		showActiveThemeChangeConfirm = false;
		pendingActiveThemeId = null;
	}}
/>

<ConfirmDialog
	bind:show={showNewThemeWarning}
	title={$i18n.t('Create New Theme')}
	message={$i18n.t(
		$editingThemeId
			? 'You are currently editing a theme. Do you want to discard your current session and create a new theme? Your changes to the current theme will be saved.'
			: 'You are currently creating a theme. Do you want to discard your current session and create a new theme? Your changes to the current theme will be saved.'
	)}
	on:confirm={() => {
		showNewThemeWarning = false;
		_proceedCreateNewTheme();
	}}
	on:cancel={() => {
		showNewThemeWarning = false;
	}}
/>
