import type { Theme } from '$lib/types';

type HandleApplyCreatedThemeConfirmOptions = {
	themeToApply: Theme | null;
	onThemeCreated: (themeName: string) => void;
	applyCreatedTheme: (theme: Theme) => string;
	resetEditorState: () => void;
};

export const handleApplyCreatedThemeConfirm = ({
	themeToApply,
	onThemeCreated,
	applyCreatedTheme,
	resetEditorState
}: HandleApplyCreatedThemeConfirmOptions): string | null => {
	if (!themeToApply) {
		resetEditorState();
		return null;
	}

	onThemeCreated(themeToApply.name);
	const themeId = applyCreatedTheme(themeToApply);
	resetEditorState();
	return themeId;
};

type HandleKeepCurrentAfterCreateConfirmOptions = {
	themeToApply: Theme | null;
	onThemeCreated: (themeName: string) => void;
	restorePreviousTheme: () => string;
	resetEditorState: () => void;
};

export const handleKeepCurrentAfterCreateConfirm = ({
	themeToApply,
	onThemeCreated,
	restorePreviousTheme,
	resetEditorState
}: HandleKeepCurrentAfterCreateConfirmOptions): string | null => {
	if (!themeToApply) {
		resetEditorState();
		return null;
	}

	onThemeCreated(themeToApply.name);
	const activeThemeId = restorePreviousTheme();
	resetEditorState();
	return activeThemeId;
};
