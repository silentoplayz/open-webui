import { describe, expect, it, vi } from 'vitest';

import type { Theme } from '$lib/types';
import type { OpenThemeEditorRequest } from './editor-bridge';
import { openThemeEditorSession } from './editor-open-session';

const createTheme = (overrides: Partial<Theme> = {}): Theme => ({
	id: 'theme-edit',
	name: 'Theme To Edit',
	base: 'dark',
	variables: {
		'--color-blue-500': '#0000ff'
	},
	...overrides
});

const createRequest = (
	overrides: Partial<OpenThemeEditorRequest> = {}
): OpenThemeEditorRequest => ({
	theme: createTheme(),
	isEditing: true,
	previousThemeId: 'theme-prev',
	saveChanges: false,
	...overrides
});

describe('editor-open-session', () => {
	it('auto-saves current session when saveChanges is enabled', async () => {
		const saveCurrentTheme = vi.fn().mockResolvedValue(undefined);
		const applyThemePreview = vi.fn();
		const currentSelectedTheme = createTheme({ id: 'theme-current', name: 'Current Theme' });
		const request = createRequest({ saveChanges: true });

		await openThemeEditorSession({
			request,
			currentSelectedTheme,
			currentIsEditingTheme: true,
			saveCurrentTheme,
			applyThemePreview
		});

		expect(saveCurrentTheme).toHaveBeenCalledWith(currentSelectedTheme, true);
	});

	it('skips auto-save when saveChanges is false', async () => {
		const saveCurrentTheme = vi.fn().mockResolvedValue(undefined);
		const applyThemePreview = vi.fn();
		const request = createRequest({ saveChanges: false });

		await openThemeEditorSession({
			request,
			currentSelectedTheme: createTheme({ id: 'theme-current' }),
			currentIsEditingTheme: true,
			saveCurrentTheme,
			applyThemePreview
		});

		expect(saveCurrentTheme).not.toHaveBeenCalled();
	});

	it('clones request theme for selected/original state and applies preview', async () => {
		const saveCurrentTheme = vi.fn().mockResolvedValue(undefined);
		const applyThemePreview = vi.fn();
		const request = createRequest();

		const nextSession = await openThemeEditorSession({
			request,
			currentSelectedTheme: null,
			currentIsEditingTheme: false,
			saveCurrentTheme,
			applyThemePreview
		});

		expect(nextSession.selectedTheme).toEqual(request.theme);
		expect(nextSession.originalTheme).toEqual(request.theme);
		expect(nextSession.selectedTheme).not.toBe(request.theme);
		expect(nextSession.originalTheme).not.toBe(request.theme);
		expect(nextSession.selectedTheme).not.toBe(nextSession.originalTheme);
		expect(applyThemePreview).toHaveBeenCalledWith(nextSession.selectedTheme);
		expect(nextSession.isEditingTheme).toBe(request.isEditing);
		expect(nextSession.previousThemeId).toBe(request.previousThemeId);
	});

	it('skips auto-save when there is no current selected theme', async () => {
		const saveCurrentTheme = vi.fn().mockResolvedValue(undefined);
		const applyThemePreview = vi.fn();
		const request = createRequest({ saveChanges: true });

		await openThemeEditorSession({
			request,
			currentSelectedTheme: null,
			currentIsEditingTheme: true,
			saveCurrentTheme,
			applyThemePreview
		});

		expect(saveCurrentTheme).not.toHaveBeenCalled();
	});
});
