import { describe, expect, it, vi } from 'vitest';

import type { Theme } from '$lib/types';
import { applyThemeEditorPreview, cancelThemeEditorSession } from './editor-cancel-preview';

const createTheme = (id = 'theme-preview'): Theme => ({
	id,
	name: 'Preview Theme',
	base: 'dark'
});

describe('editor-cancel-preview', () => {
	it('applies live preview updates', () => {
		const theme = createTheme('theme-live');
		const setSelectedTheme = vi.fn();
		const applyThemePreview = vi.fn();

		applyThemeEditorPreview({
			theme,
			setSelectedTheme,
			applyThemePreview
		});

		expect(setSelectedTheme).toHaveBeenCalledWith(theme);
		expect(applyThemePreview).toHaveBeenCalledWith(theme);
	});

	it('closes editor state and restores previous theme', () => {
		const closeEditor = vi.fn();
		const clearEditingTheme = vi.fn();
		const clearSelectedTheme = vi.fn();
		const applyThemeById = vi.fn();
		const setThemeId = vi.fn();

		const activeThemeId = cancelThemeEditorSession({
			previousThemeId: 'theme-prev',
			fallbackThemeId: 'theme-fallback',
			currentThemeId: 'theme-current',
			closeEditor,
			clearEditingTheme,
			clearSelectedTheme,
			applyThemeById,
			setThemeId
		});

		expect(activeThemeId).toBe('theme-prev');
		expect(closeEditor).toHaveBeenCalledTimes(1);
		expect(clearEditingTheme).toHaveBeenCalledTimes(1);
		expect(clearSelectedTheme).toHaveBeenCalledTimes(1);
		expect(applyThemeById).toHaveBeenCalledWith('theme-prev');
		expect(setThemeId).toHaveBeenCalledWith('theme-prev');
		expect(closeEditor.mock.invocationCallOrder[0]).toBeLessThan(
			applyThemeById.mock.invocationCallOrder[0]
		);
	});

	it('keeps theme store unchanged when restored id matches current', () => {
		const setThemeId = vi.fn();

		const activeThemeId = cancelThemeEditorSession({
			previousThemeId: null,
			fallbackThemeId: 'theme-fallback',
			currentThemeId: 'theme-fallback',
			closeEditor: vi.fn(),
			clearEditingTheme: vi.fn(),
			clearSelectedTheme: vi.fn(),
			applyThemeById: vi.fn(),
			setThemeId
		});

		expect(activeThemeId).toBe('theme-fallback');
		expect(setThemeId).not.toHaveBeenCalled();
	});
});
