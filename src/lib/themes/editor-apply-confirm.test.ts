import { describe, expect, it, vi } from 'vitest';

import type { Theme } from '$lib/types';
import { applyCreatedTheme, restoreThemeAfterCreateCancel } from './editor-apply-confirm';

const createTheme = (id = 'theme-new'): Theme => ({
	id,
	name: 'New Theme',
	base: 'dark'
});

describe('editor-apply-confirm', () => {
	it('applies a created theme and persists settings when token exists', () => {
		const setSettings = vi.fn();
		const persistSettings = vi.fn();
		const setLocalThemeId = vi.fn();
		const setActiveThemeId = vi.fn();
		const applyTheme = vi.fn();
		const themeToApply = createTheme('theme-created');

		const appliedThemeId = applyCreatedTheme({
			themeToApply,
			token: 'token-123',
			currentSettings: { locale: 'en-US', theme: 'old-theme' },
			setSettings,
			persistSettings,
			setLocalThemeId,
			setActiveThemeId,
			applyTheme
		});

		expect(appliedThemeId).toBe('theme-created');
		expect(setLocalThemeId).toHaveBeenCalledWith('theme-created');
		expect(setSettings).toHaveBeenCalledWith({ locale: 'en-US', theme: 'theme-created' });
		expect(persistSettings).toHaveBeenCalledWith('token-123', {
			ui: { locale: 'en-US', theme: 'theme-created' }
		});
		expect(setActiveThemeId).toHaveBeenCalledWith('theme-created');
		expect(applyTheme).toHaveBeenCalledWith(themeToApply);
	});

	it('applies a created theme without persisting when token is missing', () => {
		const setSettings = vi.fn();
		const persistSettings = vi.fn();
		const setLocalThemeId = vi.fn();
		const setActiveThemeId = vi.fn();
		const applyTheme = vi.fn();
		const themeToApply = createTheme('theme-local');

		const appliedThemeId = applyCreatedTheme({
			themeToApply,
			token: null,
			currentSettings: { theme: 'old-theme' },
			setSettings,
			persistSettings,
			setLocalThemeId,
			setActiveThemeId,
			applyTheme
		});

		expect(appliedThemeId).toBe('theme-local');
		expect(setLocalThemeId).toHaveBeenCalledWith('theme-local');
		expect(setSettings).not.toHaveBeenCalled();
		expect(persistSettings).not.toHaveBeenCalled();
		expect(setActiveThemeId).toHaveBeenCalledWith('theme-local');
		expect(applyTheme).toHaveBeenCalledWith(themeToApply);
	});

	it('restores previous theme when canceling apply confirmation', () => {
		const applyThemeById = vi.fn();

		const activeThemeId = restoreThemeAfterCreateCancel({
			previousThemeId: 'theme-prev',
			fallbackThemeId: 'theme-fallback',
			applyThemeById
		});

		expect(activeThemeId).toBe('theme-prev');
		expect(applyThemeById).toHaveBeenCalledWith('theme-prev');
	});

	it('falls back to system theme when no theme ids are available', () => {
		const applyThemeById = vi.fn();

		const activeThemeId = restoreThemeAfterCreateCancel({
			previousThemeId: null,
			fallbackThemeId: null,
			applyThemeById
		});

		expect(activeThemeId).toBe('system');
		expect(applyThemeById).toHaveBeenCalledWith('system');
	});
});
