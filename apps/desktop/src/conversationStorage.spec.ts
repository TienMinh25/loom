import { expect, test } from "bun:test";
import { loadConversationState, NEW_CHAT_ID, saveConversationState } from "./conversationStorage";

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
        toolApprovals: [
          {
            id: "approval-1",
            toolName: "workspace.writeFile",
            arguments: { path: "main.go" },
            afterMessageCount: 1,
            status: "approved" as const,
          },
        ],
      },
    ],
    activeConversationId: "chat-1",
  };

  saveConversationState(storage, state);

  expect(loadConversationState(storage)).toEqual(state);
});

test("conversation storage discards legacy empty drafts and selects a saved session", () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        conversations: [
          { id: "draft", title: "New conversation", messages: [] },
          {
            id: "saved",
            title: "Saved session",
            messages: [{ role: "user", content: "A sent message" }],
          },
        ],
        activeConversationId: "draft",
      }),
    setItem: () => undefined,
  };

  expect(loadConversationState(storage)).toEqual({
    conversations: [
      {
        id: "saved",
        title: "Saved session",
        messages: [{ role: "user", content: "A sent message" }],
        toolApprovals: undefined,
      },
    ],
    activeConversationId: "saved",
  });
});

test("conversation storage restores a workspace-free new chat without adding a recent session", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const state = {
    conversations: [
      {
        id: "saved",
        title: "Saved conversation",
        messages: [{ role: "user" as const, content: "Keep working" }],
      },
    ],
    activeConversationId: NEW_CHAT_ID,
  };

  saveConversationState(storage, state);

  expect(loadConversationState(storage)).toEqual(state);
});

test("conversation storage rejects malformed saved data", () => {
  const storage = { getItem: () => "{broken", setItem: () => undefined };

  expect(loadConversationState(storage)).toEqual({
    conversations: [],
    activeConversationId: "",
  });
});

test("conversation storage rejects malformed tool approval history", () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        conversations: [{ id: "chat-1", title: "Fix layout", messages: [], toolApprovals: {} }],
        activeConversationId: "chat-1",
      }),
    setItem: () => undefined,
  };

  expect(loadConversationState(storage)).toEqual({
    conversations: [],
    activeConversationId: "",
  });
});

test("conversation storage marks approvals from an interrupted run as unavailable", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const state = {
    conversations: [
      {
        id: "chat-1",
        title: "Edit file",
        messages: [],
        toolApprovals: [
          {
            id: "approval-1",
            toolName: "workspace.writeFile",
            arguments: { path: "main.go" },
            afterMessageCount: 0,
            status: "pending" as const,
          },
        ],
      },
    ],
    activeConversationId: "chat-1",
  };

  saveConversationState(storage, state);

  expect(loadConversationState(storage).conversations[0]?.toolApprovals?.[0]?.status).toBe(
    "unavailable",
  );
});
