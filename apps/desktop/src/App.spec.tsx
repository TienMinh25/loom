/// <reference lib="dom" />

import { test, expect, describe } from "bun:test";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("MainUI testing", () => {
    test("shows the Loom welcome screen no folder is open", () => {
        render(<App></App>);

        expect(
            screen.getByRole("heading", {name: "Loom"}).textContent
        ).toBe("Loom");

        expect(
            screen.getByText("Open a folder to get started").textContent
        ).toBe("Open a folder to get started");
    });

    test("shows the three main desktop regions", () => {
        render(<App />)

        expect(screen.getByRole("navigation", {name: "Conversations"}).textContent).toContain("Conversations");
        
        expect(screen.getByRole("main", {name: "Conversation"}).textContent).toContain("Open a folder to get started");

        expect(screen.getByRole("complementary", {name: "Workspace explorer"}).textContent).toContain("No folder open");
    });
})
