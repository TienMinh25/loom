export const RUNTIME_PROTOCOL_VERSION = 1;

export type RuntimeTransport = {
  send(message: string): void;
  onMessage(listener: (message: string) => void): () => void;
  onExit(listener: (error: Error) => void): () => void;
  close(): void;
};

type RuntimeResponse<T> = {
  version: number;
  id: string;
  result?: T;
  event?: unknown;
  done?: boolean;
  error?: { code: string; message: string };
};

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  onEvent?: (value: unknown) => void;
};

export class RuntimeClient {
  private readonly transport: RuntimeTransport;
  private nextRequestId = 0;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly unsubscribeMessage: () => void;
  private readonly unsubscribeExit: () => void;
  private disposed = false;

  constructor(transport: RuntimeTransport) {
    this.transport = transport;
    this.unsubscribeMessage = transport.onMessage((message) => this.receive(message));
    this.unsubscribeExit = transport.onExit((error) => this.failPending(error));
  }

  request<Result>(method: string, params: unknown): Promise<Result> {
    return this.sendRequest<Result>(method, params);
  }

  stream<Result, Event>(
    method: string,
    params: unknown,
    onEvent: (event: Event) => void,
  ): Promise<Result> {
    return this.sendRequest<Result>(method, params, (event) => onEvent(event as Event));
  }

  private sendRequest<Result>(
    method: string,
    params: unknown,
    onEvent?: (value: unknown) => void,
  ): Promise<Result> {
    if (this.disposed) {
      return Promise.reject(new Error("runtime client is closed"));
    }

    const id = String(++this.nextRequestId);
    return new Promise<Result>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as Result),
        reject,
        onEvent,
      });
      try {
        this.transport.send(
          JSON.stringify({ version: RUNTIME_PROTOCOL_VERSION, id, method, params }),
        );
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribeMessage();
    this.unsubscribeExit();
    this.transport.close();
    this.failPending(new Error("runtime client is closed"));
  }

  private receive(message: string) {
    let response: RuntimeResponse<unknown>;
    try {
      response = JSON.parse(message) as RuntimeResponse<unknown>;
    } catch {
      this.failPending(new Error("runtime returned an invalid response"));
      return;
    }

    if (response === null || typeof response !== "object" || typeof response.id !== "string") {
      this.failPending(new Error("runtime returned an invalid response"));
      return;
    }

    if (response.version !== RUNTIME_PROTOCOL_VERSION) {
      this.failPending(new Error("runtime protocol version mismatch"));
      return;
    }

    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    if (response.event !== undefined && response.done) {
      this.pending.delete(response.id);
      pending.reject(new Error("runtime returned a frame with both event and done"));
      return;
    }
    if (response.error) {
      this.pending.delete(response.id);
      pending.reject(new Error(`${response.error.code}: ${response.error.message}`));
      return;
    }
    if (response.event !== undefined) {
      if (pending.onEvent) {
        pending.onEvent(response.event);
        return;
      }
      this.pending.delete(response.id);
      pending.reject(new Error("runtime returned an unexpected event for a request"));
      return;
    }
    if (response.done || !pending.onEvent) {
      this.pending.delete(response.id);
      pending.resolve(response.result);
      return;
    }
    this.pending.delete(response.id);
    pending.reject(new Error("runtime returned an invalid streaming response"));
  }

  private failPending(error: Error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
