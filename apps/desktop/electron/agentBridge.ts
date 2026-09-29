import type { AgentProviderConfig, AgentStreamUpdate } from "../shared/desktopApi.js";

export type AgentRuntime = {
  request<Result>(method: string, params: unknown): Promise<Result>;
  stream<Result, Event>(
    method: string,
    params: unknown,
    onEvent: (event: Event) => void,
  ): Promise<Result>;
};

export function createAgentBridge(runtime: AgentRuntime) {
  return {
    configure(config: AgentProviderConfig) {
      return runtime.request<{ configured: boolean; model: string }>("provider.configure", config);
    },
    stream(
      runId: string,
      request: { model: string; messages: { role: string; content: string }[] },
      onUpdate: (update: AgentStreamUpdate) => void,
    ) {
      return runtime.stream<void, AgentStreamUpdate>("chat.stream", { runId, request }, onUpdate);
    },
    cancel(runId: string) {
      return runtime.request<{ cancelled: boolean }>("chat.cancel", { runId });
    },
    respondApproval(approvalId: string, approved: boolean) {
      return runtime.request<{ accepted: boolean }>("approval.respond", { approvalId, approved });
    },
  };
}
