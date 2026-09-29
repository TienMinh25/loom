export type ApprovalState =
  "hidden" | "pending" | "approved" | "rejected" | "changes-accepted" | "changes-rejected";

export type Conversation = {
  id: string;
  title: string;
  messages: ConversationMessage[];
  approvalState?: ApprovalState;
};

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "error";
};
