import { expect, test } from "bun:test";
import { createAgentBridge, type AgentRuntime } from "./agentBridge";

test("agent bridge maps provider configuration, streaming, approval, and cancellation to the runtime", async () => {
  const requests: { method: string; params: unknown }[] = [];
  let emit: ((event: { content?: string }) => void) | undefined;
  const runtime: AgentRuntime = {
    async request<Result>(method: string, params: unknown) {
      requests.push({ method, params });
      return { configured: true, model: "local-model", cancelled: true, accepted: true } as Result;
    },
    async stream<Result, Event>(method: string, params: unknown, onEvent: (event: Event) => void) {
      requests.push({ method, params });
      emit = onEvent as (event: { content?: string }) => void;
      return undefined as Result;
    },
  };
  const agent = createAgentBridge(runtime);
  const updates: unknown[] = [];

  await agent.configure({
    baseUrl: "http://localhost:1234/v1",
    apiKey: "secret",
    model: "local-model",
  });
  const stream = agent.stream(
    "run-1",
    { model: "local-model", messages: [{ role: "user", content: "Hi" }] },
    (event) => updates.push(event),
  );
  emit?.({ content: "Hello" });
  await stream;
  await agent.cancel("run-1");
  await agent.respondApproval("tool-1", true);

  expect(requests.map(({ method }) => method)).toEqual([
    "provider.configure",
    "chat.stream",
    "chat.cancel",
    "approval.respond",
  ]);
  expect(updates).toEqual([{ content: "Hello" }]);
});
