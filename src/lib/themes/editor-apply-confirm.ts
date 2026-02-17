import type { Theme } from '$lib/types';
import { resolveEditorActiveThemeId } from '$lib/themes/editor-active-theme';

type ApplyCreatedThemeOptions = {
	themeToApply: Theme;
	token: string | null;
	currentSettings: Record<string, unknown> | null | undefined;
	setSettings: (nextSettings: Record<string, unknown>) => void;
	persistSettings: (token: string, payload: { ui: Record<string, unknown> }) => void;
	setLocalThemeId: (themeId: string) => void;
	setActiveThemeId: (themeId: string) => void;
	applyTheme: (theme: Theme) => void;
};

export const applyCreatedTheme = ({
	themeToApply,
	token,
	currentSettings,
	setSettings,
	persistSettings,
	setLocalThemeId,
	setActiveThemeId,
	applyTheme
}: ApplyCreatedThemeOptions): string => {
	const themeId = themeToApply.id;

	setLocalThemeId(themeId);

	if (token) {
		const updatedSettings = {
			...(currentSettings ?? {}),
			theme: themeId
		};
		setSettings(updatedSettings);
		persistSettings(token, { ui: updatedSettings });
	}

	setActiveThemeId(themeId);
	applyTheme(themeToApply);

	return themeId;
};

type RestoreAfterCreateCancelOptions = {
	previousThemeId: string | null | undefined;
	fallbackThemeId: string | null | undefined;
	applyThemeById: (themeId: string) => void;
};

export const restoreThemeAfterCreateCancel = ({
	previousThemeId,
	fallbackThemeId,
	applyThemeById
}: RestoreAfterCreateCancelOptions): string => {
	const activeThemeId = resolveEditorActiveThemeId(previousThemeId, fallbackThemeId);
	applyThemeById(activeThemeId);
	return activeThemeId;
};
