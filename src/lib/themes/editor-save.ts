import { toast } from 'svelte-sonner';
import type { Theme } from '$lib/types';
import { addCommunityTheme, updateCommunityTheme } from '$lib/themes/community';
import { applyTheme } from '$lib/themes/apply';
import { validateTheme, isDuplicateTheme } from '$lib/utils/theme';

type SaveEditorThemeParams = {
	themeToSave: Theme;
	isEditing: boolean;
	existingThemes: Theme[];
	activeThemeId?: string | null;
};

export const saveEditorTheme = async ({
	themeToSave,
	isEditing,
	existingThemes,
	activeThemeId
}: SaveEditorThemeParams): Promise<Theme | null> => {
	const validation = validateTheme(themeToSave);
	if (!validation.valid) {
		toast.error(validation.error ?? 'Invalid theme');
		return null;
	}

	const themesToCheck = isEditing
		? existingThemes.filter((theme) => theme.id !== themeToSave.id)
		: existingThemes;

	if (isDuplicateTheme(themeToSave, themesToCheck, false, themeToSave.id)) {
		toast.error('A theme with the same content already exists.');
		return null;
	}

	if (isEditing) {
		if (await updateCommunityTheme(themeToSave)) {
			toast.success(`Theme "${themeToSave.name}" updated successfully!`);
			if (themeToSave.id === activeThemeId) {
				applyTheme(themeToSave);
			}
			return themeToSave;
		}
		return null;
	}

	if (await addCommunityTheme(themeToSave)) {
		return themeToSave;
	}
	return null;
};

