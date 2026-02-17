import { describe, expect, it, vi } from 'vitest';

import type { ThemeEditorBridgeHandlers } from './editor-bridge';
import { cleanupThemeEditorRuntime, restartThemeEditorRuntime } from './editor-runtime';

describe('editor-runtime', () => {
	it('restarts runtime by clearing previous handles before re-registering', () => {
		const clearThemeEditorBridgeHandlers = vi.fn();
		const stopThemeEditingSync = vi.fn();
		const nextBridgeCleanup = vi.fn();
		const nextSyncCleanup = vi.fn();
		const setThemeEditorBridgeHandlers = vi.fn().mockReturnValue(nextBridgeCleanup);
		const startThemeEditingSync = vi.fn().mockReturnValue(nextSyncCleanup);
		const bridgeHandlers: ThemeEditorBridgeHandlers = {
			onOpenEditor: vi.fn(),
			onActiveThemeChanged: vi.fn()
		};

		const next = restartThemeEditorRuntime({
			clearThemeEditorBridgeHandlers,
			stopThemeEditingSync,
			setThemeEditorBridgeHandlers,
			bridgeHandlers,
			startThemeEditingSync
		});

		expect(clearThemeEditorBridgeHandlers).toHaveBeenCalledTimes(1);
		expect(stopThemeEditingSync).toHaveBeenCalledTimes(1);
		expect(setThemeEditorBridgeHandlers).toHaveBeenCalledWith(bridgeHandlers);
		expect(startThemeEditingSync).toHaveBeenCalledTimes(1);
		expect(next).toEqual({
			clearThemeEditorBridgeHandlers: nextBridgeCleanup,
			stopThemeEditingSync: nextSyncCleanup
		});
		expect(clearThemeEditorBridgeHandlers.mock.invocationCallOrder[0]).toBeLessThan(
			setThemeEditorBridgeHandlers.mock.invocationCallOrder[0]
		);
	});

	it('supports restarting from empty handles', () => {
		const nextBridgeCleanup = vi.fn();
		const nextSyncCleanup = vi.fn();

		const next = restartThemeEditorRuntime({
			clearThemeEditorBridgeHandlers: null,
			stopThemeEditingSync: null,
			setThemeEditorBridgeHandlers: vi.fn().mockReturnValue(nextBridgeCleanup),
			bridgeHandlers: {},
			startThemeEditingSync: vi.fn().mockReturnValue(nextSyncCleanup)
		});

		expect(next.clearThemeEditorBridgeHandlers).toBe(nextBridgeCleanup);
		expect(next.stopThemeEditingSync).toBe(nextSyncCleanup);
	});

	it('cleans up runtime handles and nulls references', () => {
		const clearThemeEditorBridgeHandlers = vi.fn();
		const stopThemeEditingSync = vi.fn();

		const next = cleanupThemeEditorRuntime({
			clearThemeEditorBridgeHandlers,
			stopThemeEditingSync
		});

		expect(clearThemeEditorBridgeHandlers).toHaveBeenCalledTimes(1);
		expect(stopThemeEditingSync).toHaveBeenCalledTimes(1);
		expect(next).toEqual({
			clearThemeEditorBridgeHandlers: null,
			stopThemeEditingSync: null
		});
	});

	it('no-ops cleanup when handles are already null', () => {
		const next = cleanupThemeEditorRuntime({
			clearThemeEditorBridgeHandlers: null,
			stopThemeEditingSync: null
		});

		expect(next).toEqual({
			clearThemeEditorBridgeHandlers: null,
			stopThemeEditingSync: null
		});
	});
});
