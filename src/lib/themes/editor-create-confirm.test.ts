import { describe, expect, it, vi } from 'vitest';

import type { Theme } from '$lib/types';
import {
	handleApplyCreatedThemeConfirm,
	handleKeepCurrentAfterCreateConfirm
} from './editor-create-confirm';

const createTheme = (id = 'theme-created'): Theme => ({
	id,
	name: 'Created Theme',
	base: 'dark'
});

describe('editor-create-confirm', () => {
	it('applies created theme and resets state', () => {
		const onThemeCreated = vi.fn();
		const applyCreatedTheme = vi.fn().mockReturnValue('theme-created');
		const resetEditorState = vi.fn();

		const themeId = handleApplyCreatedThemeConfirm({
			themeToApply: createTheme(),
			onThemeCreated,
			applyCreatedTheme,
			resetEditorState
		});

		expect(themeId).toBe('theme-created');
		expect(onThemeCreated).toHaveBeenCalledWith('Created Theme');
		expect(applyCreatedTheme).toHaveBeenCalledWith(expect.objectContaining({ id: 'theme-created' }));
		expect(resetEditorState).toHaveBeenCalledTimes(1);
	});

	it('resets without applying when created theme is missing', () => {
		const onThemeCreated = vi.fn();
		const applyCreatedTheme = vi.fn();
		const resetEditorState = vi.fn();

		const themeId = handleApplyCreatedThemeConfirm({
			themeToApply: null,
			onThemeCreated,
			applyCreatedTheme,
			resetEditorState
		});

		expect(themeId).toBeNull();
		expect(onThemeCreated).not.toHaveBeenCalled();
		expect(applyCreatedTheme).not.toHaveBeenCalled();
		expect(resetEditorState).toHaveBeenCalledTimes(1);
	});

	it('keeps current theme and restores previous active theme', () => {
		const onThemeCreated = vi.fn();
		const restorePreviousTheme = vi.fn().mockReturnValue('theme-prev');
		const resetEditorState = vi.fn();

		const activeThemeId = handleKeepCurrentAfterCreateConfirm({
			themeToApply: createTheme(),
			onThemeCreated,
			restorePreviousTheme,
			resetEditorState
		});

		expect(activeThemeId).toBe('theme-prev');
		expect(onThemeCreated).toHaveBeenCalledWith('Created Theme');
		expect(restorePreviousTheme).toHaveBeenCalledTimes(1);
		expect(resetEditorState).toHaveBeenCalledTimes(1);
	});

	it('resets without restore when created theme is missing', () => {
		const onThemeCreated = vi.fn();
		const restorePreviousTheme = vi.fn();
		const resetEditorState = vi.fn();

		const activeThemeId = handleKeepCurrentAfterCreateConfirm({
			themeToApply: null,
			onThemeCreated,
			restorePreviousTheme,
			resetEditorState
		});

		expect(activeThemeId).toBeNull();
		expect(onThemeCreated).not.toHaveBeenCalled();
		expect(restorePreviousTheme).not.toHaveBeenCalled();
		expect(resetEditorState).toHaveBeenCalledTimes(1);
	});
});
