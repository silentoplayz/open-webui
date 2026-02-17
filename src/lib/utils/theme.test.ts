import { describe, expect, it } from 'vitest';
import { isValidThemeUrl, validateTheme } from '$lib/utils/theme';

const createTheme = (overrides: Record<string, unknown> = {}) => ({
	id: 'test-theme',
	name: 'Test Theme',
	base: 'dark',
	...overrides
});

describe('validateTheme', () => {
	it('accepts system as a valid base', () => {
		const result = validateTheme(createTheme({ base: 'system' }));
		expect(result.valid).toBe(true);
	});

	it('uses 5MB in background URL validation errors', () => {
		const result = validateTheme(
			createTheme({
				systemBackgroundImageUrl: 'javascript:alert(1)'
			})
		);

		expect(result.valid).toBe(false);
		expect(result.error).toContain('max 5MB');
	});
});

describe('isValidThemeUrl', () => {
	it('accepts small image data URIs when allowed', () => {
		const url = `data:image/png;base64,${'A'.repeat(128)}`;
		expect(isValidThemeUrl(url, true)).toBe(true);
	});

	it('rejects image data URIs larger than 5MB', () => {
		const url = `data:image/png;base64,${'A'.repeat(5 * 1024 * 1024 + 1)}`;
		expect(isValidThemeUrl(url, true)).toBe(false);
	});
});
