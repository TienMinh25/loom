# V1 Delivery Plan

**Docs version:** 1.1.0  
**Product target:** v1.0  
**Status:** Proposed implementation sequence  
**Last updated:** 2026-09-28

## Goal

Deliver a Windows/macOS desktop coding-agent MVP with a TypeScript UI, Go runtime, mandatory gateway authentication for the standard model path, local workspace/file navigation, reviewable tools and approvals, and locally persisted conversations.

## Delivery principles

- Follow TDD for every behavior: failing test first, minimal implementation, refactor, then broader verification.
- Keep Go domain/orchestration code independent from adapters and use injected interfaces at real substitution/test boundaries.
- Keep the UI/runtime protocol versioned and contract-tested.
- Complete a vertical slice early; do not build a general plugin marketplace before the gateway, tool, and approval seams have proven stable.
- No automated test depends on a real gateway, credentials, or external service.

## Phase 0 — Decisions and repository foundation

**Deliverables**

- Confirm desktop shell (Electron recommended), UI framework, Go version, packaging approach, and local RPC transport.
- Define repository layout, build scripts, lint/type-check/test commands, CI, and dependency update policy.
- Define protocol versioning and compatibility policy between UI and runtime.
- Agree gateway authentication/API contract with the gateway owner (login flow, token refresh, model discovery, streaming, tool-call format, errors).

**TDD gate**

- Add a smoke test for each package/app boundary and CI invocation before feature implementation.
- Add a protocol schema round-trip/compatibility test fixture.

**Exit criteria**

- Clean checkout can build UI and Go runtime on Windows and macOS CI.
- A protocol compatibility decision and gateway contract are documented.

## Phase 1 — UI shell, runtime process, and protocol vertical slice

**Deliverables**

- Desktop window with left conversation sidebar, center conversation area, and collapsible right workspace explorer placeholder.
- Go runtime starts/stops under desktop supervisor.
- Typed request/event protocol supports handshake, health/status, event streaming, cancellation, and graceful shutdown.
- Display connection/runtime errors in the UI.

**TDD gate**

- Go unit tests for protocol dispatch and lifecycle state.
- UI tests for handshake states and runtime disconnection/reconnection display.
- Contract tests using shared protocol fixtures.

**Exit criteria**

- App starts runtime, completes handshake, streams a mock event to UI, cancels a mock request, and shuts down cleanly on both platforms.

## Phase 2 — Gateway authentication and model streaming

**Deliverables**

- Gateway settings, sign-in/sign-out and expired-session states.
- Authenticator and ModelGateway ports with a gateway adapter; secure credential-store adapter per OS.
- Model discovery and capability display.
- Stream text/status into a conversation using a deterministic fake gateway in development/tests.
- Optional direct provider/API-key path remains behind an explicit advanced setting and is not required for standard use.

**TDD gate**

- Tests for unauthenticated rejection, login/refresh/logout, expired token, gateway failure, and ensuring no silent fallback.
- Adapter contract tests against a local stub server; no external network or real credentials.
- UI tests for auth states and streaming/cancel behavior.

**Exit criteria**

- A signed-in user can stream a text response; unauthenticated requests are rejected; secrets never appear in logs or SQLite.

## Phase 3 — Local persistence and conversation lifecycle

**Deliverables**

- SQLite repository with migrations for workspaces, conversations, messages/events, runs, tool calls, and approval decisions.
- New conversation, list/search recent conversations, resume, rename, delete, and export.
- Persist streaming/run/tool lifecycle events in order.

**TDD gate**

- Repository tests against temporary SQLite database, migration tests from empty/current schema, transaction and resume tests.
- Application-service tests with in-memory repository fakes.
- UI tests for empty/loading/error and resumed timeline states.

**Exit criteria**

- Restarting the app preserves conversation history and resumable state; deleting history does not remove workspace files.

## Phase 4 — Workspace explorer, file tools, diff, and approvals

**Deliverables**

- Native Open Folder flow and right-side scoped file explorer.
- Workspace port and filesystem adapter with canonical path/symlink boundary checks.
- Read/search/apply-edit tools and structured command runner behind interfaces.
- Approval modes and UI cards showing exact targets/effects; runtime enforces policy.
- Changed-file list, diff inspection, command output, cancel/timeouts, and checkpoint/revert strategy.

**TDD gate**

- Tests for path traversal, symlink escape, out-of-root denial, policy allow/ask/deny, stale approval invalidation, cancellation, command timeout, and diff generation.
- Adapter integration tests in temporary workspaces, including Windows path behavior where applicable.
- UI tests for explorer states, approval lifecycle, diff rendering, and rejection.

**Exit criteria**

- Agent can read a workspace file, request an edit, wait for approval, apply it, and show an accurate diff; denied/out-of-scope operations do not execute.

## Phase 5 — Indexing, plugins, and external tools

**Deliverables**

- Ignore-aware background file discovery and text search with progress/errors.
- Plugin manifest and versioned capability contracts for model/auth/tool/indexer.
- First-party provider/tool plugins loaded through interfaces; third-party execution isolated out of process.
- MCP client adapter with per-server permissions and approval integration.
- Plugin diagnostics: enabled state, version, capabilities, requested permissions, and logs.

**TDD gate**

- Tests for ignore rules, incremental indexing, cancellation, plugin schema/compatibility validation, and permission denial.
- Protocol contract tests for plugin RPC and MCP-adapter boundary.
- Tests ensure untrusted tool descriptions/content cannot change host policy.

**Exit criteria**

- User can search a workspace and connect a controlled tool/provider extension without granting ambient filesystem/process/credential access.

## Phase 6 — Hardening, packaging, and v1 release candidate

**Deliverables**

- Signed Windows/macOS packages, update strategy, first-run onboarding, crash/log diagnostics, and data export/delete.
- Security review of IPC, plugin isolation, credential handling, path enforcement, command execution, and update chain.
- Performance pass on large workspaces and long conversations.
- Release notes and supported gateway compatibility matrix.

**TDD gate**

- CI matrix runs Go unit/integration tests, UI tests, lint/type-check, protocol tests, and critical journey smoke tests on Windows/macOS.
- Release candidate regression suite covers auth → open folder → prompt → approval → edit/diff → restart/resume.

**Exit criteria**

- All critical journey checks pass on both platforms; no known blocker in gateway auth, data persistence, workspace boundaries, or recovery.

## Initial repository shape (proposal)

```text
apps/desktop/                 # TypeScript UI + desktop shell
packages/ui/                  # Shared UI components and client state
runtime/                      # Go modules and executable
  cmd/agent-runtime/
  internal/domain/
  internal/application/
  internal/ports/
  internal/adapters/
  internal/protocol/
protocol/                     # Versioned schemas and shared fixtures
docs/product/                 # Product baseline, architecture, plan, changelog
```

This is a proposal, not a requirement to create empty abstractions. Keep packages cohesive and introduce a port when it defines an actual replaceable boundary or enables isolated tests.

## Version 1 release definition

V1 is complete when a user can authenticate to the configured gateway, open and navigate a local project folder, converse with a streaming model, review and approve scoped tool actions, inspect/revert file changes, and resume locally stored conversations after restart on Windows and macOS.

