<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { onMount, onDestroy, tick, getContext } from 'svelte';
	import { openDB, deleteDB } from 'idb';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	import { getModels, getToolServersData, getVersionUpdates } from '$lib/apis';
	import { getTools } from '$lib/apis/tools';
	import { getBanners } from '$lib/apis/configs';
	import { getUserSettings } from '$lib/apis/users';

	import { WEBUI_VERSION } from '$lib/constants';
	import { compareVersion } from '$lib/utils';

	import {
		config,
		user,
		settings,
		models,
		prompts,
		knowledge,
		tools,
		functions,
		tags,
		banners,
		showSettings,
		showShortcuts,
		showChangelog,
		temporaryChatEnabled,
		toolServers,
		showSearch,
		showSidebar,
		showThemeEditor,
		editingThemeId
	} from '$lib/stores';

	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import SettingsModal from '$lib/components/chat/SettingsModal.svelte';
	import ChangelogModal from '$lib/components/ChangelogModal.svelte';
	import AccountPending from '$lib/components/layout/Overlay/AccountPending.svelte';
	import UpdateInfoToast from '$lib/components/layout/UpdateInfoToast.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import { Shortcut, shortcuts } from '$lib/shortcuts';
	import Particles from '$lib/components/common/Particles.svelte';
	import BackgroundImage from '$lib/components/layout/BackgroundImage.svelte';
	import {
		liveThemeStore,
		applyTheme,
		addCommunityTheme,
		updateCommunityTheme,
		communityThemes as communityThemesStore
	} from '$lib/theme';
	import ThemeManager from '$lib/components/common/ThemeManager.svelte';
	import ThemeEditorModal from '$lib/components/common/ThemeEditorModal.svelte';
	import type { Theme } from '$lib/types';
	import { validateTheme, isDuplicateTheme } from '$lib/utils/theme';

	const i18n = getContext('i18n');

	let loaded = false;
	let DB = null;
	let localDBChats = [];
	let mainContainer: HTMLElement;

	let version;

	// Theme editor state
	let selectedTheme: Theme | null = null;
	let isEditingTheme = false;
	let previousThemeId = '';

	// Watch for theme editor changes
	$: if ($showThemeEditor && $editingThemeId) {
		// Editing existing theme
		isEditingTheme = true;
	} else if ($showThemeEditor && !$editingThemeId) {
		// Creating new theme
		isEditingTheme = false;
	}

	const clearChatInputStorage = () => {
		const chatInputKeys = Object.keys(localStorage).filter((key) => key.startsWith('chat-input'));
		if (chatInputKeys.length > 0) {
			chatInputKeys.forEach((key) => {
				localStorage.removeItem(key);
			});
		}
	};

	const checkLocalDBChats = async () => {
		try {
			// Check if IndexedDB exists
			DB = await openDB('Chats', 1);

			if (!DB) {
				return;
			}

			const chats = await DB.getAllFromIndex('chats', 'timestamp');
			localDBChats = chats.map((item, idx) => chats[chats.length - 1 - idx]);

			if (localDBChats.length === 0) {
				await deleteDB('Chats');
			}
		} catch (error) {
			// IndexedDB Not Found
		}
	};

	const setUserSettings = async (cb: () => Promise<void>) => {
		let userSettings = await getUserSettings(localStorage.token).catch((error) => {
			console.error(error);
			return null;
		});

		if (!userSettings) {
			try {
				userSettings = JSON.parse(localStorage.getItem('settings') ?? '{}');
			} catch (e: unknown) {
				console.error('Failed to parse settings from localStorage', e);
				userSettings = {};
			}
		}

		if (userSettings?.ui) {
			settings.set(userSettings.ui);
		}

		if (cb) {
			await cb();
		}
	};

	const setModels = async () => {
		models.set(
			await getModels(
				localStorage.token,
				$config?.features?.enable_direct_connections ? ($settings?.directConnections ?? null) : null
			)
		);
	};

	const setToolServers = async () => {
		let toolServersData = await getToolServersData($settings?.toolServers ?? []);
		toolServersData = toolServersData.filter((data) => {
			if (!data || data.error) {
				toast.error(
					$i18n.t(`Failed to connect to {{URL}} OpenAPI tool server`, {
						URL: data?.url
					})
				);
				return false;
			}
			return true;
		});
		toolServers.set(toolServersData);
	};

	const setBanners = async () => {
		const bannersData = await getBanners(localStorage.token);
		banners.set(bannersData);
	};

	const setTools = async () => {
		const toolsData = await getTools(localStorage.token);
		tools.set(toolsData);
	};

	// Event handlers for theme editor - defined at module level for proper cleanup
	const handleOpenThemeEditor = (event: CustomEvent) => {
		const { theme, isEditing, previousThemeId: prevTheme } = event.detail;
		console.log('[+layout] Opening theme editor', { themeName: theme.name, isEditing });
		// Create a deep copy to ensure reactivity
		selectedTheme = JSON.parse(JSON.stringify(theme));

		// Apply the theme immediately for live preview
		applyTheme(selectedTheme);

		isEditingTheme = isEditing;
		previousThemeId = prevTheme;
	};

	const handleThemeEditorSaveComplete = (event: CustomEvent) => {
		const { success } = event.detail;
		if (success) {
			// Close the editor and reset state
			showThemeEditor.set(false);
			editingThemeId.set(null);
			selectedTheme = null;

			// Apply the user's active theme from localStorage
			// This ensures the active theme choice is respected after saving
			const activeThemeId = localStorage.getItem('theme') ?? 'system';
			applyTheme(activeThemeId);
		}
	};

	const handleActiveThemeChanged = (event: CustomEvent) => {
		const { themeId } = event.detail;
		console.log('[+layout] Active theme changed via confirmation modal:', themeId);
		// Update previousThemeId so that when editor closes, it applies the correct theme
		previousThemeId = themeId;
	};

	const handleThemeEditorSave = (event: CustomEvent) => {
		const { theme: updatedTheme, isEditing } = event.detail;
		console.log('[+layout] Processing save for theme', updatedTheme.name, 'isEditing:', isEditing);

		// Validation
		const validation = validateTheme(updatedTheme);
		if (!validation.valid) {
			console.log('[+layout] Validation failed:', validation.error);
			toast.error(validation.error ?? 'Invalid theme');
			window.dispatchEvent(
				new CustomEvent('theme-editor-save-complete', { detail: { success: false } })
			);
			return;
		}

		// Check for duplicates
		// When editing, filter out the theme being edited from the comparison
		const themesToCheck = isEditing
			? Array.from($communityThemesStore.values()).filter((t) => t.id !== updatedTheme.id)
			: Array.from($communityThemesStore.values());

		if (isDuplicateTheme(updatedTheme, themesToCheck, false, updatedTheme.id)) {
			console.log('[+layout] Duplicate theme detected');
			toast.error('A theme with the same content already exists.');
			window.dispatchEvent(
				new CustomEvent('theme-editor-save-complete', { detail: { success: false } })
			);
			return;
		}

		let success = false;
		if (isEditing) {
			// Update existing theme
			if (updateCommunityTheme(updatedTheme)) {
				toast.success(`Theme "${updatedTheme.name}" updated successfully!`);
				// If this is the currently selected theme, apply it
				if (updatedTheme.id === localStorage.getItem('theme')) {
					applyTheme(updatedTheme);
				}
				success = true;
			}
		} else {
			// Add new theme
			if (addCommunityTheme(updatedTheme)) {
				toast.success(`Theme "${updatedTheme.name}" added successfully!`);
				success = true;
			}
		}

		console.log('[+layout] Save result:', success);
		// Notify completion
		window.dispatchEvent(new CustomEvent('theme-editor-save-complete', { detail: { success } }));
	};

	onMount(async () => {
		if ($user === undefined || $user === null) {
			await goto('/auth');
			return;
		}
		if (!['user', 'admin'].includes($user?.role)) {
			return;
		}

		// Remove any existing listeners first (prevents duplicates during hot reload)
		window.removeEventListener('open-theme-editor', handleOpenThemeEditor as EventListener);
		window.removeEventListener('theme-editor-save', handleThemeEditorSave as EventListener);
		window.removeEventListener(
			'theme-editor-save-complete',
			handleThemeEditorSaveComplete as EventListener
		);
		window.removeEventListener('active-theme-changed', handleActiveThemeChanged as EventListener);

		// Now add the listeners
		window.addEventListener('open-theme-editor', handleOpenThemeEditor as EventListener);
		window.addEventListener('theme-editor-save', handleThemeEditorSave as EventListener);
		window.addEventListener(
			'theme-editor-save-complete',
			handleThemeEditorSaveComplete as EventListener
		);
		window.addEventListener('active-theme-changed', handleActiveThemeChanged as EventListener);

		clearChatInputStorage();
		await Promise.all([
			checkLocalDBChats(),
			setBanners(),
			setTools(),
			setUserSettings(async () => {
				await Promise.all([setModels(), setToolServers()]);
			})
		]);

		// Helper function to check if the pressed keys match the shortcut definition
		const isShortcutMatch = (event: KeyboardEvent, shortcut): boolean => {
			const keys = shortcut?.keys || [];

			const normalized = keys.map((k) => k.toLowerCase());
			const needCtrl = normalized.includes('ctrl') || normalized.includes('mod');
			const needShift = normalized.includes('shift');
			const needAlt = normalized.includes('alt');

			const mainKeys = normalized.filter((k) => !['ctrl', 'shift', 'alt', 'mod'].includes(k));

			// Get the main key pressed
			const keyPressed = event.key.toLowerCase();

			// Check modifiers
			if (needShift && !event.shiftKey) return false;

			if (needCtrl && !(event.ctrlKey || event.metaKey)) return false;
			if (!needCtrl && (event.ctrlKey || event.metaKey)) return false;
			if (needAlt && !event.altKey) return false;
			if (!needAlt && event.altKey) return false;

			if (mainKeys.length && !mainKeys.includes(keyPressed)) return false;

			return true;
		};

		const setupKeyboardShortcuts = () => {
			document.addEventListener('keydown', async (event) => {
				if (isShortcutMatch(event, shortcuts[Shortcut.SEARCH])) {
					console.log('Shortcut triggered: SEARCH');
					event.preventDefault();
					showSearch.set(!$showSearch);
				} else if (isShortcutMatch(event, shortcuts[Shortcut.NEW_CHAT])) {
					console.log('Shortcut triggered: NEW_CHAT');
					event.preventDefault();
					document.getElementById('sidebar-new-chat-button')?.click();
				} else if (isShortcutMatch(event, shortcuts[Shortcut.FOCUS_INPUT])) {
					console.log('Shortcut triggered: FOCUS_INPUT');
					event.preventDefault();
					document.getElementById('chat-input')?.focus();
				} else if (isShortcutMatch(event, shortcuts[Shortcut.COPY_LAST_CODE_BLOCK])) {
					console.log('Shortcut triggered: COPY_LAST_CODE_BLOCK');
					event.preventDefault();
					[...document.getElementsByClassName('copy-code-button')]?.at(-1)?.click();
				} else if (isShortcutMatch(event, shortcuts[Shortcut.COPY_LAST_RESPONSE])) {
					console.log('Shortcut triggered: COPY_LAST_RESPONSE');
					event.preventDefault();
					[...document.getElementsByClassName('copy-response-button')]?.at(-1)?.click();
				} else if (isShortcutMatch(event, shortcuts[Shortcut.TOGGLE_SIDEBAR])) {
					console.log('Shortcut triggered: TOGGLE_SIDEBAR');
					event.preventDefault();
					showSidebar.set(!$showSidebar);
				} else if (isShortcutMatch(event, shortcuts[Shortcut.DELETE_CHAT])) {
					console.log('Shortcut triggered: DELETE_CHAT');
					event.preventDefault();
					document.getElementById('delete-chat-button')?.click();
				} else if (isShortcutMatch(event, shortcuts[Shortcut.OPEN_SETTINGS])) {
					console.log('Shortcut triggered: OPEN_SETTINGS');
					event.preventDefault();
					showSettings.set(!$showSettings);
				} else if (isShortcutMatch(event, shortcuts[Shortcut.SHOW_SHORTCUTS])) {
					console.log('Shortcut triggered: SHOW_SHORTCUTS');
					event.preventDefault();
					showShortcuts.set(!$showShortcuts);
				} else if (isShortcutMatch(event, shortcuts[Shortcut.CLOSE_MODAL])) {
					console.log('Shortcut triggered: CLOSE_MODAL');
					event.preventDefault();
					showSettings.set(false);
					showShortcuts.set(false);
				} else if (isShortcutMatch(event, shortcuts[Shortcut.NEW_TEMPORARY_CHAT])) {
					console.log('Shortcut triggered: NEW_TEMPORARY_CHAT');
					event.preventDefault();
					if ($user?.role !== 'admin' && $user?.permissions?.chat?.temporary_enforced) {
						temporaryChatEnabled.set(true);
					} else {
						temporaryChatEnabled.set(!$temporaryChatEnabled);
					}
					await goto('/');
					setTimeout(() => {
						document.getElementById('new-chat-button')?.click();
					}, 0);
				} else if (isShortcutMatch(event, shortcuts[Shortcut.GENERATE_MESSAGE_PAIR])) {
					console.log('Shortcut triggered: GENERATE_MESSAGE_PAIR');
					event.preventDefault();
					document.getElementById('generate-message-pair-button')?.click();
				} else if (
					isShortcutMatch(event, shortcuts[Shortcut.REGENERATE_RESPONSE]) &&
					document.activeElement?.id === 'chat-input'
				) {
					console.log('Shortcut triggered: REGENERATE_RESPONSE');
					event.preventDefault();
					[...document.getElementsByClassName('regenerate-response-button')]?.at(-1)?.click();
				}
			});
		};
		setupKeyboardShortcuts();

		if ($user?.role === 'admin' && ($settings?.showChangelog ?? true)) {
			showChangelog.set($settings?.version !== $config.version);
		}

		if ($user?.role === 'admin' || ($user?.permissions?.chat?.temporary ?? true)) {
			if ($page.url.searchParams.get('temporary-chat') === 'true') {
				temporaryChatEnabled.set(true);
			}

			if ($user?.role !== 'admin' && $user?.permissions?.chat?.temporary_enforced) {
				temporaryChatEnabled.set(true);
			}
		}

		// Check for version updates
		if ($user?.role === 'admin' && $config?.features?.enable_version_update_check) {
			// Check if the user has dismissed the update toast in the last 24 hours
			if (localStorage.dismissedUpdateToast) {
				const dismissedUpdateToast = new Date(Number(localStorage.dismissedUpdateToast));
				const now = new Date();

				if (now - dismissedUpdateToast > 24 * 60 * 60 * 1000) {
					checkForVersionUpdates();
				}
			} else {
				checkForVersionUpdates();
			}
		}
		await tick();

		loaded = true;
	});

	onDestroy(() => {
		window.removeEventListener('open-theme-editor', handleOpenThemeEditor as EventListener);
		window.removeEventListener('theme-editor-save', handleThemeEditorSave as EventListener);
		window.removeEventListener(
			'theme-editor-save-complete',
			handleThemeEditorSaveComplete as EventListener
		);
		window.removeEventListener('active-theme-changed', handleActiveThemeChanged as EventListener);
	});

	const checkForVersionUpdates = async () => {
		version = await getVersionUpdates(localStorage.token).catch((error) => {
			return {
				current: WEBUI_VERSION,
				latest: WEBUI_VERSION
			};
		});
	};
</script>

<SettingsModal bind:show={$showSettings} />
<ChangelogModal bind:show={$showChangelog} />

{#if $showThemeEditor && selectedTheme}
	<ThemeEditorModal
		theme={selectedTheme}
		bind:show={$showThemeEditor}
		isEditing={isEditingTheme}
		on:save={(e) => {
			const updatedTheme = e.detail;
			console.log('[+layout] Save event received from ThemeEditorModal', updatedTheme);
			// Dispatch save event for Themes.svelte to handle
			window.dispatchEvent(
				new CustomEvent('theme-editor-save', {
					detail: { theme: updatedTheme, isEditing: isEditingTheme }
				})
			);
			console.log('[+layout] Dispatched theme-editor-save event');
		}}
		on:update={(e) => {
			selectedTheme = e.detail;
			applyTheme(e.detail, true);
		}}
		on:cancel={() => {
			showThemeEditor.set(false);
			editingThemeId.set(null);
			selectedTheme = null;
			// Apply the user's active theme from localStorage
			// This respects any active theme changes made via the confirmation modal
			const activeThemeId = localStorage.getItem('theme') ?? 'system';
			applyTheme(activeThemeId);
		}}
	/>
{/if}

{#if version && compareVersion(version.latest, version.current) && ($settings?.showUpdateToast ?? true)}
	<div class=" absolute bottom-8 right-8 z-50" in:fade={{ duration: 100 }}>
		<UpdateInfoToast
			{version}
			on:close={() => {
				localStorage.setItem('dismissedUpdateToast', Date.now().toString());
				version = null;
			}}
		/>
	</div>
{/if}

{#if $user}
	<div class="app relative">
		<div
			id="main-container"
			class="relative text-gray-700 dark:text-gray-100 h-screen max-h-[100dvh] overflow-auto flex flex-row justify-end"
			bind:this={mainContainer}
		>
			{#if mainContainer}
				<ThemeManager container={mainContainer} />
			{/if}
			<BackgroundImage />
			{#if $liveThemeStore?.tsparticlesConfig && Object.keys($liveThemeStore.tsparticlesConfig).length > 0}
				<Particles options={$liveThemeStore.tsparticlesConfig} />
			{/if}

			{#if !['user', 'admin'].includes($user?.role)}
				<AccountPending />
			{:else}
				<div class="relative z-10 bg-transparent w-full h-full flex flex-row justify-end">
					{#if localDBChats.length > 0}
						<div class="fixed w-full h-full flex z-50">
							<div
								class="absolute w-full h-full backdrop-blur-md bg-white/20 dark:bg-gray-900/50 flex justify-center"
							>
								<div class="m-auto pb-44 flex flex-col justify-center">
									<div class="max-w-md">
										<div class="text-center dark:text-white text-2xl font-medium z-50">
											{$i18n.t('Important Update')}<br />
											{$i18n.t('Action Required for Chat Log Storage')}
										</div>

										<div class=" mt-4 text-center text-sm dark:text-gray-200 w-full">
											{$i18n.t(
												"Saving chat logs directly to your browser's storage is no longer supported. Please take a moment to download and delete your chat logs by clicking the button below. Don't worry, you can easily re-import your chat logs to the backend through"
											)}
											<span class="font-semibold dark:text-white"
												>{$i18n.t('Settings')} > {$i18n.t('Chats')} > {$i18n.t(
													'Import Chats'
												)}</span
											>. {$i18n.t(
												'This ensures that your valuable conversations are securely saved to your backend database. Thank you!'
											)}
										</div>

										<div class=" mt-6 mx-auto relative group w-fit">
											<button
												class="relative z-20 flex px-5 py-2 rounded-full bg-white border border-gray-100 dark:border-none hover:bg-gray-100 transition font-medium text-sm"
												on:click={async () => {
													let blob = new Blob([JSON.stringify(localDBChats)], {
														type: 'application/json'
													});
													saveAs(blob, `chat-export-${Date.now()}.json`);

													const tx = DB.transaction('chats', 'readwrite');
													await Promise.all([tx.store.clear(), tx.done]);
													await deleteDB('Chats');

													localDBChats = [];
												}}
											>
												{$i18n.t('Download & Delete')}
											</button>

											<button
												class="text-xs text-center w-full mt-2 text-gray-400 underline"
												on:click={async () => {
													localDBChats = [];
												}}>{$i18n.t('Close')}</button
											>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<Sidebar />

					{#if loaded}
						<slot />
					{:else}
						<div
							class="w-full flex-1 h-full flex items-center justify-center {$showSidebar
								? '  md:max-w-[calc(100%-var(--sidebar-width))]'
								: ' '}"
						>
							<Spinner className="size-5" />
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.loading {
		display: inline-block;
		clip-path: inset(0 1ch 0 0);
		animation: l 1s steps(3) infinite;
		letter-spacing: -0.5px;
	}

	@keyframes l {
		to {
			clip-path: inset(0 -1ch 0 0);
		}
	}

	pre[class*='language-'] {
		position: relative;
		overflow: auto;

		/* make space  */
		margin: 5px 0;
		padding: 1.75rem 0 1.75rem 1rem;
		border-radius: 10px;
	}

	pre[class*='language-'] button {
		position: absolute;
		top: 5px;
		right: 5px;

		font-size: 0.9rem;
		padding: 0.15rem;
		background-color: #828282;

		border: ridge 1px #7b7b7c;
		border-radius: 5px;
		text-shadow: #c4c4c4 0 0 2px;
	}

	pre[class*='language-'] button:hover {
		cursor: pointer;
		background-color: #bcbabb;
	}
</style>
