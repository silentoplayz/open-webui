export const resolveThemeEditorIsEditing = (
	showThemeEditor: boolean,
	editingThemeId: string | null | undefined
): boolean | null => {
	if (!showThemeEditor) {
		return null;
	}

	return !!editingThemeId;
};
