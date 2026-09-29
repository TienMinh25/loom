import type { ApprovalState } from "./types/conversation";

export type ApprovalMode = "ask" | "approve-me" | "full-access";

export const approvalModeOptions: { value: ApprovalMode; label: string }[] = [
  { value: "ask", label: "Ask for approval" },
  { value: "approve-me", label: "Approve for me" },
  { value: "full-access", label: "Full access" },
];

export function getApprovalPreviewState(mode: ApprovalMode): ApprovalState {
  switch (mode) {
    case "ask":
      return "pending";
    case "approve-me":
      return "approved";
    case "full-access":
      return "changes-accepted";
  }
}
