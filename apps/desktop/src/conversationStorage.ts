import type { Conversation } from "./types/conversation";

const STORAGE_KEY = "loom:conversations:v1";

export type ConversationState = {
  conversations: Conversation[];
  activeConversationId: string;
};

type StoragePort = Pick<Storage, "getItem" | "setItem">;

const EMPTY_STATE: ConversationState = {
  conversations: [{ id: "welcome", title: "Welcome to Loom", messages: [] }],
  activeConversationId: "welcome",
};

function isConversationState(value: unknown): value is ConversationState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<ConversationState>;
  return (
    Array.isArray(state.conversations) &&
    state.conversations.length > 0 &&
    state.conversations.every(
      (conversation) =>
        !!conversation &&
        typeof conversation.id === "string" &&
        typeof conversation.title === "string" &&
        Array.isArray(conversation.messages) &&
        conversation.messages.every(
          (message) =>
            !!message &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string",
        ),
    ) &&
    typeof state.activeConversationId === "string" &&
    state.conversations.some((conversation) => conversation.id === state.activeConversationId)
  );
}

export function loadConversationState(storage: StoragePort): ConversationState {
  try {
    const encoded = storage.getItem(STORAGE_KEY);
    if (!encoded) return EMPTY_STATE;
    const value: unknown = JSON.parse(encoded);
    return isConversationState(value) ? value : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export function saveConversationState(storage: StoragePort, state: ConversationState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
