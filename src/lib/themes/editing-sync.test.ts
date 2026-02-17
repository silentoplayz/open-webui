import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { editingThemeId, editingThemes } from '$lib/stores';
import { startThemeEditingSync } from '$lib/themes/editing-sync';

vi.hoisted(() => {
	const storage = new Map<string, string>();
	(globalThis as unknown as { localStorage: Storage }).localStorage = {
		getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key),
		clear: () => storage.clear(),
		key: (index: number) => Array.from(storage.keys())[index] ?? null,
		get length() {
			return storage.size;
		}
	} as Storage;
});

vi.mock('$app/environment', () => ({
	browser: true,
	dev: false
}));

vi.mock('uuid', () => ({
	v4: () => 'tab-1'
}));

class MockBroadcastChannel {
	static instances: MockBroadcastChannel[] = [];

	name: string;
	postedMessages: Array<Record<string, unknown>> = [];
	closed = false;
	onmessage: ((event: MessageEvent) => void) | null = null;

	constructor(name: string) {
		this.name = name;
		MockBroadcastChannel.instances.push(this);
	}

	postMessage(message: Record<string, unknown>) {
		this.postedMessages.push(message);
	}

	close() {
		this.closed = true;
	}
}

describe('theme editing sync', () => {
	beforeEach(() => {
		MockBroadcastChannel.instances = [];
		editingThemeId.set(null);
		editingThemes.set({});
		(globalThis as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel =
			MockBroadcastChannel;
	});

	it('starts sync, broadcasts query, and tracks editingThemeId changes', () => {
		const stop = startThemeEditingSync();
		const channel = MockBroadcastChannel.instances[0];

		expect(channel.name).toBe('theme-editing-sync');
		expect(channel.postedMessages.some((m) => m.type === 'query')).toBe(true);
		expect(
			channel.postedMessages.some(
				(m) => m.type === 'editing-update' && m.tabId === 'tab-1' && m.themeId === null
			)
		).toBe(true);

		editingThemeId.set('theme-a');
		expect(
			channel.postedMessages.some(
				(m) => m.type === 'editing-update' && m.tabId === 'tab-1' && m.themeId === 'theme-a'
			)
		).toBe(true);

		stop();
	});

	it('responds to query and applies editing-update messages from other tabs', () => {
		editingThemeId.set('my-theme');
		const stop = startThemeEditingSync();
		const channel = MockBroadcastChannel.instances[0];

		channel.onmessage?.({ data: { type: 'query' } } as MessageEvent);
		expect(
			channel.postedMessages.some(
				(m) => m.type === 'editing-update' && m.tabId === 'tab-1' && m.themeId === 'my-theme'
			)
		).toBe(true);

		channel.onmessage?.({
			data: { type: 'editing-update', tabId: 'tab-2', themeId: 'remote-theme' }
		} as MessageEvent);
		expect(get(editingThemes)).toEqual({ 'tab-2': 'remote-theme' });

		channel.onmessage?.({
			data: { type: 'editing-update', tabId: 'tab-2', themeId: null }
		} as MessageEvent);
		expect(get(editingThemes)).toEqual({});

		stop();
	});

	it('posts clear update and closes channel on stop', () => {
		const stop = startThemeEditingSync();
		const channel = MockBroadcastChannel.instances[0];
		const beforeStopCount = channel.postedMessages.length;

		stop();

		expect(channel.closed).toBe(true);
		expect(channel.postedMessages.length).toBe(beforeStopCount + 1);
		expect(channel.postedMessages.at(-1)).toEqual({
			type: 'editing-update',
			tabId: 'tab-1',
			themeId: null
		});
	});
});
