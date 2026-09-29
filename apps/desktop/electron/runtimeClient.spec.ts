import { afterEach, expect, test } from "bun:test";
import { RuntimeClient, type RuntimeTransport } from "./runtimeClient";

class FakeTransport implements RuntimeTransport {
  sent: string[] = [];
  private messageListeners = new Set<(message: string) => void>();
  private exitListeners = new Set<(error: Error) => void>();

  send(message: string) {
    this.sent.push(message);
  }

  onMessage(listener: (message: string) => void) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onExit(listener: (error: Error) => void) {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  close() {}

  respond(message: unknown) {
    for (const listener of this.messageListeners) {
      listener(JSON.stringify(message));
    }
  }

  exit(message: string) {
    for (const listener of this.exitListeners) {
      listener(new Error(message));
    }
  }
}

let client: RuntimeClient | undefined;

afterEach(() => {
  client?.dispose();
  client = undefined;
});

test("runtime client sends versioned requests and resolves matching responses", async () => {
  const transport = new FakeTransport();
  client = new RuntimeClient(transport);

  const pending = client.request<{ root: string }>("workspace.open", { root: "C:/project" });
  const request = JSON.parse(transport.sent[0]) as { version: number; id: string; method: string };
  expect(request.version).toBe(1);
  expect(request.id).toBeTruthy();
  expect(request.method).toBe("workspace.open");

  transport.respond({ version: 1, id: request.id, result: { root: "C:/project" } });
  expect(await pending).toEqual({ root: "C:/project" });
});

test("runtime client rejects RPC errors and requests interrupted by process exit", async () => {
  const transport = new FakeTransport();
  client = new RuntimeClient(transport);
  const failedRequest = client.request("workspace.writeFile", { path: "app.ts", content: "x" });
  const request = JSON.parse(transport.sent[0]) as { id: string };
  transport.respond({
    version: 1,
    id: request.id,
    error: { code: "workspace_error", message: "write denied" },
  });
  await expect(failedRequest).rejects.toThrow("write denied");

  const interruptedRequest = client.request("workspace.list", { path: "." });
  transport.exit("runtime exited");
  await expect(interruptedRequest).rejects.toThrow("runtime exited");
});

test("runtime client delivers stream events until the correlated done frame", async () => {
  const transport = new FakeTransport();
  client = new RuntimeClient(transport);
  const events: unknown[] = [];
  const pending = client.stream<{ finished: boolean }, unknown>(
    "chat.stream",
    { runId: "run-1", request: {} },
    (event) => events.push(event),
  );
  const request = JSON.parse(transport.sent[0]) as { id: string };

  transport.respond({ version: 1, id: request.id, event: { content: "Hello" } });
  transport.respond({ version: 1, id: request.id, event: { content: " world" } });
  expect(events).toEqual([{ content: "Hello" }, { content: " world" }]);
  transport.respond({ version: 1, id: request.id, done: true, result: { finished: true } });

  await expect(pending).resolves.toEqual({ finished: true });
});

test("runtime client rejects a streamed runtime error after events", async () => {
  const transport = new FakeTransport();
  client = new RuntimeClient(transport);
  const pending = client.stream("chat.stream", {}, () => {});
  const request = JSON.parse(transport.sent[0]) as { id: string };

  transport.respond({
    version: 1,
    id: request.id,
    error: { code: "cancelled", message: "stopped" },
  });
  await expect(pending).rejects.toThrow("cancelled: stopped");
});

test("runtime client rejects events for normal requests", async () => {
  const transport = new FakeTransport();
  client = new RuntimeClient(transport);
  const pending = client.request("workspace.list", { path: "." });
  const request = JSON.parse(transport.sent[0]) as { id: string };
  transport.respond({ version: 1, id: request.id, event: { content: "unexpected" } });
  await expect(pending).rejects.toThrow("unexpected event");
});

test("runtime client rejects terminal frames without result metadata for streamed requests", async () => {
  const transport = new FakeTransport();
  client = new RuntimeClient(transport);
  const pending = client.stream("chat.stream", {}, () => {});
  const request = JSON.parse(transport.sent[0]) as { id: string };
  transport.respond({ version: 1, id: request.id, result: {} });
  await expect(pending).rejects.toThrow("invalid streaming response");
});

test("runtime client rejects ambiguous stream frames", async () => {
  const transport = new FakeTransport();
  client = new RuntimeClient(transport);
  const pending = client.stream("chat.stream", {}, () => {});
  const request = JSON.parse(transport.sent[0]) as { id: string };
  transport.respond({ version: 1, id: request.id, event: {}, done: true });
  await expect(pending).rejects.toThrow("both event and done");
});
