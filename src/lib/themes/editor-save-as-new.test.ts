import { describe, expect, it } from 'vitest';

import type { Theme } from '$lib/types';
import { prepareThemeSaveAsNew } from './editor-save-as-new';

const createTheme = (overrides: Partial<Theme> = {}): Theme => ({
	id: 'theme-original',
	name: 'Original Theme',
	base: 'dark',
	sourceUrl: 'https://example.com/theme.json',
	variables: {
		'--color-blue-500': '#123456'
	},
	...overrides
});

describe('editor-save-as-new', () => {
	it('appends copy suffix when name matches original theme', () => {
		const originalTheme = createTheme({ name: 'Ocean' });
		const draftTheme = createTheme({ name: 'Ocean' });

		const result = prepareThemeSaveAsNew({
			draftTheme,
			originalTheme,
			createThemeId: () => 'theme-new-id'
		});

		expect(result.name).toBe('Ocean (Copy)');
		expect(result.id).toBe('theme-new-id');
	});

	it('keeps name unchanged when name differs from original', () => {
		const originalTheme = createTheme({ name: 'Ocean' });
		const draftTheme = createTheme({ name: 'Forest' });

		const result = prepareThemeSaveAsNew({
			draftTheme,
			originalTheme,
			createThemeId: () => 'theme-new-id'
		});

		expect(result.name).toBe('Forest');
		expect(result.id).toBe('theme-new-id');
	});

	it('keeps name unchanged when original theme is not provided', () => {
		const draftTheme = createTheme({ name: 'Nebula' });

		const result = prepareThemeSaveAsNew({
			draftTheme,
			originalTheme: null,
			createThemeId: () => 'theme-nebula'
		});

		expect(result.name).toBe('Nebula');
		expect(result.id).toBe('theme-nebula');
	});

	it('returns a cloned theme without mutating the input draft', () => {
		const draftTheme = createTheme({ name: 'Mutable' });

		const result = prepareThemeSaveAsNew({
			draftTheme,
			originalTheme: createTheme({ name: 'Mutable' }),
			createThemeId: () => 'theme-clone'
		});

		expect(result).not.toBe(draftTheme);
		expect(result.variables).toEqual(draftTheme.variables);
		expect(result.sourceUrl).toBe('https://example.com/theme.json');
		expect(draftTheme.id).toBe('theme-original');
		expect(draftTheme.name).toBe('Mutable');
	});
});
