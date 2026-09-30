# Documentation Changelog

All product/architecture/UI decisions that change the v1 baseline should be recorded here. Update the version in `README.md` and affected documents with each entry.

## 1.98.0 — 2026-09-30

- Complete and document the pinned OpenCode v2 UI study for mobile titlebar navigation, timeline follow state, composer queue/steering, grouped Settings, keyboard behavior, and versioned preference migrations.
- Keep broader browser-preview acceptance and active-run queue behavior as separate, still-open UI work.

## 1.97.0 — 2026-09-30

- Record fresh browser-preview verification of New chat with no workspace selected and the grouped Settings surface.
- Preserve the active-chat persistent composer/Git-context dock as a UI-first behavior, validated by renderer tests.

## 1.96.0 — 2026-09-30

- Keep the composer and workspace/Git context in a persistent dock below the independently scrolling active conversation timeline.
- Add regression coverage for the active chat dock order and structure.

## 1.95.0 — 2026-09-30

- Make Settings use compact horizontal category navigation through 900 px, matching the minimum desktop width, while retaining its windowed dialog presentation above 640 px.
- Add a regression check for both the compact navigation and full-screen breakpoints.

## 1.94.0 — 2026-09-30

- Use a native model selector in Settings with the same options and selected value as the chat composer.
- Add regression coverage that selecting the default model in Settings updates the composer.

## 1.93.0 — 2026-09-30

- Allow tool approval and diff review controls to wrap at narrow chat widths rather than overflow.
- Add a regression assertion for the real tool approval action row.

## 1.92.0 — 2026-09-30

- Follow new timeline content while the reader is near the latest message; pause following when they scroll up and expose a Jump to latest action.
- Add regression coverage for following, pausing, and resuming the message timeline.

## 1.91.0 — 2026-09-30

- Keep workspace identity and Git state exclusively in the context row below the composer, removing duplicate workspace metadata from the session header.
- Add UI regression coverage for the header/context separation.

## 1.90.0 — 2026-09-30

- Compact the workspace-free New chat composer to a single initial input row and remove its shortcut helper line, retaining both in active conversations.
- Add focused UI regression coverage for the empty-chat composer.

## 1.89.0 — 2026-09-30

- Show Run failed and Cancelled in the active session context to match the latest run outcome shown in the timeline.
- Add regression coverage for failure and cancellation context states.

## 1.88.0 — 2026-09-30

- Open Settings directly on the Gateway provider configuration tab, the actionable setup path for the current app.
- Keep the Account tab available and add regression coverage for the default provider tab.

## 1.87.0 — 2026-09-30

- Scroll the selected session tab into view when switching conversations through other navigation controls.
- Add regression coverage for active tab visibility in the horizontally overflowing titlebar tab strip.

## 1.86.0 — 2026-09-30

- Restyle the primary composer model selector as a rounded control with a clear chevron and focus indicator while retaining native selection behavior.
- Add a focused UI assertion for the model selector styling hook.

## 1.85.0 — 2026-09-30

- Distinguish an unconfigured provider from a ready chat in the session context header.
- Add regression coverage for the disconnected provider state in the chat view.

## 1.84.0 — 2026-09-30

- Show `Needs approval` in the active session context while a tool approval awaits the user, distinct from `Running` and `Ready`.
- Add regression coverage for the session status during a pending tool approval.

## 1.83.0 — 2026-09-30

- Make Open workspace a filled primary action and Create workspace a secondary outlined action in the empty-chat welcome.
- Give both actions clear hit areas, folder icons, and keyboard focus treatment.
- Add UI regression assertions that both workspace actions use the welcome action style.

## 1.82.0 — 2026-09-30

- Use a general-purpose composer prompt for the workspace-free New chat entry point, welcoming questions and build requests.
- Add a focused assertion for the empty-chat composer prompt.

## 1.81.0 — 2026-09-30

- Keep the newly focused Settings category visible when navigating with the keyboard, including in the compact horizontal category row.
- Add focused regression coverage for category visibility after keyboard navigation.

## 1.80.0 — 2026-09-30

- Keep New chat visible as a titlebar tab beside saved sessions, not only while it is the active view.
- Preserve its unsent draft while switching to saved chats, and restore the draft when returning to New chat.
- Add regression coverage for New chat tab visibility and draft restoration.

## 1.79.0 — 2026-09-30

- Expose the current Git branch and `No Git` state as polite live announcements in the chat context row.
- Keep workspace selection separately identified as an interactive button and add assertions for both repository states.

## 1.78.0 — 2026-09-30

- Reflow Settings navigation into a horizontally scrollable category row at compact widths to give section content more space.
- Keep grouped sidebar navigation on wide windows and record the responsive behavior in the UI specification.

## 1.77.0 — 2026-09-30

- Add roving keyboard navigation across Settings categories using ArrowUp/ArrowDown and Home/End.
- Synchronize Settings category focus and selected content, and cover navigation with a focused UI regression test.

## 1.76.0 — 2026-09-30

- Add OpenCode-style session tabs to the titlebar and synchronize active chat title, transcript, and context when switching.
- Keep New chat as a transient tab without persisting an empty conversation, and support keyboard tab navigation.
- Add regression coverage for saved-session switching and the empty New chat state.

## 1.75.0 — 2026-09-30

- Make the workspace chip below the composer open the workspace picker for switching context during an active chat.
- Keep the Git/branch chip read-only and retain the existing no-workspace and `No Git` states.
- Cover the chat-context workspace picker path with a UI regression test.

## 1.74.0 — 2026-09-30

- Make Appearance settings control persisted visibility for the conversations sidebar and workspace explorer as well as the theme.
- Correct Tailwind layer order so shared button variants and utility styles are not overridden by the global button reset.
- Add UI coverage for saved panel preferences and appearance action styling.

## 1.73.0 — 2026-09-30

- Add a distinct Create workspace flow from the welcome surface and File menu, with workspace name and parent-directory selection.
- Create the new root via the Go runtime's `os.Root` boundary, reject invalid/portable-reserved names and existing destinations, then activate the new empty workspace.
- Add UI, bridge, workspace-domain, and protocol regression coverage; keep browser preview honest about the desktop-only creation operation.

## 1.72.0 — 2026-09-30

- Style the empty-chat Open workspace action as a distinct folder button with visible keyboard focus and hover states.
- Add a focused UI regression assertion for the folder icon on the welcome action.

## 1.71.0 — 2026-09-30

- Record that the current workspace picker only opens an existing directory and add a distinct Create workspace flow to the active UI deliverables.
- Require explicit destination/name design and a scoped, tested directory-creation boundary for the future flow.
- Confirm the existing package scripts already provide native Windows and macOS packaging; Docker is not a substitute for native macOS packaging.

## 1.70.0 — 2026-09-30

- Align product documentation with Loom's workspace terminology while clarifying that OpenCode's reference UI names the equivalent concept project.
- Keep upstream terminology only when describing the source implementation; use workspace for Loom UI and user workflows.

## 1.69.0 — 2026-09-30

- Clarify the empty-chat welcome that chatting can begin without a workspace and name the action `Open workspace`.
- Replace the remaining user-facing “project context” wording with workspace context and add a focused regression test.

## 1.68.0 — 2026-09-30

- Record source-verified OpenCode v2 patterns for timeline follow/pin behavior, composer queue/steering, and persisted settings.
- Refine the Settings surface with clearer sizing, grouped navigation hierarchy, selected/focus states, and denser account details; verify viewport fit at 600 px and 390 px.
- Preserve the chat-first focus and defer timeline/composer runtime behavior beyond the current UI shell milestone.

## 1.67.0 — 2026-09-30

- Collapse the workspace explorer on fresh installs so the chat canvas gets more width, while preserving saved panel preferences and workspace entry actions.
- Add a regression test for the workspace-free, no-saved-session first-run layout.

## 1.66.0 — 2026-09-30

- Match OpenCode's repository context icon semantics: use a monitor for `No Git` and a branch icon only when showing branch state.
- Add regression coverage for both non-Git and active-branch icon states.

## 1.65.0 — 2026-09-30

- Add concrete OpenCode v2 findings for workspace/branch selection, session titlebar tabs, and settings navigation from a pinned source revision.
- Record the UI study items still open: timeline/run behavior, keyboard and small-screen interactions, and settings persistence.
- Align the IDE roadmap documentation version with the product plan and UI specification.

## 1.64.0 — 2026-09-30

- Pin the verified OpenCode v2 UI reference to commit `4deda180370c3038877b0c35befb2e4a08cd3e31` and correct the source paths to this snapshot's `packages/app/src/new-session` structure.
- Record that OpenCode places project/workspace and Git status directly below the new-chat composer and labels a selected non-Git project `No Git`.
- Correct the earlier 404 claim, which came from probing stale paths that do not match the v2 tree.

## 1.63.0 — 2026-09-30

- Center the empty-chat brand mark, heading, compact composer, and workspace/Git context as one layout.
- Keep model selection visible and move reasoning/approval controls under a Run options disclosure.
- Make blank chats transient, keep New chat visible, and remove legacy empty drafts when restoring conversation history.
- Record verified OpenCode `dev` NewSessionView patterns as supplemental UI evidence, separate from unverified v2 behavior.

## 1.62.0 — 2026-09-30

- Expand the plan into UI-first acceptance, a versioned OpenCode UI study, a concrete post-UI harness compatibility map, and Go/runtime follow-on slices.
- Keep new chats workspace-free by default and explicitly permit refactoring or removing existing UI code when the accepted chat design requires it.
- Keep the desktop build gate after complete browser UI acceptance; defer transport changes until a separate evidence-backed IPC decision.

## 1.61.0 — 2026-09-30

- Set the immediate product priority to chat-frame and workspace/session entry-point polish; defer runtime/harness parity work.
- Define workspaces as optional in the welcome state and keep workspace/Git context below the composer.
- Record Codex desktop as a UI study reference while clarifying that the public `openai/codex` repository contains the terminal agent, not the desktop UI source.
- Rename the empty explorer action to `Open workspace` and cover both welcome and explorer entry points in UI tests.

## 1.60.0 — 2026-09-30

- Specify independent no-workspace and no-Git status labels and hide their separator when no workspace is selected.
- Add regression coverage that retains the separator once a workspace repository is open.

## 1.59.0 — 2026-09-30

- Record independently verified supplemental OpenCode `dev` references for the empty-session view, session component boundary, and v2 session lifecycle contract.
- Keep the v2-specific UI study open pending review of a pinned source snapshot.
- Correct the historical roadmap checklist so it no longer claims New chat is hidden in the collapsed rail.
- Align the current UI specification with the implemented empty-session New chat behavior.
- Record browser-preview inspection of empty chat, `No Git`, and compact Settings/Permissions navigation at 760 px.
- Allow workspace/Git context chips below the composer to wrap on narrow chat layouts.
- Omit the workspace/Git separator when no workspace is open so the initial status reads as two independent states.

## 1.58.0 — 2026-09-30

- Keep New chat visible in the full conversation sidebar and collapsed rail even when no sessions exist.
- Make New chat focus the existing blank chat on an empty session list and create a fresh session only from a conversation with messages.
- Add UI regression coverage for the empty session list and last-session deletion states.

## 1.57.0 — 2026-09-30

- Invalidate and persist pending approval requests when their agent run is cancelled.
- Add regression coverage ensuring cancelled runs cannot leave an active approval control in chat.

## 1.56.0 — 2026-09-30

- Anchor approval activity to the message count where each request occurred so later conversation turns render after it.
- Render live approval controls at the activity's timeline position and preserve legacy history safely.
- Add integration coverage asserting chronological approval history across follow-up messages.

## 1.55.0 — 2026-09-30

- Add keyboard navigation for chat sessions using Up/Down and Home/End, selecting the active conversation while preserving list-boundary behavior.
- Add focused UI behavior coverage and document the interaction in the session roadmap.

## 1.54.0 — 2026-09-30

- Record that the initial OpenCode v2 source paths were unavailable and keep the v2 study item open pending identification of the correct tree layout.
- Treat the accessible moving `dev` branch as supplemental reference only; do not conflate it with v2.

## 1.53.0 — 2026-09-30

- Mark locally restored approval requests unavailable when their runtime run was interrupted by an app restart.
- Add storage regression coverage so an old pending request is never shown as a live approval action.

## 1.52.0 — 2026-09-30

- Keep tool approval requests, exact requested arguments, and the user's final decision in that conversation's activity history.
- Persist and validate tool approval history alongside the conversation; add regression coverage for decisions and malformed saved data.

## 1.51.0 — 2026-09-30

- Announce streamed assistant response state in the timeline and distinguish cancelled runs from errors while preserving partial output.
- Ignore late stream events after cancellation so a completed stream cannot erase the cancelled state.
- Add behavior coverage for streaming and cancellation presentation.

## 1.50.0 — 2026-09-30

- Show `Branch unavailable` when the selected workspace is a Git repository but the runtime cannot resolve its branch; do not mislabel this case as detached HEAD.
- Add regression coverage for linked-worktree branch metadata that is unavailable within the selected workspace boundary.

## 1.49.0 — 2026-09-30

- Keep unsent chat composer drafts scoped to their conversation; switching sessions restores the right draft, while a new session starts clear.
- Add focused UI coverage for draft isolation across session switching and document the interaction in the UI and chat roadmap.

## 1.48.0 — 2026-09-30

Make the Settings surface keyboard-dismissible with predictable focus restoration.

- Move focus into Settings on open, trap Tab within the modal, and restore focus to its opener on Escape or close.
- Add a focused UI behavior test and update the active chat/settings roadmap.

## 1.47.0 — 2026-09-30

Record the IPC trade-off assessment and align the delivery plan with chat-first acceptance.

- Keep the existing supervised JSON Lines over stdio unchanged while UI/UX is the priority; document framing/correlation safeguards and when authenticated loopback HTTP could be reconsidered.
- Make chat/settings UX the active plan phase, keep Go harness slices explicitly informed by OpenCode v2, and defer IDE/LSP expansion.
- Add root-level Windows/macOS package aliases and document native Electron menus with Auto Save under File.

## 1.46.0 — 2026-09-30

Show Git context under chat and use the native desktop application menu.

- Place workspace and Git status below the composer; expose read-only current branch status from the runtime and show `No Git` for a non-repository workspace.
- Use native Electron File/Edit/View/Help menus in desktop mode, retain the renderer menu for browser preview, and keep Auto Save under File.
- Add the UI/menu and Git status requirements to the active roadmap.

## 1.45.0 — 2026-09-30

Prioritize OpenCode-informed chat/settings UX and harness study before IDE/LSP expansion.

- Make chat/session context, workspace and branch status, run timeline, and structured settings the active UI priority.
- Add a staged harness study and Go implementation roadmap referencing OpenCode v2 session, agent, tool, permission, provider, and protocol sources.
- Move editor/LSP expansion to a later milestone; retain native Windows/macOS desktop package commands and defer desktop builds until chat/settings UI acceptance.

## 1.44.0 — 2026-09-30

Verify panel sizing and collapsed state persistence across app mounts.

- Add an app behavior test that resizes and collapses both side panels, remounts the app, and verifies the collapsed state and remembered conversation-panel width.
- Mark the panel persistence checklist item complete after verifying compact layouts in browser preview.

## 1.43.0 — 2026-09-30

Keep the empty conversation sidebar free of a disabled New Chat action.

- Hide New chat from the collapsed conversation rail while no conversations exist.
- Keep New chat available in the rail once a conversation exists.
- Add behavior tests for both collapsed-rail states.

## 1.42.0 — 2026-09-30

Keep workspace folder creation errors visible and prevent duplicate entries.

- Reject empty or already-existing folder paths before calling the workspace bridge.
- Keep the create-folder dialog open and show the error beside its path field.
- Add an app behavior test for duplicate folder creation.

## 1.41.0 — 2026-09-30

Keep editor state consistent after deleting a workspace folder.

- Close open editor tabs and cached editor state for every descendant of a deleted folder.
- Return the work area to Chat if the active editor file was removed.
- Add an app behavior test for deleting a folder containing the active editor file.

## 1.40.0 — 2026-09-30

Verify and surface workspace refresh failures.

- Add an app behavior test proving a failed root refresh appears as an accessible explorer alert.

## 1.39.0 — 2026-09-30

Make workspace explorer context actions keyboard accessible.

- Focus the first action when the menu opens and support ArrowUp/ArrowDown, Home/End, and Escape.
- Restore focus to the invoking tree item only on Escape, keeping action-driven dialogs in control of focus.
- Add an app behavior test for focus entry, navigation, dismissal, and restoration.

## 1.38.0 — 2026-09-30

Polish conversation rows and the empty sidebar state.

- Keep the title and hover-revealed delete action in a single flex row with shared hover surface.
- Hide the RECENT label when no conversations exist and align New Chat and Settings to the sidebar's left edge.
- Add app behavior assertions for row layout and empty-state visibility.

## 1.37.0 — 2026-09-30

Keep workspace tree keyboard navigation inside its visible boundaries.

- Stop ArrowUp/ArrowDown at the first and last visible tree items instead of wrapping to the opposite end.
- Add app behavior assertions for both navigation boundaries.

## 1.36.0 — 2026-09-30

Align workspace tree semantics with its keyboard navigation.

- Make each file/folder tree item the focusable navigation target and nest expanded groups within their parent item.
- Support Enter/Space activation and expose expansion state on the focused tree item.
- Add a visible focus ring and app behavior coverage for tree focus, expansion, navigation, and file opening.

## 1.35.0 — 2026-09-30

Keep keyboard focus in the workbench when closing editor tabs.

- Return focus to Chat after closing the active file when other tabs remain.
- Return focus to the message composer when closing the last file removes the tab strip.
- Add app behavior coverage for both focus destinations.

## 1.34.0 — 2026-09-30

Make workspace tree navigation usable from the keyboard.

- Add roving focus and arrow-key navigation across visible tree entries.
- Expand/collapse folders and move focus between parent folders and their visible children.
- Add app behavior coverage for tree navigation and folder expansion.

## 1.33.0 — 2026-09-30

Make the open Chat and editor tab strip keyboard navigable.

- Keep only the selected view in the tab order and support wrapping ArrowLeft/ArrowRight plus Home/End navigation.
- Move focus and activate the corresponding Chat or file view together.
- Add app behavior coverage for tab switching and boundary keys.

## 1.32.0 — 2026-09-30

Keep keyboard panel resize and restore usable.

- Preserve a valid expanded width when keyboard resizing collapses either side panel.
- Allow the collapsed panel's resize control to restore the saved width from the keyboard.
- Add app behavior coverage for collapsing and reopening both side panels by keyboard and button.

## 1.31.0 — 2026-09-30

Keep panel widths valid when resizing by drag.

- Snap a drag release below 72 px to the 48 px rail; releases in the panel's narrow invalid range settle to its minimum width.
- Preserve the last valid expanded width through collapse and restore.
- Add regression coverage for left and right panel settling.

## 1.30.0 — 2026-09-30

Make editor history and unsaved state behave like a desktop IDE.

- Add accessible Undo/Redo controls backed by CodeMirror history, preserve per-file history across tab switches, and disable controls when no action is available.
- Compare editor contents with each file's saved baseline so undoing to saved content clears the dirty state.
- Clear session drafts when changes are discarded; add behavior coverage for undo/redo and reopening discarded files.

## 1.29.0 — 2026-09-30

Keep the active editor file visible in workspace navigation.

- Highlight the active file in the explorer tree and search results, clearing the selection when Chat is active.
- Add a behavior assertion that an opened file is marked as the current page.

## 1.28.0 — 2026-09-30

Keep workspace save failures with the editor action.

- Show save errors beside the matching editor tab and retain dirty state after a failed write.
- Route Ctrl/Cmd+S through the shared workspace save flow; clear the message after edits or a successful retry.
- Add a user-visible behavior test for failed saves and retry success.

## 1.27.0 — 2026-09-30

Keep file-creation errors visible with the action that failed.

- Show runtime and validation errors inside the new-file dialog, associated with the path input.
- Keep the dialog open and avoid adding an editor tab when file creation fails.
- Add app behavior coverage for a workspace API creation failure.

## 1.26.0 — 2026-09-30

Clarify empty conversation-search results.

- Trim surrounding whitespace before filtering conversations.
- Show an accessible no-results message and a Clear Search button that restores the full list.
- Add behavior coverage for whitespace-only queries and clearing a no-match query.

## 1.25.0 — 2026-09-30

Make the active conversation row's delete action discoverable on hover.

- Reveal the in-row delete control for active and inactive conversations on hover or keyboard focus.
- Add a user-visible behavior assertion for the active row.

## 1.24.0 — 2026-09-30

Keep unstarted drafts out of the conversation list.

- Start with an empty session list while keeping the welcome composer ready for the first prompt.
- Create a session when the first message is sent; deleting the last session restores the empty list.
- Add app behavior coverage for first-session creation and deleting the final session.

## 1.23.0 — 2026-09-30

Add workspace-scoped file and folder rename.

- Add Rename to explorer context menus and validate names before changing files.
- Route rename through the versioned Electron IPC and Go workspace runtime; reject paths outside the selected root and existing destinations.
- Keep open files, editor contents, active tabs, and descendant paths connected after a rename.
- Add app behavior coverage for file and folder rename plus a Go protocol integration case for collisions and workspace boundaries.

## 1.22.0 — 2026-09-30

Make both side panels usable in compact windows.

- Keep conversation and workspace rails visible below the compact breakpoint.
- Open one panel at a time as an overlay; switching panels closes the previous overlay and keeps its saved width.
- Verify left/right panel switching in the browser at 760 px and cover the interaction in an app behavior test.

## 1.21.0 — 2026-09-29

Add workspace-wide file-name and path search to the explorer.

- Search recursively through workspace-scoped directory listings, with bounds on scanned folders and entries.
- Show matching file paths independently of tree expansion and open the selected file in the editor.
- Add a desktop behavior regression test for nested search results and editor navigation.
- Clarify that file-content indexing/search remains future work.

## 1.20.0 — 2026-09-29

Set a single Tailwind-based UI direction and expanded the desktop product goal toward a local IDE.

- Added an IDE and workbench checklist covering the UI foundation, workspace explorer, editor, and agent workflow.
- Replaced Ant Design as the component-library decision with accessible native React/HTML controls styled by Tailwind.
- Require shared UI components to expose customization points so product screens can reuse patterns without duplicating Tailwind styles.
- Set Codex as the primary workbench reference and VS Code as the editor/explorer reference; code suggestions and Git integration remain out of scope.

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
