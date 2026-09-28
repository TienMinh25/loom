/// <reference lib="dom" />

import { test, expect, describe } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

describe("MainUI testing", () => {
  test("shows the Loom workspace and prompt composer", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "What are we building today?" }).textContent).toBe(
      "What are we building today?",
    );
    expect(screen.getByRole("textbox", { name: "Message Loom" })).toBeTruthy();
  });

  test("shows the three main desktop regions", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();

    expect(screen.getByRole("main", { name: "Conversation" })).toBeTruthy();

    expect(screen.getByRole("complementary", { name: "Workspace explorer" }).textContent).toContain(
      "No folder open",
    );
    expect(screen.getByRole("button", { name: "Open folder" })).toBeTruthy();
  });

  test("adds a sent prompt to the conversation", () => {
    render(<App />);

    const composer = screen.getByRole("textbox", { name: "Message Loom" });
    fireEvent.change(composer, { target: { value: "Review this codebase" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(screen.getByText("Review this codebase").textContent).toBe("Review this codebase");
    expect((composer as HTMLTextAreaElement).value).toBe("");
  });
});
