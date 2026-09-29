# UI and Interaction — v1

**Docs version:** 1.19.0
**Status:** Draft baseline  
**Last updated:** 2026-09-29

## 1. Main window

The selected v1 frontend stack is React + TypeScript hosted by Electron, with Bun for package management and UI development/build/test scripts. Electron provides the desktop shell; React renders the interface. Use Ant Design for common UI controls and layout components, keeping custom CSS focused on product-specific layout and theme. Browser preview uses deterministic fixtures; desktop mode uses the versioned Go runtime through typed IPC.

The renderer uses Ant Design `Splitter` for draggable conversation and explorer panels. Collapsed panels remain fixed-width icon rails, expanded widths and open state persist, and the center keeps a usable minimum width. The native directory picker opens a workspace in the supervised Go runtime. The right explorer supports refresh and lazy folder listing; files up to 50 MiB open in editable center tabs beside Chat, and larger files show a clear limit message. Save, Save All, debounced Auto Save, Ctrl/Cmd+S, and dirty-tab discard confirmation are supported. Browser preview edits remain in session memory. Provider settings support OpenAI-compatible base URL/model/API key, desktop stores the key using OS-backed encryption, agent responses stream, and workspace tool calls wait for approval.

Use a three-area coding workspace:

```text
┌──────────────────┬─────────────────────────────┬──────────────────┐
│ Threads / recent │ Conversation and run events │ Workspace files  │
│                  │                             │ (right side)     │
│                  │                             │                  │
├──────────────────┴─────────────────────────────┴──────────────────┤
│ Active workspace · model/provider · approval state                  │
└────────────────────────────────────────────────────────────────────┘
```

The workspace explorer belongs on the right in v1. It can be collapsed and resized. Keep **Open Folder** available from the welcome state and workspace menu. The active root is always visible, and an empty state explains how to open one.

**Open Folder** immediately opens Electron's native directory picker in desktop mode. In browser preview mode it immediately opens the browser's directory chooser. OAuth/account identity, model discovery, file indexing/search, real diff review, command execution, and terminal remain future work.

## 2. Navigation regions

- **Left sidebar:** conversation list, search, new conversation, workspace/thread grouping.
- **Center:** message composer and chronological conversation/run timeline.
- **Right sidebar:** active workspace root, file tree, selected-file preview/open action, and optionally changed-files list.
- **Bottom/status area:** provider state, active model, active workspace, and run state.

The desktop restores conversations/messages from local renderer storage, lets users delete conversations after confirmation, and disables New Chat while the active conversation is empty. Global File, Edit, View, and Help menus sit above all three workbench columns. The file tree starts collapsed at the workspace root; context menus create files/folders and delete selected items. Open files appear beside Chat only while at least one file is open; the editor shows a line-number gutter. Workspace writes and deletions remain confined to the selected root. Durable runtime database/transcript storage, language-aware syntax highlighting, indexing/search, real diff review, shell/terminal, Git integration, and plugin execution are not implemented.

Do not overload the right side with both the entire explorer and a large diff view at once. Selecting a changed file may open the diff in the center or a dedicated tab while preserving explorer state.

## 3. Workspace and folder behavior

- **Open Folder** opens the platform directory picker. Desktop mode stores the selected root in the Go runtime and requests directory metadata as the user expands the tree; browser preview loads the selected directory into the current session.
- Opening a new folder sets it as the active workspace; existing conversations retain their original workspace association.
- Display the canonical workspace name/path in workspace controls and the explorer header.
- Allow tree expansion/collapse, file selection, refresh, and opening a file in a center editor tab while keeping Chat available as another tab.
- Keep the workspace root collapsed on open; expand a directory only after the user activates its tree control.
- Add context-menu actions for New File, New Folder, and Delete. Confirm deletes. Deleting a non-empty folder removes its contents only inside the selected workspace.
- Show the Chat tab only while at least one file tab is open. Chat itself cannot be closed; file tabs can be closed individually.
- Provide a New File action in the open workspace explorer. Accept a workspace-relative path, create an empty file without replacing existing content, and open it in a center editor tab.
- Put the global Auto Save toggle and Save All action in the top-level File menu. Individual tabs retain manual Save. Auto Save is debounced and writes through the workspace-scoped runtime in desktop mode. Keep edits made during an in-flight write marked unsaved; keep unsaved state when a write fails.
- Provide explicit empty, loading, indexing, permission-denied, and unreadable-file states.
- Context menu actions may include copy path, reveal in OS file manager, and add file to agent context.
- Switching workspace does not silently grant access to prior or external roots.

## 4. Conversation timeline

Render each item by type: user message, assistant response, progress/status, tool request, approval card, tool result, diff summary, and error/cancelled run. Tool calls should be inspectable and visibly distinguish proposed, waiting, executing, completed, rejected, failed, and cancelled states.

Keep intermediate model reasoning private; show concise progress/status and tool activity rather than hidden chain-of-thought. Include timestamps or relative time for actions and let users expand tool inputs/results when useful.

## 5. Approval cards

For each approval request show:

- Tool/action name and plain-language reason.
- Exact file paths, command/arguments, and relevant working directory.
- Effects requested (read/write/execute/network) and scope.
- Approve once, reject, and (where supported) approve within a named limited scope.

An approval response should update the timeline immediately and be persisted by the future runtime. If the request changes after presentation, invalidate the prior approval and ask again.

## 6. Diff and file changes

- Show changed files and per-file additions/deletions.
- Let the user inspect a unified or side-by-side diff.
- Mark whether each change is pending, applied, accepted, or reverted according to the implementation model.
- Provide a clear path to restore a file from a pre-edit checkpoint when available.
- Never imply that accepting a UI card is the same as a Git commit.

## 7. Authentication and provider settings

Settings expose the current OpenAI-compatible provider configuration:

- Base URL, model, and optional API key.
- Save the API key through OS-backed Electron encryption; never return a saved key to the renderer.
- Show the active model and provider errors while chatting.

OAuth, organization identity, and model discovery are future work.

On provider errors, stop the run and show the runtime error. Do not silently switch provider endpoints.

## 8. Accessibility and keyboard basics

Support keyboard navigation among sidebar, conversation, composer, and explorer; visible focus; accessible names for icon-only controls; and a keyboard shortcut to open a folder and focus the composer. Avoid status-only color coding for approvals/errors.

## 9. Permission control terminology reference

Follow the current Codex desktop permission vocabulary where supported: **Ask for approval**, **Approve for me**, and **Full access**. The exact options depend on policy and host configuration. Labels communicate intent only; the runtime must validate and enforce each action's scope and capabilities. The UI preview maps the three choices to mock states and does not grant filesystem, process, network, or credential access.

## 10. Desktop shell behavior

- Keep panel drag state inside the resizable layout so pointer movement does not rerender the conversation and settings state on every drag event. Remember the last expanded width when a side panel is collapsed.
- Electron runs with context isolation and renderer sandbox enabled, with Node integration disabled. The preload bundle must be CommonJS because sandboxed preload scripts do not load ESM imports. Expose only explicit APIs through the preload bridge.
- Deny new windows and navigation away from the development renderer origin or packaged app document.
- Renderer and Electron shell outputs are build artifacts; keep them ignored by Git.
