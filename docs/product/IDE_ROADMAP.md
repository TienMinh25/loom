# Chat Workbench and Later IDE Roadmap

**Docs version:** 1.98.0
**Last updated:** 2026-09-30

This roadmap tracks Loom's chat-first coding-agent experience and the later IDE phase. OpenCode v2 and Codex desktop are UI references for chat/session, workspace context, and settings; the public Codex source repository covers its terminal agent, not the desktop UI. Runtime/harness parity work is deferred while the chat frame is polished. VS Code is only the later editor/LSP reference. Code suggestions and Git integration are out of scope.

Development process reference: [obra/superpowers](https://github.com/obra/superpowers) for brainstorming, writing implementation plans, TDD, systematic debugging, and verification. It is not installed as a session skill; repository rules remain authoritative, including serial UI-first work and deferring desktop builds until acceptance.

## Active priority — chat frame and settings

- [x] Make workspace selection optional, retain an obvious Open workspace action, and keep workspace/Git status below the composer.
- [x] Clarify the empty-chat prompt: start chatting without a workspace or select **Open workspace** to add workspace context.
- [x] Use a general-purpose composer prompt on the workspace-free New chat screen.
- [x] Provide distinct **Open workspace** and **Create workspace** actions; creation asks for a workspace name and parent directory, then opens a newly created empty folder.
- [x] Style the welcome workspace actions as distinct primary and secondary buttons with visible focus states.
- [x] Center the empty-chat brand mark, welcome heading, compact composer, and repository context as one composition.
- [x] Keep model selection in the compact composer and disclose reasoning/approval settings under Run options.
- [x] Give the primary model selector a rounded chip treatment, chevron, and visible keyboard focus state.
- [x] Keep the empty-chat composer compact with a one-row initial input and no keyboard helper line; preserve the two-row minimum and helper in active conversations.
- [x] Keep unstarted chats out of RECENT and discard legacy empty drafts on load while retaining New chat in the sidebar.
- [x] Collapse the workspace explorer on a fresh install to prioritize chat width while leaving workspace actions available and preserving explicit saved panel preferences.
- [ ] Review and polish the chat canvas/composer and Settings against verified OpenCode and Codex desktop patterns. Keep this UI-only; do not build desktop before the acceptance review.
- [x] Complete the OpenCode v2 UI study at pinned commit `4deda180370c3038877b0c35befb2e4a08cd3e31`: document verified new-session, timeline follow, queue/steering, mobile titlebar drawer, grouped Settings, Escape/focus, typed versioned settings persistence/migrations, and Loom-specific differences in UI.md.
- [x] Keep the conversation title and run status in the header, with workspace and Git context only below the composer to avoid duplication.
  - [x] Distinguish a session waiting for user approval from other running work in its context header.
- [x] Keep the active conversation timeline scrollable above a persistent composer and workspace/Git context dock.
- [x] Confirm the persistent New chat entry point and grouped Settings surface in a fresh browser preview with no workspace selected.
- [x] Place workspace and Git context chips directly below the composer; show `No Git` when the selected root is not a repository and show the active branch when it is.
  - [x] Announce current branch and `No Git` context as status messages for assistive technology.
  - [x] Open the workspace picker from the workspace chip so users can switch workspaces without returning to the welcome state.
  - [x] Allow the workspace/Git context row to wrap on narrow chat layouts.
  - [x] Hide the workspace/Git separator until a workspace has been opened.
- [x] Label repository state `Branch unavailable` when Git is detected but branch metadata cannot be resolved.
- [x] Add session tabs/navigation behavior to the chat shell and keep title/context in sync when switching sessions.
  - [x] Show saved chats as titlebar tabs and keep New chat permanently available as a transient tab until the first message is sent.
  - [x] Support Left/Right/Home/End tab navigation and synchronize the active conversation.
  - [x] Scroll the active titlebar tab into view when the selected conversation changes.
  - [x] Preserve an unsent New chat draft while switching to saved sessions and restore it when returning to New chat.
  - [x] Keep New chat available from the empty session list in both expanded and collapsed navigation.
  - [x] Add keyboard Up/Down/Home/End navigation to the session list and synchronize the active conversation.
- [x] Keep unsent composer drafts isolated by session and restore them when switching back.
- [ ] Model timeline items as user/assistant messages, run progress, tool calls, approvals, results, cancellation, and errors with clear states and keyboard access.
  - [x] Follow new conversation output while near the latest message, pause when the reader scrolls up, and offer a keyboard-accessible Jump to latest action.
  - [x] Let approval and review action buttons wrap in narrow chat columns.
  - [x] Announce assistant streaming and keep cancelled runs distinct from failures in both the timeline and session context, preserving partial output.
  - [x] Preserve tool approval details and the final decision in the matching conversation.
  - [x] Keep approval activity in chronological order relative to subsequent conversation turns.
  - [x] Mark restored pending approvals unavailable after the app restarts.
  - [x] Invalidate pending approval controls when the user cancels their run.
- [x] Replace the settings drawer with a navigable settings surface modeled on OpenCode's information architecture: provider, model, appearance, keybinds, permissions, extensions, and about; mark unavailable capabilities honestly.
- [x] Open Settings on the Gateway provider configuration tab by default while retaining the Account tab.
- [x] Keep the Models category selector synchronized with the model selector in the composer.
- [x] Let Appearance settings toggle and persist conversation-sidebar and workspace-explorer visibility alongside the theme.
- [x] Keep keyboard focus inside Settings; focus the dialog on open, close on Escape, and return focus to the opening control.
- [x] Navigate Settings categories with ArrowUp/ArrowDown and Home/End while synchronizing keyboard focus with the selected section.
- [x] Scroll a keyboard-focused Settings category into view, including in the compact horizontal category row.
- [x] Give Settings a horizontal, scrollable category row at compact widths while retaining grouped sidebar navigation on wide windows.
- [x] Activate compact Settings navigation through the desktop's 900 px minimum window width while keeping the dialog windowed above 640 px.
- [x] Show open chats as titlebar tabs with an add-chat action, and keep the active title and session context synchronized when switching.
- [x] In packaged desktop mode, use Electron's native File/Edit/View/Help application menu and remove the duplicate renderer menu bar; keep Auto Save under native File. Keep a renderer menu only for browser preview.
- [ ] Validate chat/settings empty, loading, disconnected, running, pending-approval, failure, and narrow-window states in browser preview.
  - [x] Show `Provider not configured` in the chat context before provider setup instead of labeling the chat `Ready`.
  - [x] Cover New chat presence with no conversations and after deleting the last session in UI tests.
  - [x] Inspect empty chat and `No Git` context in browser preview at the 760 px compact layout.
  - [x] Inspect the workspace-free New chat composition, composer, persistent session tabs, and `No Git` context at 600 px and 390 px browser widths.
  - [x] Open Settings at the compact layout and verify category navigation and Permissions policy controls.
  - [x] Verify compact Settings navigation at the minimum supported desktop window width and retain a centered dialog presentation.
- [ ] Keep desktop packaging/build deferred until chat/settings acceptance criteria are complete.

## Harness extension roadmap

- [ ] Study the OpenCode harness after chat/settings UI acceptance; record source revision and map sessions/events, providers/models, agent loop/context, tools/schema, permissions/effects, cancellation, persistence/replay/compaction, plugins/capabilities, and observability to adopt/adapt/defer decisions in a compatibility matrix.
- [ ] Add exact OpenCode source/spec references and Loom contract/test implications to each matrix row; preserve MIT notices before any code reuse.
- [ ] Create an OpenCode-to-Loom harness study matrix covering session/message lifecycle, event protocol/replay, model/provider ports, agent loop, context assembly, tools/schema validation, permission requests, cancellation, persistence/resume, and plugin capabilities.
- [ ] Implement the run/session event contract and replay semantics before adding more renderer-only run states.
- [ ] Add provider-neutral model invocation and bounded tool-loop behavior behind Go ports; retain OpenAI-compatible provider as the first adapter.
- [ ] Add declared tool capabilities/effects, workspace scope enforcement, exact-action approval, cancellation/timeouts, and auditable results.
- [ ] Add conversation event persistence/resume, then context/search/compaction/diagnostics after stable contracts.
- [ ] Add a contract test for each UI/runtime vertical slice using fakes/local stubs only.

## Later IDE and LSP

- [ ] Resume IDE/editor polish only after chat/settings and harness milestones are accepted.
- [ ] Add LSP lifecycle, diagnostics, navigation, and code actions as a separate milestone with VS Code LSP and OpenCode LSP references.
- [ ] Keep the existing editor/workspace implementation available where useful, but do not prioritize new IDE features over the active chat milestones.

## UI foundation

- [x] Use one visual system across the desktop UI; remove Ant Design and use reusable, customizable React/HTML components styled with Tailwind.
- [x] Keep the conversation title and hover-revealed delete control inside one flex row and hide empty recent-session chrome.
  - [x] Keep New chat available in the collapsed sidebar rail when no conversations exist.
- [x] Give conversation search a no-results state and a one-click way to clear the filter.
- [ ] Align spacing, typography, surfaces, focus states, motion, and light/dark themes across panels.
- [ ] Verify keyboard, pointer, narrow-window, and screen-reader behavior.
  - [x] Reveal the delete action inside both active and inactive conversation rows on hover or keyboard focus.
  - [x] Keep both side-panel rails reachable in compact layouts and open either panel as an overlay; verify switching between them in a browser at 760 px.
- [ ] Inspect the app in Electron at common window sizes and themes.

## Workspace and file navigation

- [ ] Make explorer hierarchy, selection, expansion, context actions, and loading states predictable.
  - [x] Highlight the active editor file in both the tree and search results.
  - [x] Reset folder expansion/loading state when the workspace root changes.
  - [x] Ignore late directory results after switching roots and release the new root's loading state.
  - [x] Navigate visible files and folders with arrow keys, expanding/collapsing folders and returning focus to parents.
  - [x] Give tree items semantic focus, properly nested groups, and a visible focus indicator.
  - [x] Keep Up/Down navigation within the visible tree boundaries without wrapping.
  - [x] Focus the first context action on open and support keyboard navigation, Escape dismissal, and focus restoration.
- [x] Add workspace-wide file-name/path search and filtering, including nested folders not expanded in the tree.
- [ ] Add create, rename, delete, refresh, and open workflows with clear confirmation and error states.
  - [x] Keep new-file creation errors in the dialog and open a tab only after successful creation.
  - [x] Keep new-folder validation and duplicate-path errors in the dialog without creating duplicate explorer entries.
  - [x] Rename files and folders from the explorer while preserving open tabs; reject an existing destination.
  - [x] Surface root refresh failures in the explorer with an accessible error alert.
  - [x] Close descendant editor tabs and return to Chat after deleting their parent folder.
- [x] Persist panel widths and collapsed state without breaking narrow layouts.
  - [x] Settle drag releases to the fixed rail or a valid minimum width, preserving the remembered expanded width.
  - [x] Keep keyboard resize collapse/restore behavior consistent for both rails and preserve the last valid width.

## Editor

- [x] Replace the plain textarea with CodeMirror and language-aware syntax highlighting for JavaScript, TypeScript, JSON, HTML, CSS, Python, and Markdown.
- [x] Support multiple tabs, dirty indicators, safe close, breadcrumbs, line numbers, and long lines.
  - [x] Keep the existing multi-tab, dirty indicator, safe-close, breadcrumb, and line-number workflows on the CodeMirror editor.
  - [x] Make the Chat/file tab strip keyboard navigable with roving focus, arrow keys, and Home/End.
  - [x] Restore focus to Chat or the composer after closing active/last editor tabs.
- [x] Add find/replace, go to line, indentation, wrapping, and keyboard shortcuts.
  - [x] Find next, replace next/all, go to line, Tab indentation, line wrapping, and Ctrl/Cmd+F / Ctrl/Cmd+G.
  - [x] Provide per-file Undo/Redo buttons and keyboard shortcuts, preserving history across tab switches; keep dirty state aligned with saved content and clear discarded drafts and history.
- [x] Preserve save behavior, file size limits, and explicit dirty/autosave state.
  - [x] Keep failed save errors beside the matching editor tab, retain dirty state, and clear the error on edit or successful retry.
- [x] Keep code completion, generated suggestions, and Git integration out of scope.

## Agent workbench

- [ ] Make conversation, workspace, open files, model, and run state feel like one workbench.
- [ ] Improve approval, tool activity, errors, cancellation, and file-change review states.
- [ ] Navigate between agent activity and affected files without losing editor state.
- [ ] Keep actions scoped and explicit; show exact files and effects before approval.

## Delivery gates

- [ ] Add a focused user-visible behavior or end-to-end test before each behavior change.
- [ ] Run focused and full UI behavior tests, lint, format check, and available desktop build.
- [ ] Check light/dark themes, collapsed/expanded panels, and narrow/wide windows.
- [ ] Keep this checklist current; do not mark the IDE complete while required items remain unchecked.
