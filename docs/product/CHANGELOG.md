# Documentation Changelog

All product/architecture/UI decisions that change the v1 baseline should be recorded here. Update the version in `README.md` and affected documents with each entry.

## 1.19.0 — 2026-09-29

Raise the editor and runtime file-size limits to match a full-size code editor.

- Support opening and saving workspace text files up to 50 MiB in the browser preview and Go runtime.
- Increase the runtime JSON-lines frame limit so files larger than the previous 2 MiB transport limit arrive intact.
- Show a clear editor message for files above the supported limit and document the cap.

## 1.17.0 — 2026-09-29

Improve the desktop workbench and record the local session storage direction.

- Add a global File/Edit/View/Help menu, a VS Code-style collapsed-by-default explorer, line-number gutter, and chat/file tab behavior.
- Add create-folder and confirmed delete actions to the explorer context menu; keep runtime filesystem changes inside the selected root.
- Persist conversations in renderer local storage, guard empty-chat creation, and allow confirmed conversation deletion.
- Add Loom's red-panda avatar and pure-Go ICO/ICNS generation, plus cross-platform Makefile and root architecture/build guide. Disable CGO for Go app builds.
- Record Codex CLI's SQLite metadata plus JSONL transcript pattern as a proposal for durable runtime history; local storage remains current behavior.

## 1.18.0 — 2026-09-29

Polish the shell behavior and open selected folders directly.

- Remove the browser sample-workspace dialog and open the folder chooser immediately in both desktop and browser preview modes.
- Add regression coverage for direct folder selection and workspace switching.
- Use the Loom avatar as the app favicon and keep the product docs version aligned.
- Use the splitter container's actual available height so collapsed panel restoration does not apply competing viewport and flex sizing.
- Remove the browser preview's arbitrary 1 MB text-file cutoff and add a large-file regression test.

## 1.16.0 — 2026-09-29

Add a workspace-scoped new-file workflow.

- Add versioned `workspace.createFile` RPC and Electron bridge operation; creation is exclusive and rejects paths outside the open root.
- Add New File in the right explorer and open the newly created file in the center editor.
- Document new-file behavior and regression coverage expectations.

## 1.13.0 — 2026-09-29

Move editor save preferences to the top-level File menu.

- Add a global Auto Save setting and Save All command to the menu.
- Keep manual Save in the active editor tab.

## 1.14.0 — 2026-09-29

Select OpenAI-compatible as the first live provider path and document the current agent boundary.

- Go runtime targets Go 1.26.0 with normalized provider DTOs and an OpenAI-compatible adapter.
- Add streamed agent runs, cancellation, typed approval responses, and workspace-scoped list/read/write tools.
- Persist provider keys through Electron OS-backed encryption.
- Persist panel state/width, refresh workspace entries, support Ctrl/Cmd+S, and confirm before discarding dirty tabs.
- Mark OAuth, history persistence, indexing/search, diff review, command execution, terminal, Git, and plugins as future work.

## 1.15.0 — 2026-09-29

Update the product baseline to match the implemented OpenAI-compatible desktop path.

- Document desktop Go runtime integration and browser-only mock fixtures accurately.
- Align provider settings, stream/tool approval behavior, and persistence scope with the current implementation.
- Include the Electron provider bridge and encrypted config store in its TypeScript packaging input.

## 1.12.0 — 2026-09-29

Add optional Auto Save while retaining manual file saves.

- Debounce automatic writes through the scoped desktop runtime.
- Keep newer edits unsaved when an earlier write is still in flight.

## 1.11.0 — 2026-09-29

Standardized the initial Go runtime structure and its external HTTP boundary.

- Use Uber Fx at the Go composition root for dependency wiring and lifecycle shutdown.
- Define a shared JSON HTTP client contract and provider-neutral Server-Sent Events parser.
- Record remaining runtime protocol and provider integration work in the delivery plan.

## 1.10.0 — 2026-09-29

Integrated the first desktop filesystem vertical slice and moved the Go runtime to the repository root.

- The native folder picker opens a root in the supervised Go runtime; the right explorer loads folder contents as needed and opens files in editor tabs.
- Desktop editor saves write through the scoped workspace runtime; browser preview edits remain session-only.
- Document the root-level `runtime/` module and typed Electron IPC boundary.

## 1.9.0 — 2026-09-30

Added editable file tabs to the UI preview.

- Edit opened workspace files in the center editor while preserving Chat as a separate tab.
- Mark edited files as unsaved and retain preview edits for the current app session.
- Clarify that preview changes are not written to disk until runtime filesystem integration.

## 1.8.0 — 2026-09-30

Stabilized collapsible workspace panels.

- Keep conversation and explorer sidebars available as fixed-width icon rails when collapsed.
- Preserve expanded panel widths while resizing; retain a minimum center workspace width.
- Keep folder navigation and tree browsing in the right-hand explorer.

## 1.6.0 — 2026-09-29

Advanced the UI-first desktop preview and aligned permission controls with Codex terminology.

- Added an Electron main/preload shell with renderer isolation and Windows/macOS packaging scripts.
- Permission controls now use **Ask for approval**, **Approve for me**, and **Full access**, placed below the composer.
- Added directory selection with an in-session file tree and center editor tabs; messages remain in memory until runtime integration.
- Documented the local-preview scope for gateway account settings, plugins, MCP, and approval flows.
- Updated the UI baseline for Codex-style permission mode labels and runtime-owned enforcement.

## 1.5.0 — 2026-09-29

Extended the renderer prototype's conversation and change-review workflows.

- Preserve multiple conversations and their messages locally; allow filtering and switching between them.
- Persist preview approval/diff decisions with the corresponding conversation.
- Added a mock tool approval → proposed diff → accept/reject flow and approval-mode-specific preview behavior.
- Added Ctrl/Cmd+N and Ctrl/Cmd+Shift+O shortcuts and animated left-panel collapse using the splitter.

## 1.4.0 — 2026-09-28

Expanded and clarified the UI-first desktop prototype.

- Added draggable and collapsible conversation/workspace panels, with light and dark themes.
- Added local prototype message/theme persistence, sample workspace/file previews, search, Settings, approval mode selection, and mock approve/reject states.
- Clarified that native folder access, real gateway authentication, indexing, and tool execution are future integrations; current sample interactions do not touch the host filesystem or network.

## 1.3.0 — 2026-09-28

Selected Ant Design as the v1 component library and expanded the first interactive UI prototype.

- Use Ant Design for common controls and layout, with limited custom CSS for Loom-specific composition and theme.
- Added tests for the folder-open affordance and sending a prompt in local prototype state.
- Documented that the prototype does not yet connect to the agent runtime.

## 1.2.0 — 2026-09-28

Selected the UI stack and made v1 delivery UI-first.

- Selected Electron for the desktop shell, React + TypeScript for the UI, and Bun for UI package management/build/test workflows.
- Specified that the UI is developed against a typed mock runtime client first.
- Moved the Go runtime foundation after the interactive UI prototype; build and integrate harness capabilities progressively.

## 1.1.0 — 2026-09-28

Added the implementation-language decision and first-version delivery plan.

- Set TypeScript for desktop UI and Go for the agent runtime.
- Required TDD and interface-first dependency boundaries, without requiring hexagonal architecture everywhere.
- Added a phased v1 plan with deliverables, TDD gates, exit criteria, and proposed repository shape.
- Added root `AGENTS.md` project rules for TDD, testability, language boundaries, and documentation versioning.

## 1.0.0 — 2026-09-28

Initial v1 baseline.

- Defined a Windows/macOS local-first coding-agent desktop harness.
- Made authentication to a configured LLM gateway the mandatory standard path.
- Allowed direct provider API-key configuration as an optional advanced path.
- Added open-folder/workspace selection and a right-side file explorer requirement.
- Documented local conversation/event persistence, mediated tools, approvals, diffs, indexing, and plugin boundaries.
- Established documentation versioning rules for future changes.
