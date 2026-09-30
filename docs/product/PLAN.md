# V1 Delivery Plan

**Docs version:** 1.74.0
**Product target:** v1.0  
**Status:** Proposed implementation sequence  
**Last updated:** 2026-09-30

## Goal

Build a chat-first desktop coding-agent harness with Electron, React, TypeScript, and Bun, with a Go 1.26.0 local runtime. The first live model path is OpenAI-compatible. The active priority is conversation/session UX, run visibility, provider/model settings, tool approvals, and a portable harness; full IDE editing and LSP work follows after the chat experience is solid.

The active chat-first and later IDE outcomes are tracked in [IDE_ROADMAP.md](IDE_ROADMAP.md). For the empty-chat surface, keep workspace and Git context directly below the composer: show the selected branch with a branch icon, or `No Git` with a neutral monitor icon for a non-Git directory; with no workspace, show `No workspace open` and `No Git` independently. OpenCode v2 and the Codex desktop experience are UI references for chat/session UX; Loom retains its React UI and versioned boundaries. The public OpenAI `codex` repository is the terminal agent, not the proprietary Codex desktop app's source, so use it for agent concepts rather than desktop UI implementation. Harness/runtime parity is deferred while the current work focuses on making the desktop chat frame and workspace/session entry points feel finished. Superpowers was requested as an implementation-planning reference for TDD and verification, but is not available as an installed skill in this session; repository-specific rules remain authoritative. Code suggestions and Git integration remain outside the current v1 scope.

## Delivery principles

- Follow TDD for every behavior: failing test first, minimal implementation, refactor, then broader verification.
- Keep Go domain/orchestration code independent from adapters and use injected interfaces at real substitution/test boundaries.
- Build UI workflows against a typed mock runtime client before Go runtime capabilities exist.
- Replace mock capabilities with real Go-backed vertical slices progressively; keep React components independent from transport details.
- Keep the UI/runtime protocol versioned and contract-tested.
- Keep Electron-to-Go IPC on supervised, versioned JSON Lines over stdio for the single owned child process; test framing, correlation, synchronized writes and process failure. Reconsider authenticated loopback HTTP only if multiple clients, remote control, or runtime reattachment becomes a requirement; rationale is in [Architecture](ARCHITECTURE.md).
- No automated test depends on a real gateway, credentials, or external service.
- Defer a general plugin marketplace until gateway, tool, and approval seams have proven stable.
- Use OpenCode v2 as a required study/reference source for session navigation, branch/worktree context, composer and run timeline, settings information architecture, agent loop, tools, permissions, and persistence. Reimplement selected behavior in Loom's UI and Go; do not couple to OpenCode internals or copy its SolidJS application.
- Use [obra/superpowers](https://github.com/obra/superpowers) as a development-process reference: brainstorming/design, bite-sized implementation plans, RED-GREEN-REFACTOR, systematic debugging, and evidence-based verification. Keep the repository's explicit TDD and no-desktop-build gates authoritative; use delegated or parallel workflows only when requested or allowed by active instructions.
- Ship and review the browser/UI experience before desktop packaging. Do not run desktop/package builds until chat and settings UI acceptance criteria are complete; retain explicit Windows and macOS package commands for the later delivery gate.

## OpenCode v2 study guide and extension roadmap

Use the upstream [`v2` branch](https://github.com/anomalyco/opencode/tree/v2) as the reference snapshot and check the sources again when starting each extension phase because this branch evolves. Primary code/document references:

- Desktop shell and app composition: [`packages/desktop`](https://github.com/anomalyco/opencode/tree/v2/packages/desktop) and [`packages/app`](https://github.com/anomalyco/opencode/tree/v2/packages/app).
- Chat/session, message timeline, composer and session titlebar: [`packages/app/src/session`](https://github.com/anomalyco/opencode/tree/v2/packages/app/src/session), [`packages/app/src/composer`](https://github.com/anomalyco/opencode/tree/v2/packages/app/src/composer), and [`packages/app/src/shell/titlebar`](https://github.com/anomalyco/opencode/tree/v2/packages/app/src/shell/titlebar).
- New-session view and workspace/Git status: [`packages/app/src/new-session/view.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/new-session/view.tsx), [`packages/app/src/new-session/wordmark.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/new-session/wordmark.tsx), and [`packages/app/src/new-session/workspace/selector.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/new-session/workspace/selector.tsx).
- Settings patterns: [`packages/app/src/settings/shell.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/settings/shell.tsx) and [`packages/app/src/settings/navigation.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/settings/navigation.tsx).
- Harness and agent runtime: [`packages/opencode/src/session`](https://github.com/anomalyco/opencode/tree/v2/packages/opencode/src/session), [`packages/opencode/src/agent`](https://github.com/anomalyco/opencode/tree/v2/packages/opencode/src/agent), [`packages/opencode/src/tool`](https://github.com/anomalyco/opencode/tree/v2/packages/opencode/src/tool), [`packages/opencode/src/permission`](https://github.com/anomalyco/opencode/tree/v2/packages/opencode/src/permission), [`packages/opencode/src/provider`](https://github.com/anomalyco/opencode/tree/v2/packages/opencode/src/provider), and [`specs/v2`](https://github.com/anomalyco/opencode/tree/v2/specs/v2).
- Upstream project is MIT licensed; preserve required notices and review current license/attribution obligations before copying any substantial code. The intended use is primarily behavioral/architectural study and independent Go implementation.
- **Verified v2 snapshot (2026-09-30, `4deda180370c3038877b0c35befb2e4a08cd3e31`):** the branch is available through GitHub's branch/tree API. Its app structure is `packages/app/src/new-session/` (not the older `pages/session` paths above): see [`view.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/new-session/view.tsx), [`wordmark.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/new-session/wordmark.tsx), and [`workspace/selector.tsx`](https://github.com/anomalyco/opencode/blob/4deda180370c3038877b0c35befb2e4a08cd3e31/packages/app/src/new-session/workspace/selector.tsx). OpenCode's `NewSessionView` groups centered branding, composer, project selector, and Git/workspace status; Loom presents the same product concept using the term workspace. OpenCode's `PromptGitStatus` displays `No Git` when its selected project lacks Git. Session screen, titlebar and settings shell are organized under `session/screen.tsx`, `shell/titlebar/titlebar.tsx`, and `settings/shell.tsx`. Reconcile harness paths against this snapshot before the later harness study; prior candidate paths were from a different tree layout.
- **UI study details:** OpenCode's new-session composition places workspace/project selection and Git status after the composer, with searchable existing worktrees and branch-based creation. Its titlebar uses a mobile drawer below 767 px and scrolls selected desktop tabs into view. Its timeline uses session-keyed follow/pinned state; its composer distinguishes queued follow-ups from steering and protects queue edits; Settings uses grouped vertical tabs, explicit Escape/focus handling, and a typed `settings.v3` persisted schema with migrations/tests. Loom-specific adaptations and deferred differences are recorded in UI.md; source study is complete, while responsive preview acceptance and the active-run queue remain separate UI work.

Extension sequence:

1. **Chat frame and session UX (active):** use OpenCode and Codex desktop as the required experience references while polishing the chat canvas, composer, welcome state, new-chat/session navigation, workspace entry points, and Settings surface. Workspaces are optional: start with a workspace-free chat, open a workspace later, and show `No Git` for a selected directory that is not a repository. Keep workspace/Git context below the composer and keep New chat reachable with zero sessions. Center the empty-chat brand mark, heading, composer, and repository context as one composition; keep model selection visible and move reasoning/approval to expandable Run options. Start with the workspace explorer collapsed on a fresh install to give chat the available canvas width, while preserving the welcome action, explorer rail actions, and any explicitly saved panel preference. Provide separate Open workspace and Create workspace paths; creating asks for a folder name and a user-selected parent directory. Never list an unstarted blank chat as a saved session; migrate legacy empty drafts from storage. Inspect the running UI in browser preview at wide and narrow sizes. Do not run any desktop/package build before the user accepts the completed UI phase.
2. **Chat/settings acceptance:** cover empty-session, no-workspace, workspace-selected, non-Git, branch, provider configuration, Settings categories, keyboard navigation, and narrow-window behavior. Chat/run timeline, tool activity, approvals, and errors are later UI increments after the chat frame; do not expand backend contracts just to polish the shell.
3. **OpenCode reference study (required before harness design):** identify a retrievable source snapshot and study the session page, session navigation/titlebar, new-session view, composer/model controls, timeline/run states, workspace/branch context, Settings pages/config persistence, and keyboard/small-screen behavior. Record verified paths, date/revision, concrete patterns, and Loom-specific differences in UI.md. Keep v2-specific findings separate from moving-branch findings.
4. **Harness compatibility map (after UI acceptance):** inspect and map session/message/event lifecycle, model/provider selection, agent loop/context assembly, tools and schemas, permission/effect model, cancellation/timeouts, persistence/replay/compaction, plugin capabilities, observability, and extension points. For each item mark adopt/adapt/defer, cite exact upstream source/specs, define Loom contract implications and tests, and preserve OpenCode licensing notices before considering code reuse. Prefer independent Go implementations of learned behavior over copying the TypeScript runtime wholesale.
5. **Go harness vertical slices (after the map):** evolve the existing protocol/runtime in tested increments: session/run event contract and replay, model/provider ports, bounded agent/tool loop, schema validation, explicit capability grants, workspace-scoped effects, approval broker, cancellation/timeouts, persistence/resume, and diagnostics. Keep UI and Go behind the versioned typed boundary. Transport changes require a separate evidence-backed decision after weighing supervised stdio JSONL against authenticated loopback HTTP; this UI milestone does not change IPC.
6. **Context and IDE/LSP later:** add instructions/context, search/index, compaction, editor polish, diagnostics, navigation and LSP/code actions only after the chat experience and harness contracts are stable.
7. **Desktop release:** only after browser UI acceptance and explicit completion of this phase, run native Windows/macOS package validation. Do not use Docker as a substitute for native macOS packaging. Keep Electron's native File/Edit/View/Help menus and Auto Save/Save All under File; the renderer menu remains browser-preview only.

## Phase 0 — UI and repository foundation

**Deliverables**

- Confirm Electron + React + TypeScript, Bun for UI package management/build/test scripts, and Go for the planned runtime.
- Establish UI-first repository layout, development/build scripts, lint/type-check/test commands, and CI.
- Define typed `RuntimeClient` interface and deterministic mock implementation for UI work.
- Define protocol versioning/compatibility; record gateway auth/API contract questions for later integration.

**TDD gate**

- Add a failing UI behavior test before implementing each initial screen/interaction.
- Add tests for mock client behavior and protocol schema fixtures.

**Exit criteria**

- Clean checkout can build and test the Electron + React UI with Bun.
- UI can show mock auth, model, conversation, workspace, approval, tool and diff states.
- UI/runtime boundary and protocol compatibility policy are documented.

## Phase 1 — Chat-first UI and settings acceptance (active)

**Deliverables**

- Chat-centered layout based on OpenCode v2 session navigation, conversation title, composer, model controls, chronological run timeline, tool/approval/error/cancellation states, and workspace context below the composer.
- Navigate the session list by keyboard with Up/Down and jump to its ends with Home/End; movement selects the active conversation.
- Keep composer drafts isolated by conversation and restore them when switching sessions.
- Show accessible streaming status and distinguish failed from cancelled responses while retaining partial output.
- Keep tool approval request details and the user's decision visible in the matching conversation history.
- Insert approval activity at the point it occurred in the message timeline, before later turns.
- Mark approvals from interrupted runs unavailable when restoring local conversation history.
- Invalidate and persist pending approvals as unavailable when the user cancels their run.
- Show current Git branch when the selected workspace is a repository, `No Git` when it is not, and explicit loading/unavailable states.
- Keep New chat visible when no sessions exist or the last session was deleted; do not create duplicate empty sessions when the blank chat is already active. A fresh chat is workspace-free by default; the user may open or create a workspace when ready.
- Navigable settings surface for providers, models, appearance, keybinds, permissions, extensions, and about; clearly label features not yet implemented.
- Browser preview uses typed deterministic fixtures. Renderer File/Edit/View/Help menus remain browser-only; packaged Electron uses native menus, with Auto Save and Save All under File.
- Keep editor/LSP and harness expansion deferred. Workspace selection is optional and basic file context is secondary to chat UX in this milestone.
- Existing workspace/editor code may be refactored or removed if the new accepted UI design needs it; avoid unrelated runtime work. No desktop build until the full UI phase is complete and reviewed.

**TDD gate**

- Write UI/component behavior tests first, using the mock runtime client.
- Cover launch, open-folder state, conversation flow, settings, approval, and diff workflows.
- Ensure fixtures conform to the planned runtime protocol types.

**Exit criteria**

- Chat/settings states are reviewed at narrow and wide browser sizes with keyboard access and no placeholder Git/session state presented as live data.
- UI can be reviewed before desktop packaging; no desktop/package build is run until this phase's acceptance criteria pass.

## Phase 2 — OpenCode-informed Go harness slices and integration seam (after Phase 1)

**Deliverables**

- Go module and runtime executable skeleton.
- Versioned local protocol and process lifecycle, composed with Uber Fx: workspace request/response, stdin EOF shutdown, and process supervision. Handshake, health/status, run events, and cancellation remain to implement.
- Shared outbound HTTP adapter for typed JSON request/response and generic SSE framing; provider DTOs and gateway integration remain to implement.
- Electron process supervisor and real IPC/RPC `RuntimeClient` adapter; keep mock adapter for UI tests.
- Study and map OpenCode v2 session/event, model/provider, agent-loop, tool, permission, context, persistence, and plugin behaviors to Loom's versioned contracts; implement in Go behind tested boundaries rather than porting OpenCode's SolidJS/TypeScript runtime wholesale.
- Keep existing Go runtime behavior as-is while Phase 1 UI/UX is being completed; do not expand transport/runtime scope ahead of the chat/settings acceptance gate.
- Read-only workspace Git status and current branch metadata for the chat context row; Git mutations remain outside scope.

**TDD gate**

- Go protocol/lifecycle tests and shared contract fixtures.
- `httptest` contract tests for normal JSON responses, structured HTTP errors, SSE events, and handler cancellation.
- UI tests for disconnected, reconnecting, and protocol mismatch states.
- Integration test starts runtime and exchanges health request/event.

**Exit criteria**

- App starts/stops Go process and can switch from mock to real client without React component changes.

## Phase 3 — OpenAI-compatible provider and model streaming

**Deliverables**

- OpenAI-compatible endpoint/model/API key settings with OS-encrypted key persistence.
- Provider-neutral model port, streamed responses, tool loop, cancellation, and approval response.
- Workspace-scoped list/read/write tools protected by approval, plus explicit user-driven file creation that fails safely when a path already exists.
- OAuth, organization identity, model discovery, multiple providers, and advanced permission modes remain future work.

**TDD gate**

- Test invalid provider settings, provider errors, streaming, cancellation, approval roundtrips, and no silent fallback.
- Adapter contract tests use local stubs; UI tests use fakes. No real credentials/network calls.

**Exit criteria**

- Signed-in user can stream a response; unauthenticated requests are rejected; secrets never appear in logs or SQLite.

## Phase 4 — Local persistence and conversation lifecycle (future)

**Deliverables**

- SQLite repository and migrations for workspaces, conversations, messages/events, runs, tool calls, and approvals.
- Create/list/search/resume/rename/delete/export conversations.
- Persist ordered streaming and run lifecycle events.

**TDD gate**

- Repository tests use temporary SQLite databases; cover migration, transaction, and resume behavior.
- Service tests use in-memory fakes; UI covers empty/loading/error/resumed states.

**Exit criteria**

- Restarting app preserves conversations and resumable state; deleting history does not remove workspace files.

## Phase 5 — Workspace, tools, diff, and approvals

**Deliverables**

- Native Open Folder flow and right-side scoped file explorer.
- Workspace port/filesystem adapter with canonical path and symlink boundary checks.
- Read/search/apply-edit tools and structured command runner behind interfaces.
- Approval modes/cards showing exact target and effects; runtime enforces policy.
- Changed-file list, diff inspection, command output, cancellation/timeouts, and checkpoint/revert strategy.

**TDD gate**

- Test traversal/symlink escape, out-of-root denial, policy outcomes, stale approval invalidation, cancellation, timeouts, and diffs.
- Adapter integration tests use temporary workspaces including platform path edge cases.
- UI tests cover explorer, approvals, diff, and rejection.

**Exit criteria**

- Agent can read a workspace file, request an edit, wait for approval, apply it, and show an accurate diff; denied/out-of-scope actions never execute.

## Phase 6 — Indexing, plugins, and external tools

**Deliverables**

- Ignore-aware background file discovery and text search with progress/errors.
- Versioned plugin capability contracts for model/auth/tool/indexer.
- First-party extensions through interfaces; third-party execution isolated out of process.
- MCP client adapter with per-server permissions and approval integration.
- Plugin diagnostics for version, enabled state, capabilities, requested permissions, and logs.

**TDD gate**

- Test ignore rules, incremental indexing, cancellation, manifest compatibility, and permission denial.
- Contract tests cover plugin RPC/MCP boundaries; untrusted content cannot alter host policy.

**Exit criteria**

- User can search workspace and connect a controlled extension without granting ambient machine access.

## Phase 7 — Hardening and v1 release candidate

**Deliverables**

- Signed Windows/macOS packages, update strategy, onboarding, diagnostics, and data export/delete.
- Security review of IPC, plugin isolation, credentials, path enforcement, command execution, and update chain.
- Performance pass on large workspaces and long conversations; gateway compatibility matrix.

**TDD gate**

- CI matrix runs Go tests, UI tests, lint/type-check, protocol tests, and critical journey checks on Windows/macOS.
- Regression flow covers auth → open folder → prompt → approval → edit/diff → restart/resume.

**Exit criteria**

- Critical journeys pass on both platforms with no known blocker in auth, persistence, workspace boundaries, or recovery.

## Initial repository shape (proposal)

```text
apps/desktop/                 # Electron + React + TypeScript UI; Bun scripts
packages/ui/                  # Shared UI components and client state
packages/runtime-client/      # RuntimeClient interface, protocol types, mock and IPC adapters
runtime/                      # Go runtime, added incrementally
  cmd/agent-runtime/
  internal/domain/
  internal/application/
  internal/ports/
  internal/adapters/
protocol/                     # Versioned schemas and shared fixtures
docs/product/                 # Product baseline, architecture, plan, changelog
```

This is a proposal, not a requirement to create empty abstractions. Keep packages cohesive and introduce a port when it defines an actual replaceable boundary or enables isolated tests.

## Version 1 release definition

V1 is complete when a user can configure a provider, open and navigate a local project folder, converse with a streaming model, review and approve scoped tool actions, inspect/revert file changes, and resume locally stored conversations after restart on Windows and macOS.
