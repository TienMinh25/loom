import type { Conversation } from "./types/conversation";

const STORAGE_KEY = "loom:conversations:v1";
export const NEW_CHAT_ID = "__new_chat__";

export type ConversationState = {
  conversations: Conversation[];
  activeConversationId: string;
};

type StoragePort = Pick<Storage, "getItem" | "setItem">;

const EMPTY_STATE: ConversationState = {
  conversations: [],
  activeConversationId: "",
};

function isConversationState(value: unknown): value is ConversationState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as Partial<ConversationState>;
  if (!Array.isArray(state.conversations) || typeof state.activeConversationId !== "string") {
    return false;
  }
  const conversationsValid = state.conversations.every(
    (conversation) =>
      !!conversation &&
      typeof conversation.id === "string" &&
      typeof conversation.title === "string" &&
      Array.isArray(conversation.messages) &&
      (conversation.toolApprovals === undefined ||
        (Array.isArray(conversation.toolApprovals) &&
          conversation.toolApprovals.every(
            (activity) =>
              !!activity &&
              typeof activity.id === "string" &&
              typeof activity.toolName === "string" &&
              (activity.afterMessageCount === undefined ||
                (Number.isInteger(activity.afterMessageCount) &&
                  activity.afterMessageCount >= 0)) &&
              ["pending", "approved", "rejected", "unavailable"].includes(activity.status),
          ))) &&
      conversation.messages.every(
        (message) =>
          !!message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string",
      ),
  );
  if (!conversationsValid) {
    return false;
  }
  return (
    state.activeConversationId === "" ||
    state.activeConversationId === NEW_CHAT_ID ||
    state.conversations.some((conversation) => conversation.id === state.activeConversationId)
  );
}

export function loadConversationState(storage: StoragePort): ConversationState {
  try {
    const encoded = storage.getItem(STORAGE_KEY);
    if (!encoded) {
      return EMPTY_STATE;
    }
    const value: unknown = JSON.parse(encoded);
    if (!isConversationState(value)) {
      return EMPTY_STATE;
    }
    const conversations = value.conversations
      .filter(
        (conversation) =>
          conversation.messages.length > 0 || (conversation.toolApprovals?.length ?? 0) > 0,
      )
      .map((conversation) => ({
        ...conversation,
        toolApprovals: conversation.toolApprovals?.map((activity) => ({
          ...activity,
          afterMessageCount: activity.afterMessageCount ?? conversation.messages.length,
          status: activity.status === "pending" ? "unavailable" : activity.status,
        })),
      }));
    const activeConversationId =
      value.activeConversationId === NEW_CHAT_ID
        ? NEW_CHAT_ID
        : conversations.some((conversation) => conversation.id === value.activeConversationId)
          ? value.activeConversationId
          : (conversations[0]?.id ?? "");
    return { conversations, activeConversationId };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveConversationState(storage: StoragePort, state: ConversationState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
