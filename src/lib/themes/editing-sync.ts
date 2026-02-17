import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import { editingThemeId, editingThemes } from '$lib/stores';

type ThemeEditingSyncMessage =
	| {
			type: 'editing-update';
			tabId: string;
			themeId: string | null;
	  }
	| {
			type: 'query';
	  };

export const startThemeEditingSync = (): (() => void) => {
	if (!browser) {
		return () => {};
	}

	const tabId = uuidv4();
	const channel = new BroadcastChannel('theme-editing-sync');

	channel.onmessage = (event: MessageEvent<ThemeEditingSyncMessage>) => {
		if (event.data?.type === 'editing-update') {
			const { tabId: senderTabId, themeId } = event.data;
			if (!senderTabId) return;

			editingThemes.update((prev) => {
				const next = { ...prev };
				if (themeId) {
					next[senderTabId] = themeId;
				} else {
					delete next[senderTabId];
				}
				return next;
			});
			return;
		}

		if (event.data?.type === 'query') {
			const activeThemeId = get(editingThemeId);
			if (activeThemeId) {
				channel.postMessage({
					type: 'editing-update',
					tabId,
					themeId: activeThemeId
				});
			}
		}
	};

	const unsubscribeEditingTheme = editingThemeId.subscribe((themeId) => {
		channel.postMessage({
			type: 'editing-update',
			tabId,
			themeId
		});
	});

	channel.postMessage({ type: 'query' });

	return () => {
		unsubscribeEditingTheme();
		channel.postMessage({
			type: 'editing-update',
			tabId,
			themeId: null
		});
		channel.close();
	};
};

