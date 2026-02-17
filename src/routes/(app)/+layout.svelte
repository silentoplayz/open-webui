<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { v4 as uuidv4 } from 'uuid';
	import { onMount, onDestroy, tick, getContext } from 'svelte';
	import { openDB, deleteDB } from 'idb';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	import { goto, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	import { getModels, getToolServersData, getVersionUpdates } from '$lib/apis';
	import { getTools } from '$lib/apis/tools';
	import { getBanners } from '$lib/apis/configs';
	import { getUserSettings, updateUserSettings } from '$lib/apis/users';

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
		editingThemeId,
		selectedFolder,
		theme
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
		communityThemes as communityThemesStore
	} from '$lib/theme';
	import {
		setThemeEditorBridgeHandlers,
		type OpenThemeEditorRequest,
		type ActiveThemeChangedRequest
	} from '$lib/themes/editor-bridge';
	import { startThemeEditingSync } from '$lib/themes/editing-sync';
	import { restoreEditorActiveTheme } from '$lib/themes/editor-active-theme';
	import { applyCreatedTheme, restoreThemeAfterCreateCancel } from '$lib/themes/editor-apply-confirm';
	import { openThemeEditorSession } from '$lib/themes/editor-open-session';
	import { saveEditorTheme } from '$lib/themes/editor-save';
	import ThemeManager from '$lib/components/common/ThemeManager.svelte';
	import ThemeEditorModal from '$lib/components/common/ThemeEditorModal.svelte';
	import type { Theme } from '$lib/types';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';

	import type { Writable } from 'svelte/store';
	const i18n = getContext<Writable<any>>('i18n');

	let loaded = false;
	let DB: any = null;
	let localDBChats: any[] = [];
	let mainContainer: HTMLElement;

	let version: any;

	// Theme editor state
	let selectedTheme: Theme | null = null;
	let originalTheme: Theme | null = null;
	let isEditingTheme = false;
	let previousThemeId = '';

	let showApplyThemeConfirm = false;
	let themeToApply: Theme | null = null;
	let clearThemeEditorBridgeHandlers: (() => void) | null = null;
	let stopThemeEditingSync: (() => void) | null = null;

	// Watch for theme editor changes
	$: if ($showThemeEditor && $editingThemeId) {
		// Editing existing theme
		isEditingTheme = true;
	} else if ($showThemeEditor && !$editingThemeId) {
		// Creating new theme
		isEditingTheme = false;
	}

	beforeNavigate(({ to }) => {
		if (to?.url?.pathname !== '/') {
			selectedFolder.set(null);
		}
	});

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
			localDBChats = chats.map((item: any, idx: number) => chats[chats.length - 1 - idx]);

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

	// Reusable save logic for theme editor
	const _saveTheme = async (themeToSave: Theme, isEditing: boolean): Promise<Theme | null> => {
		console.log('[+layout] _saveTheme triggered', themeToSave.name, 'isEditing:', isEditing);
		return saveEditorTheme({
			themeToSave,
			isEditing,
			existingThemes: Array.from($communityThemesStore.values()),
			activeThemeId: localStorage.getItem('theme')
		});
	};

	// Event handlers for theme editor - defined at module level for proper cleanup
	const handleOpenThemeEditor = async (request: OpenThemeEditorRequest) => {
		console.log('[+layout] Opening theme editor', {
			themeName: request.theme?.name || 'New Theme',
			isEditing: request.isEditing,
			saveChanges: request.saveChanges
		});

		if (request.saveChanges && selectedTheme) {
			console.log('[+layout] Auto-saving previous session for:', selectedTheme.name);
		}

		const nextSession = await openThemeEditorSession({
			request,
			currentSelectedTheme: selectedTheme,
			currentIsEditingTheme: isEditingTheme,
			saveCurrentTheme: async (themeToSave, isEditing) => {
				await _saveTheme(themeToSave, isEditing);
			},
			applyThemePreview: (nextTheme) => applyTheme(nextTheme)
		});

		selectedTheme = nextSession.selectedTheme;
		originalTheme = nextSession.originalTheme;
		isEditingTheme = nextSession.isEditingTheme;
		previousThemeId = nextSession.previousThemeId;
	};

	const handleActiveThemeChanged = ({ themeId }: ActiveThemeChangedRequest) => {
		console.log('[+layout] Active theme changed via confirmation modal:', themeId);
		// Update previousThemeId so that when editor closes, it applies the correct theme
		previousThemeId = themeId;
	};

	const handleThemeEditorSaveRequest = async (updatedTheme: Theme, isEditing: boolean) => {
		console.log('[+layout] Processing save request for theme', updatedTheme.name);

		const savedTheme = await _saveTheme(updatedTheme, isEditing);
		const success = !!savedTheme;
		console.log('[+layout] Save result:', success, savedTheme ? 'Theme object returned' : 'No theme object');

		if (!success) {
			return;
		}

		// If it was a NEW theme creation, ask if user wants to apply it
		if (!isEditing && savedTheme) {
			themeToApply = savedTheme;
			showApplyThemeConfirm = true;

			// Reset local editor state but don't close yet (ConfirmDialog handles the close)
			editingThemeId.set(null);
			return;
		}

		showThemeEditor.set(false);
		editingThemeId.set(null);
		selectedTheme = null;

		// Apply the user's active theme (for updates to existing themes)
		const activeThemeId = restoreEditorActiveTheme({
			previousThemeId,
			fallbackThemeId: localStorage.getItem('theme'),
			currentThemeId: $theme,
			applyTheme,
			setTheme: (themeId) => theme.set(themeId)
		});
		console.log('[+layout] Applying active theme after update:', activeThemeId);
	};

	const resetThemeEditorAfterCreateConfirm = () => {
		showThemeEditor.set(false);
		selectedTheme = null;
		themeToApply = null;
	};

	const handleApplyThemeConfirm = () => {
		if (themeToApply) {
			const nextThemeToApply = themeToApply;
			console.log('[+layout] Confirmation confirmed - Applying new theme:', nextThemeToApply.id);

			toast.success($i18n.t('Theme "{{name}}" added successfully!', { name: nextThemeToApply.name }));

			const themeId = applyCreatedTheme({
				themeToApply: nextThemeToApply,
				token: localStorage.token,
				currentSettings: $settings,
				setSettings: (nextSettings) => settings.set(nextSettings),
				persistSettings: (token, payload) => {
					void updateUserSettings(token, payload);
				},
				setLocalThemeId: (themeId) => localStorage.setItem('theme', themeId),
				setActiveThemeId: (themeId) => theme.set(themeId),
				applyTheme
			});

			console.log('[+layout] Persistence complete. Theme applied successfully.', themeId);
		}

		resetThemeEditorAfterCreateConfirm();
	};

	const handleKeepCurrentThemeAfterCreate = () => {
		console.log('[+layout] Confirmation canceled - Keeping current theme');
		if (themeToApply) {
			toast.success($i18n.t('Theme "{{name}}" added successfully!', { name: themeToApply.name }));

			const activeThemeId = restoreThemeAfterCreateCancel({
				previousThemeId,
				fallbackThemeId: localStorage.getItem('theme'),
				applyThemeById: (themeId) => applyTheme(themeId)
			});
			console.log('[+layout] Restored active theme after create cancel:', activeThemeId);
		}

		resetThemeEditorAfterCreateConfirm();
	};

	onMount(async () => {
		if ($user === undefined || $user === null) {
			await goto('/auth');
			return;
		}
		if (!['user', 'admin'].includes($user?.role)) {
			return;
		}

		// Reset handlers first (prevents duplicates during hot reload)
		clearThemeEditorBridgeHandlers?.();
		clearThemeEditorBridgeHandlers = setThemeEditorBridgeHandlers({
			onOpenEditor: handleOpenThemeEditor,
			onActiveThemeChanged: handleActiveThemeChanged
		});
		stopThemeEditingSync?.();
		stopThemeEditingSync = startThemeEditingSync();

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
				} else if (isShortcutMatch(event, shortcuts[Shortcut.OPEN_MODEL_SELECTOR])) {
					console.log('Shortcut triggered: OPEN_MODEL_SELECTOR');
					event.preventDefault();
					document.getElementById('model-selector-0-button')?.click();
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
		clearThemeEditorBridgeHandlers?.();
		clearThemeEditorBridgeHandlers = null;
		stopThemeEditingSync?.();
		stopThemeEditingSync = null;
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

<ConfirmDialog
	bind:show={showApplyThemeConfirm}
	title={$i18n.t('Apply New Theme?')}
	message={$i18n.t("Theme '{{name}}' has been created successfully. Would you like to apply it now?", {
		name: themeToApply?.name
	})}
	confirmLabel={$i18n.t('Apply Theme')}
	cancelLabel={$i18n.t('Keep Current')}
	onConfirm={handleApplyThemeConfirm}
	on:cancel={handleKeepCurrentThemeAfterCreate}
/>

{#if $showThemeEditor && selectedTheme}
	<ThemeEditorModal
		theme={selectedTheme}
		bind:show={$showThemeEditor}
		isEditing={isEditingTheme}
		on:save={(e) => {
			const updatedTheme = e.detail;
			console.log('[+layout] Save event received from ThemeEditorModal', updatedTheme);
			void handleThemeEditorSaveRequest(updatedTheme, isEditingTheme);
		}}
		on:saveAsNew={(e) => {
			const newTheme = e.detail;
			console.log('[+layout] Save as New event received from ThemeEditorModal', newTheme);
			
			// If name hasn't changed, append (Copy) to avoid duplicate error
			// Use originalTheme to check against the state when editor was opened
			if (originalTheme && newTheme.name === originalTheme.name) {
				newTheme.name = `${newTheme.name} (Copy)`;
			}
			
			// Generate new ID and treat as new theme
			newTheme.id = `theme-${uuidv4()}`;
			// sourceUrl is preserved to allow forked themes to receive updates

			
			void handleThemeEditorSaveRequest(newTheme, false);
		}}
		on:update={(e) => {
			selectedTheme = e.detail;
			if (selectedTheme) {
				applyTheme(selectedTheme, true);
			}
		}}
		on:cancel={() => {
			showThemeEditor.set(false);
			editingThemeId.set(null);
			selectedTheme = null;
			
			// Use previousThemeId as source of truth for the intended active theme
			console.log('[+layout] Theme Editor Cancelled. previousThemeId:', previousThemeId, 'localStorage:', localStorage.getItem('theme'));
			const activeThemeId = restoreEditorActiveTheme({
				previousThemeId,
				fallbackThemeId: localStorage.getItem('theme'),
				currentThemeId: $theme,
				applyTheme,
				setTheme: (themeId) => theme.set(themeId)
			});
			console.log('[+layout] Restored active theme after cancel:', activeThemeId);
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
