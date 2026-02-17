import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '$lib/types';

vi.mock('svelte-sonner', () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn()
	}
}));

vi.mock('$lib/themes/community', () => ({
	addCommunityTheme: vi.fn(),
	updateCommunityTheme: vi.fn()
}));

vi.mock('$lib/themes/apply', () => ({
	applyTheme: vi.fn()
}));

vi.mock('$lib/utils/theme', () => ({
	validateTheme: vi.fn(),
	isDuplicateTheme: vi.fn()
}));

import { toast } from 'svelte-sonner';
import { addCommunityTheme, updateCommunityTheme } from '$lib/themes/community';
import { applyTheme } from '$lib/themes/apply';
import { validateTheme, isDuplicateTheme } from '$lib/utils/theme';
import { saveEditorTheme } from '$lib/themes/editor-save';

const createTheme = (overrides: Partial<Theme> = {}): Theme => ({
	id: 'theme-1',
	name: 'Theme One',
	base: 'dark',
	...overrides
});

describe('saveEditorTheme', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(validateTheme).mockReturnValue({ valid: true });
		vi.mocked(isDuplicateTheme).mockReturnValue(false);
		vi.mocked(updateCommunityTheme).mockResolvedValue(false);
		vi.mocked(addCommunityTheme).mockResolvedValue(false);
	});

	it('returns null and shows an error when validation fails', async () => {
		const theme = createTheme();
		vi.mocked(validateTheme).mockReturnValue({ valid: false, error: 'Bad theme' });

		const result = await saveEditorTheme({
			themeToSave: theme,
			isEditing: false,
			existingThemes: []
		});

		expect(result).toBeNull();
		expect(toast.error).toHaveBeenCalledWith('Bad theme');
		expect(addCommunityTheme).not.toHaveBeenCalled();
		expect(updateCommunityTheme).not.toHaveBeenCalled();
	});

	it('returns null and shows an error when a duplicate is detected', async () => {
		const theme = createTheme();
		vi.mocked(isDuplicateTheme).mockReturnValue(true);

		const result = await saveEditorTheme({
			themeToSave: theme,
			isEditing: false,
			existingThemes: [createTheme({ id: 'theme-2' })]
		});

		expect(result).toBeNull();
		expect(toast.error).toHaveBeenCalledWith('A theme with the same content already exists.');
		expect(addCommunityTheme).not.toHaveBeenCalled();
	});

	it('updates and reapplies the active theme when editing succeeds', async () => {
		const theme = createTheme({ id: 'active-theme' });
		vi.mocked(updateCommunityTheme).mockResolvedValue(true);

		const result = await saveEditorTheme({
			themeToSave: theme,
			isEditing: true,
			existingThemes: [theme],
			activeThemeId: 'active-theme'
		});

		expect(result).toEqual(theme);
		expect(updateCommunityTheme).toHaveBeenCalledWith(theme);
		expect(toast.success).toHaveBeenCalledWith('Theme "Theme One" updated successfully!');
		expect(applyTheme).toHaveBeenCalledWith(theme);
	});

	it('updates without applying when editing a non-active theme', async () => {
		const theme = createTheme({ id: 'edited-theme' });
		vi.mocked(updateCommunityTheme).mockResolvedValue(true);

		const result = await saveEditorTheme({
			themeToSave: theme,
			isEditing: true,
			existingThemes: [theme],
			activeThemeId: 'different-theme'
		});

		expect(result).toEqual(theme);
		expect(applyTheme).not.toHaveBeenCalled();
	});

	it('creates a new theme when add succeeds', async () => {
		const theme = createTheme();
		vi.mocked(addCommunityTheme).mockResolvedValue(true);

		const result = await saveEditorTheme({
			themeToSave: theme,
			isEditing: false,
			existingThemes: []
		});

		expect(result).toEqual(theme);
		expect(addCommunityTheme).toHaveBeenCalledWith(theme);
		expect(updateCommunityTheme).not.toHaveBeenCalled();
	});
});

