import { describe, expect, it, vi } from 'vitest';

import type { Theme } from '$lib/types';
import { applyEditorSaveOutcome } from './editor-save-outcome';

const createTheme = (id = 'theme-created'): Theme => ({
	id,
	name: 'Created Theme',
	base: 'dark'
});

describe('editor-save-outcome', () => {
	it('returns none and leaves state untouched when save has no result', () => {
		const setThemeToApply = vi.fn();
		const showCreateConfirm = vi.fn();
		const closeEditor = vi.fn();
		const clearEditingTheme = vi.fn();
		const clearSelectedTheme = vi.fn();
		const restoreThemeAfterEditSave = vi.fn();

		const applied = applyEditorSaveOutcome({
			outcome: { action: 'none' },
			setThemeToApply,
			showCreateConfirm,
			closeEditor,
			clearEditingTheme,
			clearSelectedTheme,
			restoreThemeAfterEditSave
		});

		expect(applied).toEqual({ action: 'none' });
		expect(setThemeToApply).not.toHaveBeenCalled();
		expect(showCreateConfirm).not.toHaveBeenCalled();
		expect(closeEditor).not.toHaveBeenCalled();
		expect(clearEditingTheme).not.toHaveBeenCalled();
		expect(clearSelectedTheme).not.toHaveBeenCalled();
		expect(restoreThemeAfterEditSave).not.toHaveBeenCalled();
	});

	it('handles create-confirm outcome without closing editor', () => {
		const setThemeToApply = vi.fn();
		const showCreateConfirm = vi.fn();
		const closeEditor = vi.fn();
		const clearEditingTheme = vi.fn();
		const clearSelectedTheme = vi.fn();
		const restoreThemeAfterEditSave = vi.fn();
		const savedTheme = createTheme();

		const applied = applyEditorSaveOutcome({
			outcome: { action: 'confirm-new', savedTheme },
			setThemeToApply,
			showCreateConfirm,
			closeEditor,
			clearEditingTheme,
			clearSelectedTheme,
			restoreThemeAfterEditSave
		});

		expect(applied).toEqual({ action: 'confirm-new' });
		expect(setThemeToApply).toHaveBeenCalledWith(savedTheme);
		expect(showCreateConfirm).toHaveBeenCalledTimes(1);
		expect(clearEditingTheme).toHaveBeenCalledTimes(1);
		expect(closeEditor).not.toHaveBeenCalled();
		expect(clearSelectedTheme).not.toHaveBeenCalled();
		expect(restoreThemeAfterEditSave).not.toHaveBeenCalled();
	});

	it('handles edit-save outcome by closing and restoring active theme', () => {
		const closeEditor = vi.fn();
		const clearEditingTheme = vi.fn();
		const clearSelectedTheme = vi.fn();
		const restoreThemeAfterEditSave = vi.fn().mockReturnValue('theme-prev');

		const applied = applyEditorSaveOutcome({
			outcome: { action: 'close-and-restore' },
			setThemeToApply: vi.fn(),
			showCreateConfirm: vi.fn(),
			closeEditor,
			clearEditingTheme,
			clearSelectedTheme,
			restoreThemeAfterEditSave
		});

		expect(applied).toEqual({ action: 'restore-after-edit', activeThemeId: 'theme-prev' });
		expect(closeEditor).toHaveBeenCalledTimes(1);
		expect(clearEditingTheme).toHaveBeenCalledTimes(1);
		expect(clearSelectedTheme).toHaveBeenCalledTimes(1);
		expect(restoreThemeAfterEditSave).toHaveBeenCalledTimes(1);
		expect(closeEditor.mock.invocationCallOrder[0]).toBeLessThan(
			restoreThemeAfterEditSave.mock.invocationCallOrder[0]
		);
	});
});
