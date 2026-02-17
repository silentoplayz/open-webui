type RestoreEditorActiveThemeParams = {
	previousThemeId?: string | null;
	fallbackThemeId?: string | null;
	currentThemeId?: string | null;
	applyTheme: (themeId: string) => void;
	setTheme: (themeId: string) => void;
};

export const resolveEditorActiveThemeId = (
	previousThemeId?: string | null,
	fallbackThemeId?: string | null
): string => previousThemeId || fallbackThemeId || 'system';

export const restoreEditorActiveTheme = ({
	previousThemeId,
	fallbackThemeId,
	currentThemeId,
	applyTheme,
	setTheme
}: RestoreEditorActiveThemeParams): string => {
	const activeThemeId = resolveEditorActiveThemeId(previousThemeId, fallbackThemeId);
	applyTheme(activeThemeId);
	if (currentThemeId !== activeThemeId) {
		setTheme(activeThemeId);
	}
	return activeThemeId;
};

