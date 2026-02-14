/**
 * @file This module handles all logic related to community themes.
 * This includes loading themes from local storage, adding, updating,
 * and removing them, as well as checking for updates from remote sources.
 */

import type { Theme } from '$lib/types';
import { get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { WEBUI_VERSION } from '$lib/constants';

import { communityThemes, themeUpdates, themeUpdateErrors } from '$lib/stores/theme';
import { theme as themeStore, editingThemeId, settings } from '$lib/stores';
import { updateUserSettings } from '$lib/apis/users';
import { applyTheme } from '$lib/themes/apply';
import { validateTheme, isValidThemeUrl } from '$lib/utils/theme';
import { containsDangerousCSS } from '$lib/utils/css-sanitizer';

export const loadCommunityThemes = async () => {
	// Migration logic:
	// 1. If we have themes in settings, use them (Single Source of Truth)
	// 2. If settings.themes is empty BUT we have localStorage themes, migrate them to settings
	// 3. If both empty, start fresh

	// We need to wait for settings to be populated.
	// In +layout.svelte, we initialize settings from the API.
	// Since this module is imported, we can subscribe to the store, but we only want to trigger this logic once
	// or reactively when settings change (e.g. sync from another device).

	settings.subscribe(async (userSettings) => {
		if (!userSettings) return;

		const currentThemes = get(communityThemes);
		const settingsThemes = userSettings?.themes;

		if (settingsThemes && Object.keys(settingsThemes).length > 0) {
			// Case 1: Settings has themes. Use them.
			// We only update if they are different to avoid unnecessary store updates/loops
			// (Though simplistic comparison might be enough)

			// Transform object to Map
			const newThemesMap = new Map(Object.entries(settingsThemes));

			// Simple check if size changed or we just loaded for the first time
			if (currentThemes.size !== newThemesMap.size || currentThemes.size === 0) {
				communityThemes.set(newThemesMap);
			}
		} else {
			// Case 2: Settings empty. Check localStorage for migration.
			try {
				const raw = localStorage.getItem('communityThemes');
				if (raw) {
					const parsed = JSON.parse(raw);
					if (
						parsed &&
						typeof parsed === 'object' &&
						!Array.isArray(parsed) &&
						Object.keys(parsed).length > 0
					) {
						console.log('Migrating themes from localStorage to account settings...');
						const themesMap = new Map<string, Theme>(Object.entries(parsed));
						communityThemes.set(themesMap);

						// Trigger save to backend to complete migration
						await saveCommunityThemes(themesMap);

						// Clear localStorage after successful migration (optional, but good for cleanup)
						localStorage.removeItem('communityThemes');
					}
				}
			} catch (e) {
				console.error('Failed to load/migrate community themes from localStorage:', e);
			}
		}
	});

	// We don't unsubscribe here because we want to listen for updates from other devices/tabs
	// that might update the settings store.
	// However, be careful about circular loops: save -> settings update -> load -> ...
	// The `saveCommunityThemes` updates the backend, which might update the store if we re-fetch,
	// but usually we update the store locally first.
};

loadCommunityThemes();

// Queue for handling saves to prevent race conditions
let saveQueue: Promise<any> = Promise.resolve();

const saveCommunityThemes = async (themes: Map<string, Theme>): Promise<boolean> => {
	// We use a queue to ensure saves happen sequentially and don't overwrite each other
	// if multiple updates happen rapidly.
	return new Promise((resolve) => {
		saveQueue = saveQueue
			.then(async () => {
				try {
					// Convert Map to Object for JSON storage
					const themesObj = Object.fromEntries(themes);

					// Save to backend
					if (localStorage.token) {
						const currentSettings = get(settings) || {};
						const updatedSettings = {
							...currentSettings,
							themes: themesObj
						};

						// Optimistically update the settings store so the UI reflects it immediately
						settings.set(updatedSettings);

						await updateUserSettings(localStorage.token, { ui: updatedSettings });
					}
					resolve(true);
				} catch (e) {
					console.error('Failed to save themes to account:', e);
					toast.error('Failed to save themes to your account.');
					resolve(false);
				}
			})
			.catch((e) => {
				console.error('Save queue error:', e);
				resolve(false);
			});
	});
};

export const addCommunityTheme = async (theme: Theme, skipSave: boolean = false): Promise<boolean> => {
	const originalThemes = get(communityThemes);
	const newThemes = new Map(originalThemes);

	if (!theme.targetWebUIVersion) {
		theme.targetWebUIVersion = WEBUI_VERSION;
	}
	newThemes.set(theme.id, theme);
	communityThemes.set(newThemes);

	if (skipSave) {
		return true;
	}

	const success = await saveCommunityThemes(newThemes);

	if (!success) {
		communityThemes.set(originalThemes);
	}
	return success;
};

export const addCommunityThemes = async (newThemesList: Theme[]): Promise<boolean> => {
	const originalThemes = get(communityThemes);
	const newThemesMap = new Map(originalThemes);

	for (const theme of newThemesList) {
		if (!theme.targetWebUIVersion) {
			theme.targetWebUIVersion = WEBUI_VERSION;
		}
		newThemesMap.set(theme.id, theme);
	}

	communityThemes.set(newThemesMap);

	const success = await saveCommunityThemes(newThemesMap);

	if (!success) {
		communityThemes.set(originalThemes);
	}
	return success;
};

export const updateCommunityTheme = async (theme: Theme): Promise<boolean> => {
	const originalThemes = get(communityThemes);
	if (originalThemes.has(theme.id)) {
		const newThemes = new Map(originalThemes);
		newThemes.set(theme.id, theme);
		communityThemes.set(newThemes);

		const success = await saveCommunityThemes(newThemes);

		if (!success) {
			communityThemes.set(originalThemes);
		}
		return success;
	}
	return false;
};

export const removeCommunityTheme = async (themeId: string) => {
	const currentThemeId = get(themeStore); // Use store, not localStorage directly if possible, but keep consistent
	if (currentThemeId === themeId) {
		const themeToDelete = get(communityThemes).get(themeId);
		if (themeToDelete) {
			const baseTheme = themeToDelete.base ?? 'system';
			themeStore.set(baseTheme);
			// Update active theme in settings too
			if (localStorage.token) {
				const currentSettings = get(settings) || {};
				const updatedSettings = {
					...currentSettings,
					theme: baseTheme
				};
				settings.set(updatedSettings);
				await updateUserSettings(localStorage.token, { ui: updatedSettings });
			}
			localStorage.setItem('theme', baseTheme); // Keep localStorage as fallback/cache for active theme?
			applyTheme(baseTheme);
		}
	}

	const originalThemes = get(communityThemes);
	const newThemes = new Map(originalThemes);
	newThemes.delete(themeId);
	communityThemes.set(newThemes);

	const success = await saveCommunityThemes(newThemes);
	if (!success) {
		communityThemes.set(originalThemes);
	}
};

export const deleteAllCommunityThemes = async () => {
	const currentThemeId = get(themeStore);
	const themes = get(communityThemes);

	// If current theme is one of the themes being deleted, reset to base
	if (currentThemeId && themes.has(currentThemeId)) {
		const themeToDelete = themes.get(currentThemeId);
		const baseTheme = themeToDelete?.base ?? 'system';
		themeStore.set(baseTheme);

		if (localStorage.token) {
			const currentSettings = get(settings) || {};
			const updatedSettings = {
				...currentSettings,
				theme: baseTheme
			};
			settings.set(updatedSettings);
			await updateUserSettings(localStorage.token, { ui: updatedSettings });
		}

		localStorage.setItem('theme', baseTheme);
		applyTheme(baseTheme);
	}

	communityThemes.set(new Map());
	await saveCommunityThemes(new Map());

	localStorage.removeItem('communityThemes');
	toast.success('All custom themes deleted successfully.');
};

const _fetchTheme = async (url: string): Promise<[Theme | null, string | null]> => {
	// Security: validate URL protocol before fetching
	if (!isValidThemeUrl(url)) {
		const errorText = 'Invalid URL: only HTTP and HTTPS protocols are allowed.';
		console.error(`Refused to fetch theme from ${url}: ${errorText}`);
		return [null, errorText];
	}
	try {
		const res = await fetch(url);
		if (!res.ok) {
			const errorText = `${res.status} ${res.statusText}`;
			console.error(`Failed to fetch theme from ${url}: ${errorText}`);
			return [null, errorText];
		}
		// Validate Content-Type — reject HTML responses (e.g. 404 pages, login redirects)
		// Allow text/plain since GitHub Gist and similar services serve raw JSON with that type
		const contentType = res.headers.get('content-type') || '';
		if (contentType.includes('text/html') || contentType.includes('text/xml')) {
			const errorText = `Expected JSON response but received Content-Type: ${contentType}`;
			console.error(`Failed to fetch theme from ${url}: ${errorText}`);
			return [null, errorText];
		}
		const theme = await res.json();
		return [theme, null];
	} catch (error) {
		console.error(`Failed to fetch theme from ${url}:`, error);
		return [null, error.message];
	}
};

export const updateCommunityThemeFromUrl = async (theme: Theme) => {
	if (!theme.sourceUrl) {
		toast.error(`Theme "${theme.name}" does not have a source URL.`);
		return;
	}

	// Prevent updating theme while it's being edited
	if (get(editingThemeId) === theme.id) {
		toast.error(`Cannot update theme "${theme.name}" while editing it.`);
		return;
	}

	const [latestTheme, error] = await _fetchTheme(theme.sourceUrl);

	if (latestTheme) {
		// Security: validate the fetched theme before applying
		const validation = validateTheme(latestTheme);
		if (!validation.valid) {
			toast.error(`Update rejected for "${theme.name}": ${validation.error}`);
			return;
		}
		if (latestTheme.css && containsDangerousCSS(latestTheme.css)) {
			toast.error(`Update rejected for "${theme.name}": CSS contains url() or @import which are not allowed.`);
			return;
		}


		const existingTheme = get(communityThemes).get(theme.id);
		if (existingTheme?.toggles) {
			latestTheme.toggles = { ...existingTheme.toggles, ...(latestTheme.toggles ?? {}) };
		}

		// Critical: Ensure we update the *current* theme ID, not the ID from the remote JSON
		// This allows forked themes (with new IDs) to still receive updates from the original source
		latestTheme.id = theme.id;

		updateCommunityTheme(latestTheme);
		toast.success(`Theme "${theme.name}" updated successfully to v${latestTheme.version}!`);

		const currentThemeId = localStorage.getItem('theme');
		if (currentThemeId === theme.id) {
			applyTheme(latestTheme);
		}

		const updates = get(themeUpdates);
		updates.delete(theme.id);
		themeUpdates.set(updates);
	} else {
		toast.error(`Failed to update theme "${theme.name}": ${error}`);
	}
};

export const retryThemeUpdateCheck = async (theme: Theme) => {
	if (!theme.sourceUrl) {
		toast.error(`Theme "${theme.name}" does not have a source URL.`);
		return;
	}

	const [latestTheme, error] = await _fetchTheme(theme.sourceUrl);

	if (latestTheme) {
		// Security: validate the fetched theme before storing
		const validation = validateTheme(latestTheme);
		if (!validation.valid) {
			const errors = get(themeUpdateErrors);
			errors.set(theme.id, `Validation failed: ${validation.error}`);
			themeUpdateErrors.set(errors);
			toast.error(`Update for "${theme.name}" rejected: ${validation.error}`);
			return;
		}
		if (latestTheme.css && containsDangerousCSS(latestTheme.css)) {
			const errors = get(themeUpdateErrors);
			errors.set(theme.id, 'CSS contains dangerous constructs');
			themeUpdateErrors.set(errors);
			toast.error(`Update for "${theme.name}" rejected: CSS contains dangerous constructs.`);
			return;
		}

		// Clear the error for this theme
		const errors = get(themeUpdateErrors);
		errors.delete(theme.id);
		themeUpdateErrors.set(errors);

		// Check for a new version and update the themeUpdates store
		if (latestTheme.version && isNewerVersion(theme.version, latestTheme.version)) {
			const updates = get(themeUpdates);
			updates.set(theme.id, latestTheme);
			themeUpdates.set(updates);
			toast.success(`Update found for theme "${theme.name}"!`);
		} else {
			toast.success(`Theme "${theme.name}" is up to date.`);
		}
	} else {
		// Update the error message in the store
		const errors = get(themeUpdateErrors);
		errors.set(theme.id, error);
		themeUpdateErrors.set(errors);
		toast.error(`Failed to check for update for theme "${theme.name}": ${error}`);
	}
};

export const isNewerVersion = (oldVer: string, newVer: string) => {
	const parsePart = (s: string) => { const n = parseInt(s, 10); return isNaN(n) ? 0 : n; };
	const oldParts = oldVer.split('.').map(parsePart);
	const newParts = newVer.split('.').map(parsePart);
	for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
		const oldPart = oldParts[i] || 0;
		const newPart = newParts[i] || 0;
		if (newPart > oldPart) return true;
		if (newPart < oldPart) return false;
	}
	return false;
};

const getDismissedThemeIds = (): string[] => {
	try {
		return JSON.parse(sessionStorage.getItem('dismissedThemeIds') ?? '[]');
	} catch {
		return [];
	}
};

const addDismissedThemeId = (id: string) => {
	const ids = getDismissedThemeIds();
	sessionStorage.setItem('dismissedThemeIds', JSON.stringify([...ids, id]));
};

export const checkForThemeUpdates = async (manual = false) => {
	const themes = get(communityThemes);
	const dismissedThemeIds = getDismissedThemeIds();
	const updates = new Map<string, Theme>();
	const errors = new Map<string, string>();
	let updatesFound = 0;

	// Clear previous errors before checking
	themeUpdateErrors.set(new Map());

	for (const [id, theme] of themes.entries()) {
		if (theme.sourceUrl && theme.version) {
			const [latestTheme, error] = await _fetchTheme(theme.sourceUrl);

			if (latestTheme) {
				// Security: validate before storing
				const validation = validateTheme(latestTheme);
				const hasDangerousCSS = latestTheme.css && containsDangerousCSS(latestTheme.css);
				if (!validation.valid || hasDangerousCSS) {
					errors.set(id, validation.error || 'CSS contains dangerous constructs');
					if (manual) {
						toast.error(`Update for "${theme.name}" rejected: ${validation.error || 'dangerous CSS'}`);
					}
					continue;
				}

				if (latestTheme.version && isNewerVersion(theme.version, latestTheme.version)) {
					updates.set(id, latestTheme);
					updatesFound++;

					if (!dismissedThemeIds.includes(id)) {
						toast.info(
							`A new version (v${latestTheme.version}) is available for the theme "${theme.name}", which is on version ${theme.version}.`,
							{
								duration: 10000,
								action: {
									label: 'Update',
									onClick: () => {
										updateCommunityThemeFromUrl(theme);
									}
								},
								onDismiss: () => {
									addDismissedThemeId(id);
								}
							}
						);
					}
				}
			} else {
				errors.set(id, error);
				if (manual) {
					toast.error(`Failed to check for update for theme "${theme.name}": ${error}`);
				}
			}
		}
	}
	themeUpdates.set(updates);
	themeUpdateErrors.set(errors);

	if (manual) {
		if (updatesFound === 0) {
			toast.success('All community themes are up to date.');
		} else if (updatesFound === 1) {
			toast.success('Found 1 theme update.');
		} else {
			toast.success(`Found ${updatesFound} theme updates.`);
		}
	} else {
		if (errors.size > 0) {
			const hasDismissed = sessionStorage.getItem('hasDismissedUpdateErrors') === 'true';
			if (!hasDismissed) {
				toast.error(
					`Failed to check for updates for ${errors.size} theme(s). See Themes settings for details.`,
					{
						onDismiss: () => {
							sessionStorage.setItem('hasDismissedUpdateErrors', 'true');
						}
					}
				);
			}
		}
	}
};
