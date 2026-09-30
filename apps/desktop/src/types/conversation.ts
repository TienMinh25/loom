export type ApprovalState =
  "hidden" | "pending" | "approved" | "rejected" | "changes-accepted" | "changes-rejected";

export type Conversation = {
  id: string;
  title: string;
  messages: ConversationMessage[];
  toolApprovals?: ToolApprovalActivity[];
  approvalState?: ApprovalState;
};

export type ToolApprovalActivity = {
  id: string;
  toolName: string;
  arguments: unknown;
  afterMessageCount: number;
  status: "pending" | "approved" | "rejected" | "unavailable";
};

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "error" | "cancelled";
};
