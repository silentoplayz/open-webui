import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	setThemeEditorBridgeHandlers,
	requestThemeEditorOpen,
	notifyActiveThemeChanged,
	type OpenThemeEditorRequest
} from '$lib/themes/editor-bridge';

const createOpenRequest = (): OpenThemeEditorRequest => ({
	theme: {
		id: 'theme-1',
		name: 'Theme One',
		base: 'dark'
	},
	isEditing: true,
	previousThemeId: 'system',
	saveChanges: true
});

describe('theme editor bridge', () => {
	beforeEach(() => {
		// Reset global handlers between tests.
		setThemeEditorBridgeHandlers({})();
	});

	it('routes open requests to the registered handler', async () => {
		const onOpenEditor = vi.fn();
		const request = createOpenRequest();

		const cleanup = setThemeEditorBridgeHandlers({ onOpenEditor });
		await requestThemeEditorOpen(request);

		expect(onOpenEditor).toHaveBeenCalledTimes(1);
		expect(onOpenEditor).toHaveBeenCalledWith(request);

		cleanup();
	});

	it('routes active theme change notifications to the registered handler', () => {
		const onActiveThemeChanged = vi.fn();
		const cleanup = setThemeEditorBridgeHandlers({ onActiveThemeChanged });

		notifyActiveThemeChanged('theme-2');

		expect(onActiveThemeChanged).toHaveBeenCalledTimes(1);
		expect(onActiveThemeChanged).toHaveBeenCalledWith({ themeId: 'theme-2' });

		cleanup();
	});

	it('does not clear newer handlers when cleaning up an older registration', async () => {
		const firstHandler = vi.fn();
		const secondHandler = vi.fn();
		const request = createOpenRequest();

		const cleanupFirst = setThemeEditorBridgeHandlers({ onOpenEditor: firstHandler });
		const cleanupSecond = setThemeEditorBridgeHandlers({ onOpenEditor: secondHandler });

		cleanupFirst();
		await requestThemeEditorOpen(request);

		expect(firstHandler).not.toHaveBeenCalled();
		expect(secondHandler).toHaveBeenCalledTimes(1);

		cleanupSecond();
	});
});

