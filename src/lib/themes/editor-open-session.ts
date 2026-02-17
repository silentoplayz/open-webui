import type { Theme } from '$lib/types';
import type { OpenThemeEditorRequest } from '$lib/themes/editor-bridge';

type OpenThemeEditorSessionOptions = {
	request: OpenThemeEditorRequest;
	currentSelectedTheme: Theme | null;
	currentIsEditingTheme: boolean;
	saveCurrentTheme: (theme: Theme, isEditing: boolean) => Promise<void>;
	applyThemePreview: (theme: Theme) => void;
};

type OpenThemeEditorSessionState = {
	selectedTheme: Theme | null;
	originalTheme: Theme | null;
	isEditingTheme: boolean;
	previousThemeId: string;
};

const cloneTheme = (theme: Theme): Theme => JSON.parse(JSON.stringify(theme)) as Theme;

export const openThemeEditorSession = async ({
	request,
	currentSelectedTheme,
	currentIsEditingTheme,
	saveCurrentTheme,
	applyThemePreview
}: OpenThemeEditorSessionOptions): Promise<OpenThemeEditorSessionState> => {
	if (request.saveChanges && currentSelectedTheme) {
		await saveCurrentTheme(currentSelectedTheme, currentIsEditingTheme);
	}

	const selectedTheme = cloneTheme(request.theme);
	const originalTheme = cloneTheme(request.theme);
	applyThemePreview(selectedTheme);

	return {
		selectedTheme,
		originalTheme,
		isEditingTheme: request.isEditing,
		previousThemeId: request.previousThemeId
	};
};
