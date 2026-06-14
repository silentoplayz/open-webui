// A lightweight cross-tab notification channel for chat lifecycle events.
// Uses the BroadcastChannel API (same pattern as the existing active-tab-channel).

export type ChatLifecycleEvent =
	| { type: 'chat:deleted'; chatIds: string[] }
	| { type: 'chats:cleared' };

const CHANNEL_NAME = 'open-webui:chat-lifecycle';

export const chatEventChannel = new BroadcastChannel(CHANNEL_NAME);

export const broadcastChatDeleted = (chatIds: string[]) => {
	chatEventChannel.postMessage({ type: 'chat:deleted', chatIds } as ChatLifecycleEvent);
};

export const broadcastChatsCleared = () => {
	chatEventChannel.postMessage({ type: 'chats:cleared' } as ChatLifecycleEvent);
};
