import type { Theme } from '$lib/types';

type PrepareThemeSaveAsNewOptions = {
	draftTheme: Theme;
	originalTheme: Theme | null;
	createThemeId: () => string;
};

const cloneTheme = (theme: Theme): Theme => JSON.parse(JSON.stringify(theme)) as Theme;

export const prepareThemeSaveAsNew = ({
	draftTheme,
	originalTheme,
	createThemeId
}: PrepareThemeSaveAsNewOptions): Theme => {
	const preparedTheme = cloneTheme(draftTheme);

	if (originalTheme && preparedTheme.name === originalTheme.name) {
		preparedTheme.name = `${preparedTheme.name} (Copy)`;
	}

	preparedTheme.id = createThemeId();

	return preparedTheme;
};
