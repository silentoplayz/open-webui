import type { Theme } from '$lib/types';

export type OpenThemeEditorRequest = {
	theme: Theme;
	isEditing: boolean;
	previousThemeId: string;
	saveChanges?: boolean;
};

export type ActiveThemeChangedRequest = {
	themeId: string;
};

export type ThemeEditorBridgeHandlers = {
	onOpenEditor?: (request: OpenThemeEditorRequest) => Promise<void> | void;
	onActiveThemeChanged?: (request: ActiveThemeChangedRequest) => void;
};

let handlers: ThemeEditorBridgeHandlers = {};

export const setThemeEditorBridgeHandlers = (next: ThemeEditorBridgeHandlers) => {
	handlers = next;
	return () => {
		if (handlers === next) {
			handlers = {};
		}
	};
};

export const requestThemeEditorOpen = async (request: OpenThemeEditorRequest) => {
	await handlers.onOpenEditor?.(request);
};

export const notifyActiveThemeChanged = (themeId: string) => {
	handlers.onActiveThemeChanged?.({ themeId });
};
