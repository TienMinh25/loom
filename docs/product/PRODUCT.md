# Product Definition — v1

**Docs version:** 1.24.0
**Status:** Updated baseline
**Last updated:** 2026-09-30

## 1. Product intent

Build a cross-platform desktop application for Windows and macOS that provides a polished coding-agent harness inspired by the workflows of Codex and Kiro. It should let a user connect to an OpenAI-compatible provider, work in a local codebase, and supervise agent actions.

The desktop workspace should also grow into a local IDE with polished file editing and agent workflows. Codex is the primary workbench reference and VS Code is the editor/explorer reference. Code suggestions and Git integration are outside this scope.

The desktop UI is written in TypeScript with React, hosted in Electron, and built/tested with Bun. Browser preview uses mock data; desktop mode integrates with the Go agent runtime through a versioned local interface (JSON-lines RPC over a supervised process plus typed Electron IPC).

The product is the harness and desktop experience. The first live model path uses an OpenAI-compatible API, while a future backend can provide a shared API/SSE contract behind the provider adapter.

## 2. Product principles

- **Provider boundary:** OpenAI-compatible base URL, model, and optional API key are configured in desktop settings; future backends can implement the same adapter boundary.
- **Local ownership:** workspaces, conversation history, and agent activity are stored locally unless a feature explicitly sends selected data to a configured service.
- **Visible actions:** file edits, commands, approvals, and results are understandable and reviewable.
- **Safe by default:** permissions are scoped to the selected workspace; sensitive actions are mediated by the runtime.
- **Extensible at boundaries:** add providers, auth methods, tools, and backend integrations through stable interfaces rather than UI-specific code.
- **Test-first development:** add a failing test for the behavior before implementing it; keep business rules testable without desktop UI, network access, or real model credentials.
- **UI-first delivery:** browser preview uses typed mock data while desktop workflows progressively integrate with the Go harness.
- **Recoverable work:** users can inspect diffs, undo or revert changes, and resume prior conversations.

## 3. Target users

- Developers using an organization-managed LLM gateway.
- Developers using a self-hosted LLM gateway or compatible backend.
- Developers who optionally configure a direct model provider credential.
- Teams that want a desktop coding agent with explicit local workspace controls.

## 4. Primary workflows

### 4.1 First launch and authentication

1. User enters an OpenAI-compatible base URL and model, and optionally an API key.
2. Electron stores the API key using OS-backed encryption and sends it only to the local runtime when configuring the provider.
3. The runtime streams model output and tool-call deltas over the versioned local protocol.
4. If the endpoint rejects configuration or a request, the app shows the provider error; it does not silently select another endpoint.

The future backend authentication contract is deployment-specific. It should map to the shared backend request and SSE response contract through a dedicated adapter. OAuth/OIDC and organization identity are not implemented in the current provider path.

### 4.2 Open a codebase

1. User selects **Open Folder** (or uses the OS file picker).
2. The folder becomes the active workspace.
3. The right side panel shows a navigable file tree; users can expand folders, open files in editor tabs, and save changes.
4. The user starts a conversation scoped to the active workspace.

The v1 UI places the workspace explorer on the right side as requested. Keep panel visibility and width controllable. Opening a folder is not the same as granting arbitrary filesystem access: reads/writes must still be confined by workspace policy unless the user separately approves an outside path.

### 4.3 Agent-assisted change

1. User describes a task in a conversation.
2. Runtime sends the prompt to the configured OpenAI-compatible model.
3. Model proposes a workspace tool call; the local runtime validates it.
4. The runtime asks for approval before each tool action and executes only within the selected workspace.
5. Tool results and streamed assistant text appear in the conversation timeline.

### 4.4 Conversation lifecycle

Conversation messages and the selected conversation persist in versioned renderer local storage. A blank composer draft is not listed as a session; the first sent message creates the session. Users can delete conversations after confirmation, and deleting the last one returns the sidebar to an empty state. This is not yet a runtime database or canonical transcript store. See the session storage proposal. Deleting a conversation never deletes workspace files.

## 5. V1 scope

### Must have

- Windows and macOS desktop builds.
- OpenAI-compatible provider settings (base URL, model, optional API key) for the first live model path.
- Persist API keys using Electron OS-backed encryption.
- OAuth/backend identity, model discovery, and organization sign-in remain future work.
- Open-folder/workspace selection and a right-side file explorer.
- Workspace-scoped file and folder rename that preserves content and updates open editor tabs.
- Workspace-wide file-name/path search that can open matching files in the editor.
- In-session conversation state (durable local persistence remains future work).
- Streaming assistant responses, stop/cancel.
- Local runtime mediation for workspace list/read/write with approval before each model-proposed tool call.
- Search/index, real diff review, command execution, and terminal remain future work.
- File editing supports manual save and optional debounced auto save selected from the top-level File menu; concurrent edits must not be marked saved before they reach disk.
- Conservative approval before each model-proposed workspace tool call.
- Diff review for agent file edits.
- Workspace-aware text search/index status. Start with efficient file/text search; deeper semantic indexing can follow.
- Settings for OpenAI-compatible base URL, model, and optional provider credentials.

### Should have

- MCP client support for connecting external tools/resources, with per-server controls.
- Export and delete local conversation history.
- Plugin diagnostics (version, enabled state, requested capabilities, logs).

### Not required for v1

- Public plugin marketplace or automatic third-party plugin installation.
- Cloud synchronization of conversations.
- Collaboration/multi-user editing.
- Embeddings/vector database as a prerequisite for code search.
- Git integration and generated code suggestions are outside the current IDE work scope.
- A built-in hosted gateway service.

## 6. Success criteria

- A user can configure an OpenAI-compatible provider, open a folder, and exchange streamed messages with workspace tool approvals.
- The user can identify which workspace is active and what permissions the agent has.
- Every tool action has an auditable request/result and a clear approval outcome.
- Conversation state remains available during the current app session; model operations require a reachable configured provider.

## 7. Open decisions to resolve before implementation is locked

- Gateway API and auth contract: OAuth/OIDC, device code, browser SSO, or gateway-issued credentials.
- Whether gateway deployments expose an OpenAI-compatible API or require a dedicated adapter.
- Installer/update and code-signing approach for Windows and macOS.
- Exact default approval modes and shell sandbox strategy per operating system.
- Whether the explorer is always on the right or user-movable in the first UI release.
