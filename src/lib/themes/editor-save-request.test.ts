import { describe, expect, it, vi } from 'vitest';

import type { Theme } from '$lib/types';
import { processEditorSaveRequest, restoreThemeAfterEditorSave } from './editor-save-request';

const createTheme = (id = 'theme-edit'): Theme => ({
	id,
	name: 'Theme',
	base: 'dark'
});

describe('editor-save-request', () => {
	it('returns none when save fails', async () => {
		const saveTheme = vi.fn().mockResolvedValue(null);

		const outcome = await processEditorSaveRequest({
			updatedTheme: createTheme(),
			isEditing: true,
			saveTheme
		});

		expect(outcome).toEqual({ action: 'none' });
		expect(saveTheme).toHaveBeenCalledWith(expect.objectContaining({ id: 'theme-edit' }), true);
	});

	it('returns confirm-new for successful create flow', async () => {
		const savedTheme = createTheme('theme-created');
		const saveTheme = vi.fn().mockResolvedValue(savedTheme);

		const outcome = await processEditorSaveRequest({
			updatedTheme: savedTheme,
			isEditing: false,
			saveTheme
		});

		expect(outcome).toEqual({ action: 'confirm-new', savedTheme });
	});

	it('returns close-and-restore for successful edit flow', async () => {
		const saveTheme = vi.fn().mockResolvedValue(createTheme('theme-existing'));

		const outcome = await processEditorSaveRequest({
			updatedTheme: createTheme('theme-existing'),
			isEditing: true,
			saveTheme
		});

		expect(outcome).toEqual({ action: 'close-and-restore' });
	});

	it('restores prior active theme after save', () => {
		const applyThemeById = vi.fn();
		const setThemeId = vi.fn();

		const activeThemeId = restoreThemeAfterEditorSave({
			previousThemeId: 'theme-prev',
			fallbackThemeId: 'theme-fallback',
			currentThemeId: 'theme-current',
			applyThemeById,
			setThemeId
		});

		expect(activeThemeId).toBe('theme-prev');
		expect(applyThemeById).toHaveBeenCalledWith('theme-prev');
		expect(setThemeId).toHaveBeenCalledWith('theme-prev');
	});

	it('keeps theme store untouched when active id is unchanged', () => {
		const applyThemeById = vi.fn();
		const setThemeId = vi.fn();

		const activeThemeId = restoreThemeAfterEditorSave({
			previousThemeId: null,
			fallbackThemeId: 'theme-fallback',
			currentThemeId: 'theme-fallback',
			applyThemeById,
			setThemeId
		});

		expect(activeThemeId).toBe('theme-fallback');
		expect(applyThemeById).toHaveBeenCalledWith('theme-fallback');
		expect(setThemeId).not.toHaveBeenCalled();
	});
});
