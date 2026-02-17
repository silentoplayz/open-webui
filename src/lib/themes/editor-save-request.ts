import type { Theme } from '$lib/types';
import { restoreEditorActiveTheme } from '$lib/themes/editor-active-theme';

type ProcessEditorSaveRequestOptions = {
	updatedTheme: Theme;
	isEditing: boolean;
	saveTheme: (themeToSave: Theme, isEditing: boolean) => Promise<Theme | null>;
};

export type EditorSaveRequestOutcome =
	| { action: 'none' }
	| { action: 'confirm-new'; savedTheme: Theme }
	| { action: 'close-and-restore' };

export const processEditorSaveRequest = async ({
	updatedTheme,
	isEditing,
	saveTheme
}: ProcessEditorSaveRequestOptions): Promise<EditorSaveRequestOutcome> => {
	const savedTheme = await saveTheme(updatedTheme, isEditing);

	if (!savedTheme) {
		return { action: 'none' };
	}

	if (!isEditing) {
		return { action: 'confirm-new', savedTheme };
	}

	return { action: 'close-and-restore' };
};

type RestoreAfterEditorSaveOptions = {
	previousThemeId?: string | null;
	fallbackThemeId?: string | null;
	currentThemeId?: string | null;
	applyThemeById: (themeId: string) => void;
	setThemeId: (themeId: string) => void;
};

export const restoreThemeAfterEditorSave = ({
	previousThemeId,
	fallbackThemeId,
	currentThemeId,
	applyThemeById,
	setThemeId
}: RestoreAfterEditorSaveOptions): string =>
	restoreEditorActiveTheme({
		previousThemeId,
		fallbackThemeId,
		currentThemeId,
		applyTheme: applyThemeById,
		setTheme: setThemeId
	});
