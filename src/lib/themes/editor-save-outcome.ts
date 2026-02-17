import type { Theme } from '$lib/types';
import type { EditorSaveRequestOutcome } from '$lib/themes/editor-save-request';

type ApplyEditorSaveOutcomeOptions = {
	outcome: EditorSaveRequestOutcome;
	setThemeToApply: (theme: Theme) => void;
	showCreateConfirm: () => void;
	closeEditor: () => void;
	clearEditingTheme: () => void;
	clearSelectedTheme: () => void;
	restoreThemeAfterEditSave: () => string;
};

export type AppliedEditorSaveOutcome =
	| { action: 'none' }
	| { action: 'confirm-new' }
	| { action: 'restore-after-edit'; activeThemeId: string };

export const applyEditorSaveOutcome = ({
	outcome,
	setThemeToApply,
	showCreateConfirm,
	closeEditor,
	clearEditingTheme,
	clearSelectedTheme,
	restoreThemeAfterEditSave
}: ApplyEditorSaveOutcomeOptions): AppliedEditorSaveOutcome => {
	if (outcome.action === 'none') {
		return { action: 'none' };
	}

	if (outcome.action === 'confirm-new') {
		setThemeToApply(outcome.savedTheme);
		showCreateConfirm();
		clearEditingTheme();
		return { action: 'confirm-new' };
	}

	closeEditor();
	clearEditingTheme();
	clearSelectedTheme();
	return {
		action: 'restore-after-edit',
		activeThemeId: restoreThemeAfterEditSave()
	};
};
