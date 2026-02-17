import type { Theme } from '$lib/types';
import { restoreEditorActiveTheme } from '$lib/themes/editor-active-theme';

type ApplyThemeEditorPreviewOptions = {
	theme: Theme;
	setSelectedTheme: (theme: Theme) => void;
	applyThemePreview: (theme: Theme) => void;
};

export const applyThemeEditorPreview = ({
	theme,
	setSelectedTheme,
	applyThemePreview
}: ApplyThemeEditorPreviewOptions): void => {
	setSelectedTheme(theme);
	applyThemePreview(theme);
};

type CancelThemeEditorSessionOptions = {
	previousThemeId?: string | null;
	fallbackThemeId?: string | null;
	currentThemeId?: string | null;
	closeEditor: () => void;
	clearEditingTheme: () => void;
	clearSelectedTheme: () => void;
	applyThemeById: (themeId: string) => void;
	setThemeId: (themeId: string) => void;
};

export const cancelThemeEditorSession = ({
	previousThemeId,
	fallbackThemeId,
	currentThemeId,
	closeEditor,
	clearEditingTheme,
	clearSelectedTheme,
	applyThemeById,
	setThemeId
}: CancelThemeEditorSessionOptions): string => {
	closeEditor();
	clearEditingTheme();
	clearSelectedTheme();

	return restoreEditorActiveTheme({
		previousThemeId,
		fallbackThemeId,
		currentThemeId,
		applyTheme: applyThemeById,
		setTheme: setThemeId
	});
};
