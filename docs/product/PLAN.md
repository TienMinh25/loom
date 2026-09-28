# V1 Delivery Plan

**Docs version:** 1.2.0
**Product target:** v1.0  
**Status:** Proposed implementation sequence  
**Last updated:** 2026-09-28

## Goal

Build the desktop experience first with Electron, React, TypeScript, and Bun. Then implement and integrate the Go harness incrementally. The v1 product ultimately includes mandatory gateway authentication for its standard model path, local workspace/file navigation, reviewable tools and approvals, and locally persisted conversations.

## Delivery principles

- Follow TDD for every behavior: failing test first, minimal implementation, refactor, then broader verification.
- Keep Go domain/orchestration code independent from adapters and use injected interfaces at real substitution/test boundaries.
- Build UI workflows against a typed mock runtime client before Go runtime capabilities exist.
- Replace mock capabilities with real Go-backed vertical slices progressively; keep React components independent from transport details.
- Keep the UI/runtime protocol versioned and contract-tested.
- No automated test depends on a real gateway, credentials, or external service.
- Defer a general plugin marketplace until gateway, tool, and approval seams have proven stable.

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

## Phase 1 — Interactive desktop UI prototype

**Deliverables**

- Electron window with left conversation sidebar, center conversation area, and collapsible right workspace explorer.
- React layout/components for navigation, composer, conversation timeline, settings, auth/model states, approval cards, and diff presentation using typed fixtures.
- Bun scripts for install, development, build, lint/type-check, unit/component tests, and packaging preparation.
- Mock runtime client covering loading, success, pending approval, error, cancellation, and empty states.

**TDD gate**

- Write UI/component behavior tests first, using the mock runtime client.
- Cover launch, open-folder state, conversation flow, settings, approval, and diff workflows.
- Ensure fixtures conform to the planned runtime protocol types.

**Exit criteria**

- User can navigate the proposed desktop workflow with deterministic mock data.
- UI can be reviewed and adjusted without waiting for harness features.

## Phase 2 — Go runtime foundation and integration seam

**Deliverables**

- Go module and runtime executable skeleton.
- Versioned local protocol and process lifecycle: handshake, health/status, events, cancellation, graceful shutdown.
- Electron process supervisor and real IPC/RPC `RuntimeClient` adapter; keep mock adapter for UI tests.

**TDD gate**

- Go protocol/lifecycle tests and shared contract fixtures.
- UI tests for disconnected, reconnecting, and protocol mismatch states.
- Integration test starts runtime and exchanges health request/event.

**Exit criteria**

- App starts/stops Go process and can switch from mock to real client without React component changes.

## Phase 3 — Gateway authentication and model streaming

**Deliverables**

- Gateway settings, sign-in/sign-out and expired-session states.
- `Authenticator` and `ModelGateway` ports with gateway adapter; secure credential storage per OS.
- Model discovery/capabilities and streamed responses.
- Optional direct provider/API-key path behind an explicit advanced setting.

**TDD gate**

- Test unauthenticated rejection, login/refresh/logout, expiry, gateway failures, and no silent fallback.
- Adapter contract tests use local stubs; UI tests use fakes. No real credentials/network calls.

**Exit criteria**

- Signed-in user can stream a response; unauthenticated requests are rejected; secrets never appear in logs or SQLite.

## Phase 4 — Local persistence and conversation lifecycle

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

V1 is complete when a user can authenticate to the configured gateway, open and navigate a local project folder, converse with a streaming model, review and approve scoped tool actions, inspect/revert file changes, and resume locally stored conversations after restart on Windows and macOS.

