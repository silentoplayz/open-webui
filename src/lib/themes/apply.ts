/**
 * @file This module contains the core logic for applying themes to the application.
 * It handles global styles, CSS variables, and updating the theme stores.
 * Container-specific customizations (like gradients and animations) are handled by ThemeManager.svelte.
 */

import type { Theme } from '$lib/types';
import { get } from 'svelte/store';
import { theme as themeStore, codeMirrorTheme } from '$lib/stores';
import variables from '$lib/themes/variables.json';

import { currentThemeStore, liveThemeStore, communityThemes, themes } from '$lib/stores/theme';
import { sanitizeCSS, containsDangerousCSS } from '$lib/utils/css-sanitizer';
import { sanitizeThemeId } from '$lib/utils/theme';

let currentStylesheet: HTMLStyleElement | undefined;

/**
 * Validates a CSS variable value before applying.
 * Prevents injection of dangerous constructs via variable values.
 */
const isValidCSSVariableValue = (value: string): boolean => {
	if (typeof value !== 'string') return false;
	// Limit value length to prevent DoS
	if (value.length > 500) return false;
	// Block values containing CSS syntax delimiters (could escape variable context in some renderers)
	if (/[{}]/.test(value)) return false;
	// Block dangerous CSS functions in values
	if (containsDangerousCSS(value)) return false;
	return true;
};

const cleanupTheme = () => {
	// Note: currentStylesheet is now managed in _applyGlobalThemeStyles to allow reuse

	// Cleanup base class and CSS variables
	document.documentElement.classList.remove('light', 'dark', 'oled-dark', 'her');
	for (const variable of variables) {
		document.documentElement.style.removeProperty(variable.name);
	}
};

const _applyGlobalThemeStyles = (theme: Theme) => {
	if (theme.css && (!theme.toggles || theme.toggles.customCss)) {
		// Sanitize CSS before applying to prevent malicious constructs
		const sanitizedCSS = sanitizeCSS(theme.css);
		const safeId = sanitizeThemeId(theme.id);
		
		if (!currentStylesheet) {
			currentStylesheet = document.createElement('style');
			currentStylesheet.id = `${safeId}-stylesheet`;
			document.head.appendChild(currentStylesheet);
		}
		// Update content of existing stylesheet with sanitized CSS
		if (currentStylesheet.innerHTML !== sanitizedCSS) {
			currentStylesheet.innerHTML = sanitizedCSS;
		}
	} else if (currentStylesheet) {
		// Remove stylesheet if theme has no custom CSS
		currentStylesheet.remove();
		currentStylesheet = undefined;
	}

	let resolvedBase = theme.base;
	if (theme.id === 'system' || theme.base === 'system') {
		resolvedBase = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	// Apply variables from base theme
	const allThemes = new Map([...get(themes), ...get(communityThemes)]);
	const baseThemeObject = allThemes.get(resolvedBase);
	if (baseThemeObject?.variables) {
		for (const [key, value] of Object.entries(baseThemeObject.variables)) {
			if (isValidCSSVariableValue(value)) {
				document.documentElement.style.setProperty(key, value);
			} else {
				console.warn(`Blocked invalid CSS variable value for ${key}`);
			}
		}
	}

	// Apply variables from current theme (override base)
	if (theme.variables && (!theme.toggles || theme.toggles.cssVariables)) {
		for (const [key, value] of Object.entries(theme.variables)) {
			if (isValidCSSVariableValue(value)) {
				document.documentElement.style.setProperty(key, value);
			} else {
				console.warn(`Blocked invalid CSS variable value for ${key}`);
			}
		}
	}

	// Apply classes
	if (resolvedBase === 'light' || resolvedBase === 'her') {
		document.documentElement.classList.add('light');
	} else {
		document.documentElement.classList.add('dark');
	}

	if (resolvedBase === 'oled-dark') {
		document.documentElement.classList.add('oled-dark');
	}

	if (resolvedBase === 'her') {
		document.documentElement.classList.add('her');
	}

	const metaThemeColorEl = document.querySelector('meta[name="theme-color"]');
	if (metaThemeColorEl) {
		if (theme.id === 'system') {
			const systemThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light';
			const systemTheme = get(themes).get(systemThemeName);
			metaThemeColorEl.setAttribute('content', systemTheme?.metaThemeColor ?? '#ffffff');
		} else {
			metaThemeColorEl.setAttribute('content', theme.metaThemeColor ?? '#ffffff');
		}
	}
};

/**
 * Applies a new theme to the application.
 * This function is the main entry point for changing themes.
 * It cleans up old theme styles, sets the new global styles and CSS variables,
 * and updates the relevant Svelte stores.
 * @param themeInput The theme object or the ID of the theme to apply.
 * @param isLiveUpdate If true, only the live theme store is updated, for real-time previews.
 */
export const applyTheme = async (themeInput: string | Theme, isLiveUpdate = false) => {
	cleanupTheme();

	// Reset codemirror theme to default
	codeMirrorTheme.set('one-dark');

	let theme: Theme | undefined;
	if (typeof themeInput === 'string') {
		theme = get(themes).get(themeInput) ?? get(communityThemes).get(themeInput);
	} else {
		theme = themeInput;
	}

	if (!theme) {
		return;
	}

	const themeToApply = { ...theme };

	if (themeToApply.toggles && !themeToApply.toggles.tsParticles) {
		themeToApply.tsparticlesConfig = undefined;
	} else if (themeToApply.tsparticlesConfig) {
		// Deep clone to avoid mutating the original theme object from the store
		themeToApply.tsparticlesConfig = JSON.parse(JSON.stringify(themeToApply.tsparticlesConfig));
		
		themeToApply.tsparticlesConfig.fpsLimit = 120;
		themeToApply.tsparticlesConfig.pauseOnBlur = true;
		themeToApply.tsparticlesConfig.pauseOnOutsideViewport = true;
		themeToApply.tsparticlesConfig.interactivity = {
			...themeToApply.tsparticlesConfig.interactivity,
			events: {
				...themeToApply.tsparticlesConfig.interactivity?.events,
				onClick: {
					...themeToApply.tsparticlesConfig.interactivity?.events?.onClick,
					enable: false
				}
			}
		};
	}

	liveThemeStore.set(themeToApply);

	if (!isLiveUpdate) {
		currentThemeStore.set(themeToApply);
	}

	_applyGlobalThemeStyles(themeToApply);

	if (themeToApply.codeMirrorTheme) {
		codeMirrorTheme.set(themeToApply.codeMirrorTheme);
	}

	// Dispatch a custom event for any listeners that need to react to theme changes
	// This replaces the previous window.applyTheme global hook for security reasons
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('theme-applied', { detail: { themeId: themeToApply.id } }));
	}
};
