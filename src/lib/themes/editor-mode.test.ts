import { describe, expect, it } from 'vitest';

import { resolveThemeEditorIsEditing } from './editor-mode';

describe('editor-mode', () => {
	it('returns true when editor is open with an editing theme id', () => {
		expect(resolveThemeEditorIsEditing(true, 'theme-123')).toBe(true);
	});

	it('returns false when editor is open and no editing theme id is present', () => {
		expect(resolveThemeEditorIsEditing(true, null)).toBe(false);
		expect(resolveThemeEditorIsEditing(true, undefined)).toBe(false);
	});

	it('returns null when editor is closed', () => {
		expect(resolveThemeEditorIsEditing(false, 'theme-123')).toBeNull();
		expect(resolveThemeEditorIsEditing(false, null)).toBeNull();
	});
});
