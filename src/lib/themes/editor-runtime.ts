import type { ThemeEditorBridgeHandlers } from '$lib/themes/editor-bridge';

export type ThemeEditorRuntimeHandles = {
	clearThemeEditorBridgeHandlers: (() => void) | null;
	stopThemeEditingSync: (() => void) | null;
};

type RestartThemeEditorRuntimeOptions = ThemeEditorRuntimeHandles & {
	setThemeEditorBridgeHandlers: (handlers: ThemeEditorBridgeHandlers) => () => void;
	bridgeHandlers: ThemeEditorBridgeHandlers;
	startThemeEditingSync: () => () => void;
};

export const restartThemeEditorRuntime = ({
	clearThemeEditorBridgeHandlers,
	stopThemeEditingSync,
	setThemeEditorBridgeHandlers,
	bridgeHandlers,
	startThemeEditingSync
}: RestartThemeEditorRuntimeOptions): ThemeEditorRuntimeHandles => {
	clearThemeEditorBridgeHandlers?.();
	stopThemeEditingSync?.();

	return {
		clearThemeEditorBridgeHandlers: setThemeEditorBridgeHandlers(bridgeHandlers),
		stopThemeEditingSync: startThemeEditingSync()
	};
};

export const cleanupThemeEditorRuntime = ({
	clearThemeEditorBridgeHandlers,
	stopThemeEditingSync
}: ThemeEditorRuntimeHandles): ThemeEditorRuntimeHandles => {
	clearThemeEditorBridgeHandlers?.();
	stopThemeEditingSync?.();

	return {
		clearThemeEditorBridgeHandlers: null,
		stopThemeEditingSync: null
	};
};
