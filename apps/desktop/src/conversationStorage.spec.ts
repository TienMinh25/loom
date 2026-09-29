import { expect, test } from "bun:test";
import { loadConversationState, saveConversationState } from "./conversationStorage";

test("conversation storage restores messages and the selected conversation", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const state = {
    conversations: [
      {
        id: "chat-1",
        title: "Fix layout",
        messages: [{ role: "user" as const, content: "Fix it" }],
      },
    ],
    activeConversationId: "chat-1",
  };

  saveConversationState(storage, state);

  expect(loadConversationState(storage)).toEqual(state);
});

test("conversation storage rejects malformed saved data", () => {
  const storage = { getItem: () => "{broken", setItem: () => undefined };

  expect(loadConversationState(storage)).toEqual({
    conversations: [{ id: "welcome", title: "Welcome to Loom", messages: [] }],
    activeConversationId: "welcome",
  });
});
