import { describe, expect, test } from "bun:test";
import { approvalModeOptions, getApprovalPreviewState } from "./approvalMode";

describe("approval modes", () => {
  test("uses the desktop permission labels and maps them to preview policy states", () => {
    expect(approvalModeOptions.map((option) => option.label)).toEqual([
      "Ask for approval",
      "Approve for me",
      "Full access",
    ]);
    expect(getApprovalPreviewState("ask")).toBe("pending");
    expect(getApprovalPreviewState("approve-me")).toBe("approved");
    expect(getApprovalPreviewState("full-access")).toBe("changes-accepted");
  });
});
