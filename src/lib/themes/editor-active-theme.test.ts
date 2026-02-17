import { describe, expect, it, vi } from 'vitest';
import { resolveEditorActiveThemeId, restoreEditorActiveTheme } from '$lib/themes/editor-active-theme';

describe('resolveEditorActiveThemeId', () => {
	it('prefers previousThemeId when provided', () => {
		expect(resolveEditorActiveThemeId('previous-theme', 'fallback-theme')).toBe('previous-theme');
	});

	it('uses fallbackThemeId when previousThemeId is empty', () => {
		expect(resolveEditorActiveThemeId('', 'fallback-theme')).toBe('fallback-theme');
	});

	it('defaults to system when neither id is available', () => {
		expect(resolveEditorActiveThemeId(null, null)).toBe('system');
	});
});

describe('restoreEditorActiveTheme', () => {
	it('applies and syncs store when current theme differs', () => {
		const applyTheme = vi.fn();
		const setTheme = vi.fn();

		const activeThemeId = restoreEditorActiveTheme({
			previousThemeId: 'edited-theme',
			fallbackThemeId: 'fallback-theme',
			currentThemeId: 'other-theme',
			applyTheme,
			setTheme
		});

		expect(activeThemeId).toBe('edited-theme');
		expect(applyTheme).toHaveBeenCalledWith('edited-theme');
		expect(setTheme).toHaveBeenCalledWith('edited-theme');
	});

	it('applies without syncing store when current theme already matches', () => {
		const applyTheme = vi.fn();
		const setTheme = vi.fn();

		const activeThemeId = restoreEditorActiveTheme({
			previousThemeId: 'matching-theme',
			fallbackThemeId: 'fallback-theme',
			currentThemeId: 'matching-theme',
			applyTheme,
			setTheme
		});

		expect(activeThemeId).toBe('matching-theme');
		expect(applyTheme).toHaveBeenCalledWith('matching-theme');
		expect(setTheme).not.toHaveBeenCalled();
	});
});

