# UI and Interaction — v1

**Docs version:** 1.97.0
**Status:** Draft baseline  
**Last updated:** 2026-09-30

OpenCode v2 and Codex desktop are experience references for session navigation, chat timeline/composer, workspace and Git context, and settings information architecture. The immediate delivery priority is the chat frame and workspace/session entry points. Workspaces are optional: the welcome state should let a user begin chatting without selecting a directory, while keeping an obvious **Open workspace** action for adding workspace context. Show workspace and Git state below the composer: use `No Git` with a neutral monitor icon for a non-repository workspace, the current branch name with a branch icon when known, and `Branch unavailable` when Git exists but its branch cannot be determined. With no workspace open, show `No workspace open` and `No Git` as independent states, without a separator.

The workspace chip below the composer opens the folder picker so a workspace can be selected or switched while chatting, including after the welcome surface is gone. The Git/branch chip remains read-only status; branch and worktree mutations stay deferred.

In active conversations, keep the timeline independently scrollable and dock the composer with the workspace/Git context row below it. This keeps the current workspace and branch visible while reading long runs. The workspace and Git chips may wrap inside the centered composer width on narrow windows.

**Preview check (2026-09-30):** a fresh browser renderer with persisted conversations still opens on the persistent New chat tab, with no workspace selected, the compact composer/context row in the center, and grouped Settings navigation. The active-chat dock order is covered by UI regression tests.

On a fresh install with no saved panel preference, collapse the right-side workspace explorer so the chat canvas receives more width. Keep `Open workspace` in the welcome content and explorer rail, and respect an explicit saved expanded/collapsed preference on later launches.

In the empty-chat welcome, explicitly say that chatting can start without a workspace and present **Open workspace** as a filled primary button and **Create workspace** as a secondary outlined button, both with folder icons and clear keyboard focus. Use the neutral composer prompt “Ask anything or describe what you would like to build...” so the workspace-free entry point welcomes general questions as well as coding tasks. Use workspace terminology throughout this flow; avoid project terminology in the user-facing copy.

**Open workspace** selects an existing directory. **Create workspace** asks for a workspace name, then asks the user to select its parent folder and creates a new empty child directory through the scoped runtime workspace boundary. Reject path separators, platform-reserved names, and existing destinations; do not replace an existing folder. The new directory becomes the selected workspace and begins in the `No Git` state.

**Pinned OpenCode v2 UI study (verified 2026-09-30 at `4deda180370c3038877b0c35befb2e4a08cd3e31`):** [`NewSessionView`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/new-session/view.tsx) centers the wordmark/composer and puts workspace/project and Git context beneath it. [`PromptGitStatus`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/new-session/workspace/selector.tsx) displays `No Git`; the selector distinguishes local/main, existing worktrees, and creating a branch-based worktree, with searchable worktree/branch lists. Loom adopts the centered optional-workspace entry and explicit branch/`No Git` state, while deferring branch/worktree mutations.

[`SessionScreen`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/session/screen.tsx) composes timeline, review/side-panel, and composer controllers. [`message-timeline.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/session/timeline/message-timeline.tsx) and [`interaction.ts`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/session/timeline/interaction.ts) use session-keyed follow/pinned state: ordinary incoming content follows the tail until the reader scrolls away; explicit navigation can resume following. The UI exposes a jump affordance when content is below. Loom already implements near-tail follow, pause-on-scroll-up, reset on session switch, and Jump to latest; future timeline increments can consider explicit message navigation and session-keyed persistence.

[`queue.ts`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/session/composer/queue.ts), its [`unit tests`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/session/composer/queue.test.ts), and [`session composer controllers`](https://github.com/anomalyco/opencode/tree/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/session/composer) distinguish queuing a follow-up from steering the active run; replacement editing keeps the original visible until the replacement is admitted and preserves unrelated queued prompts. Loom currently has no active-run follow-up queue, so this is a later interaction, not part of the empty-chat shell.

[`Titlebar`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/shell/titlebar/titlebar.tsx) switches at 767 px from a horizontal session strip to a mobile drawer containing current tab, tab list, new session, home, and Settings actions. The desktop strip scrolls a newly selected tab into view; tab strip logic supports horizontal and vertical orientations. Loom already keeps New chat persistent and tabs keyboard-navigable, but its small-window panel overlays and top title tabs remain different; a dedicated narrow-window tab review remains in the general acceptance gate.

[`SettingsNavigation`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/settings/navigation.tsx) uses grouped navigation and vertical tabs, while the mobile titlebar exposes Settings as a drawer action. [`SettingsScreen`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/settings/shell.tsx) focuses the settings root on entry and handles Escape by unwinding nested settings, clearing search, or leaving Settings. The settings model is a typed schema with defaults, versioned persistence key `settings.v3`, migration logic, and tests for migration, invalid fields, and round-tripping ([`settings/model.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/settings/model.tsx), [`model.test.ts`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/settings/model.test.ts)). Loom's Settings has focus trap/restore, Escape dismissal, grouped categories and compact horizontal navigation; its current persistence is preference-by-preference local storage rather than one schema with explicit migrations. These differences are recorded for later settings persistence work; this completes source study, not the broader UI acceptance review.

The pinned source is SolidJS; Loom adapts verified interaction and information architecture in React/TypeScript rather than importing the application implementation. The OpenCode UI study is complete; responsive visual acceptance and any selected follow-up behaviors remain tracked separately.

Electron packaged mode uses the native application menu for File, Edit, View, and Help, avoiding a duplicate HTML menu bar. Auto Save and Save All belong under the native File menu. Browser preview retains a renderer menu for discoverability and testing.

Settings category navigation follows a roving keyboard model: ArrowUp/ArrowDown move between categories vertically, ArrowLeft/ArrowRight move horizontally, Home/End move to the first/last category, and focus and selected content update together. Keyboard navigation scrolls the newly focused category into view, including in the horizontally scrollable compact category row. The dialog traps focus and returns focus to its opener when dismissed.

Open Settings to the **Gateway** provider tab by default so provider setup is immediately actionable. Keep the Account tab available for its preview account information.

The Models category uses the same available model choices and selected value as the composer, so users can set the default from either surface without the controls drifting apart.

At widths up to 640 px, Settings switches to a horizontally scrollable category row above the section content so navigation does not consume a fixed sidebar column. On wider windows, grouped categories remain in the left sidebar.

Repository context exposes branch and `No Git` changes through polite live announcements, including the current branch name in its accessible label. The workspace selector remains a separate button so its interactive behavior is clear.

**Codex reference notes (2026-09-30):** OpenAI's [Codex app introduction](https://openai.com/index/introducing-the-codex-app/) describes a desktop command center that organizes agent threads by project and supports switching between concurrent tasks. Use those interaction ideas when shaping Loom's session navigation; keep a workspace-free chat available as the default entry state, with project association added when a directory is opened. The public [`openai/codex` repository](https://github.com/openai/codex) is the terminal coding agent and does not provide the Codex desktop UI source, so do not treat it as implementation reference for app layout.

**Supplemental OpenCode UI inspection (2026-09-30):** the accessible moving [`dev` NewSessionView](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/components/session/session-new-view.tsx) adds implementation detail beyond the pinned v2 notes: separate compact rows for the project path (Loom workspace path), selected main/worktree branch, and (when present) last-updated time. Its worktree selector distinguishes the main worktree, existing sandboxes, and creating a worktree. This is `dev` evidence only. Loom adapts the centered empty-chat composition and explicit branch context below the composer; it keeps workspaces optional, uses Loom terminology, and defers branch/worktree mutation UI.

The empty-chat composer uses the model as its always-visible primary choice. Keep its initial input to one row and omit the keyboard shortcut helper so the empty-chat composition stays compact; allow the field to grow as the user types. In conversations with messages, retain a two-row minimum and the Enter/Shift+Enter helper. Style the model selector as a rounded, high-contrast control with a clear chevron and keyboard focus ring; preserve its native select behavior. Reasoning effort and approval policy stay available under the **Run options** disclosure, reducing the default controls to the prompt, add action, model, run options, and send button. An unstarted blank chat is transient rather than a RECENT conversation; New chat stays visible and reuses the blank chat. Older stored empty drafts are dropped on load while saved messages and approval history remain.

Keep New chat as a persistent titlebar tab beside saved sessions, including while another session is active. When changing sessions through another control, scroll the selected titlebar tab into view so the active session stays identifiable in an overflowing tab strip. Its unsent prompt draft is isolated from saved-session drafts and restored when returning to New chat; the empty session stays transient until its first message is sent.

## 1. Main window

The selected v1 frontend stack is React + TypeScript hosted by Electron, with Bun for package management and UI development/build/test scripts. Electron provides the desktop shell; React renders the interface. Use reusable, customizable native React and HTML components styled with Tailwind as the single UI system. Components should accept variants, sizing, content, and class overrides so new screens can share existing patterns. Browser preview uses deterministic fixtures; desktop mode uses the versioned Go runtime through typed IPC.

Draggable conversation and explorer panels use accessible native controls. Dragging below the collapse threshold settles into the fixed-width rail; releasing in the narrow range below a panel's minimum width restores that minimum instead of persisting a broken width. Keyboard resizing follows the same minimum and collapse behavior, preserves the last valid width, and allows reopening a collapsed panel from its resize control. Collapsed panels remain fixed-width icon rails, expanded widths and open state persist, and the center keeps a usable minimum width. Below the compact breakpoint, either side panel opens as an overlay while both icon rails stay available; opening one closes the other overlay without losing its saved width. The native directory picker opens a workspace in the supervised Go runtime. The right explorer supports refresh and lazy folder listing; files up to 50 MiB open in editable center tabs beside Chat, and larger files show a clear limit message. Save, Save All, debounced Auto Save, Ctrl/Cmd+S, and dirty-tab discard confirmation are supported. Browser preview edits remain in session memory. Provider settings support OpenAI-compatible base URL/model/API key, desktop stores the key using OS-backed encryption, agent responses stream, and workspace tool calls wait for approval.

Use a chat-first workbench, with the conversation context header showing the selected session and run state. Show **Needs approval** while the active session has a pending user decision, **Running** during other active work, **Run failed** after an unsuccessful run, **Cancelled** after a user-cancelled run, **Ready** when a configured provider is idle, and **Provider not configured** before setup. Show workspace identity and Git state only in the context row directly below the composer, avoiding duplicate workspace metadata in the header. Keep the conversation as the visual center. Workspace and editor surfaces can remain available as secondary panels and tabs, but they do not drive the current milestone. The first session is a workspace-free blank chat: New chat stays visible when the session list is empty or after the last session is deleted, and it reuses the existing blank chat rather than creating duplicate empty rows. Opening a workspace is optional and can happen from the welcome action or explorer controls.

Use a three-area coding workspace as a later IDE arrangement:

```text
┌──────────────────┬─────────────────────────────┬──────────────────┐
│ Threads / recent │ Conversation and run events │ Workspace files  │
│                  │                             │ (right side)     │
│                  │                             │                  │
├──────────────────┴─────────────────────────────┴──────────────────┤
│ Active workspace · model/provider · approval state                  │
└────────────────────────────────────────────────────────────────────┘
```

The workspace explorer belongs on the right in v1. It can be collapsed and resized. Keep **Open workspace** available from the welcome state and explorer controls. The active root is always visible, and an empty state explains how to open one. Search matches file names and workspace-relative paths, including files in folders that are not expanded in the tree; choosing a result opens the file in the editor.

**Open Folder** immediately opens Electron's native directory picker in desktop mode. In browser preview mode it immediately opens the browser's directory chooser. File-name/path search is available in the explorer; file-content indexing/search, OAuth/account identity, model discovery, real diff review, command execution, and terminal remain future work.

## 2. Navigation regions

- **Left sidebar:** conversation list, search, and new conversation. Keep New Chat available in expanded and collapsed navigation, including when no sessions exist. The empty-state action focuses the already-open blank chat; creating another session from a chat with messages starts a fresh blank conversation. Do not add an empty row to RECENT until the first message is sent. Deleting the last session returns to the blank chat with New Chat still available. Each saved chat row is one flex surface containing its title and delete action; hovering or focusing the row reveals delete without giving the title a separate background. Align New Chat and Settings content to the left edge.
- In the conversation list, Up/Down moves between visible sessions and selects the focused session; Home/End selects the first/last visible session. Arrow navigation stops at list boundaries.
- Conversation search trims surrounding whitespace. If there are no matches, show a clear empty-search message and a Clear Search action that restores the full list.
- **Center:** message composer and chronological conversation/run timeline.
- **Right sidebar:** active workspace root, file tree, selected-file preview/open action, and optionally changed-files list.
- Highlight the active editor file in the workspace tree and workspace search results; clear the highlight when Chat is active.
- **Bottom/status area:** provider state, active model, active workspace, and run state.

The desktop restores conversations/messages from local renderer storage and lets users delete conversations after confirmation. An unstarted composer draft does not appear as a session; the first sent message creates a sidebar entry, and deleting the last session returns to the blank chat while keeping New Chat available. Global File, Edit, View, and Help menus sit above all three workbench columns. The file tree starts collapsed at the workspace root; context menus create files/folders, rename items without overwriting an existing path, and delete selected items after confirmation. New-file and new-folder errors stay in their respective creation dialogs and do not create or open duplicate entries; successful file creation opens the new file. Renaming a folder updates paths for its open descendant tabs. Deleting a folder removes descendant editor tabs and returns the work area to Chat when its active file is removed. Explorer search matches file names and paths throughout the workspace and opens selected files in the editor. Open files appear beside Chat only while at least one file is open; the editor shows a line-number gutter. Workspace writes, renames, and deletions remain confined to the selected root. Durable runtime database/transcript storage, language-aware syntax highlighting, file-content indexing/search, real diff review, shell/terminal, Git integration, and plugin execution are not implemented.

When Chat and file tabs are visible, the active tab is the only tab stop in the tab list. Left/Right arrows wrap between tabs, and Home/End move to the first/last tab; keyboard navigation changes focus and the active view together.

Closing an active file returns focus to the Chat tab when other editor tabs remain. Closing the last file returns focus to the message composer after the tab strip disappears.

The workspace file tree uses a single roving tab stop on its semantic tree items. ArrowUp/ArrowDown move across visible entries and stop at the first/last item rather than wrapping; ArrowRight expands a folder or focuses its first child, ArrowLeft collapses a folder or focuses its parent, Enter/Space opens a file or toggles a folder, and Home/End move to the first/last visible entry. Folder expansion remains operable by pointer, and row actions remain available to keyboard users. The explorer context menu focuses its first action when opened, supports Up/Down and Home/End navigation, and Escape closes it and restores focus to the invoking tree item.

Do not overload the right side with both the entire explorer and a large diff view at once. Selecting a changed file may open the diff in the center or a dedicated tab while preserving explorer state.

## 3. Workspace and folder behavior

- **Open Folder** opens the platform directory picker. Desktop mode stores the selected root in the Go runtime and requests directory metadata as the user expands the tree; browser preview loads the selected directory into the current session.
- Opening a new folder sets it as the active workspace; existing conversations retain their original workspace association.
- Display the canonical workspace name/path in workspace controls and the explorer header.
- Allow tree expansion/collapse, file selection, refresh, and opening a file in a center editor tab while keeping Chat available as another tab.
- Keep the workspace root collapsed on open; expand a directory only after the user activates its tree control.
- Search file names and workspace-relative paths across nested folders; selecting a result opens the file without requiring tree expansion.
- Add context-menu actions for New File, New Folder, and Delete. Confirm deletes. Deleting a non-empty folder removes its contents only inside the selected workspace.
- Add Rename for workspace files and folders. Reject path traversal and existing destinations; preserve open editor content and update tab paths when a file or parent folder is renamed.
- Show the Chat tab only while at least one file tab is open. Chat itself cannot be closed; file tabs can be closed individually.
- Provide a New File action in the open workspace explorer. Accept a workspace-relative path, create an empty file without replacing existing content, and open it in a center editor tab.
- Provide Undo and Redo toolbar actions backed by CodeMirror history. Disable them when the active editor has no corresponding history and preserve each file's history while switching tabs. Track unsaved state against each file's last saved content so undoing to that content clears the dirty marker; discarding a dirty tab must remove its session draft and history before the file can be reopened.
- Show failed workspace saves beside the matching editor tab, keep the content dirty, and clear the error after an edit or successful retry. Route the Save button, Ctrl/Cmd+S, Save All, and Auto Save through the same error-handling flow.
- Put the global Auto Save toggle and Save All action in the top-level File menu. Individual tabs retain manual Save. Auto Save is debounced and writes through the workspace-scoped runtime in desktop mode. Keep edits made during an in-flight write marked unsaved; keep unsaved state when a write fails.
- Provide explicit empty, loading, indexing, permission-denied, and unreadable-file states.
- Context menu actions may include copy path, reveal in OS file manager, and add file to agent context.
- Switching workspace does not silently grant access to prior or external roots.

## 4. Conversation timeline

Render each item by type: user message, assistant response, progress/status, tool request, approval card, tool result, diff summary, and error/cancelled run. Tool calls should be inspectable and visibly distinguish proposed, waiting, executing, completed, rejected, failed, and cancelled states.

Keep unsent composer drafts isolated per conversation. Switching sessions restores that session's draft; starting a new session begins with an empty composer, and sending a message clears the sent draft. In an active conversation, follow newly appended messages while the reader is near the latest item; when they scroll up, pause automatic following and offer a **Jump to latest** action. Switching conversations resumes following the selected session's latest message. Show an accessible `Responding…` state while assistant output streams; distinguish failed responses from user-cancelled runs and keep partial output visible when cancelled. Keep tool approval requests and their final user decisions in that conversation's activity history, including the requested tool and arguments, positioned at the point where the request occurred. Wrap approval and review actions when the chat column is narrow so the controls remain visible without horizontal overflow. If a run is cancelled or the app restarts while approval is pending, display the saved request as unavailable rather than leaving stale approval controls active.

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

Settings opens as a modal surface with category navigation. Opening it moves keyboard focus into the dialog; Tab remains within the dialog; Escape closes it and restores focus to the control that opened it.

The Appearance category controls the theme and the visibility of the conversations sidebar and workspace explorer. Panel choices reuse the workbench state and persist across app restarts.

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
