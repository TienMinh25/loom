# Product Definition — v1

**Docs version:** 1.1.0  
**Status:** Draft baseline  
**Last updated:** 2026-09-28

## 1. Product intent

Build a cross-platform desktop application for Windows and macOS that provides a polished coding-agent harness inspired by the workflows of Codex and Kiro. It should let a user connect to an organization or self-hosted LLM gateway, work in a local codebase, supervise agent actions, and keep conversation history locally.

The desktop UI is written in TypeScript. The agent runtime is written in Go and communicates with the UI through a versioned local interface (initially a local RPC/IPC transport).

The product is the harness and desktop experience. Model inference may be supplied by an external gateway, and the application should not assume that users have direct credentials for model vendors.

## 2. Product principles

- **Gateway-first authentication:** users sign in to the configured LLM gateway. They do not need vendor API keys to use the standard experience.
- **Local ownership:** workspaces, conversation history, and agent activity are stored locally unless a feature explicitly sends selected data to a configured service.
- **Visible actions:** file edits, commands, approvals, and results are understandable and reviewable.
- **Safe by default:** permissions are scoped to the selected workspace; sensitive actions are mediated by the runtime.
- **Extensible at boundaries:** add providers, auth methods, tools, and backend integrations through stable interfaces rather than UI-specific code.
- **Test-first development:** add a failing test for the behavior before implementing it; keep business rules testable without desktop UI, network access, or real model credentials.
- **Recoverable work:** users can inspect diffs, undo or revert changes, and resume prior conversations.

## 3. Target users

- Developers using an organization-managed LLM gateway.
- Developers using a self-hosted LLM gateway or compatible backend.
- Developers who optionally configure a direct model provider credential.
- Teams that want a desktop coding agent with explicit local workspace controls.

## 4. Primary workflows

### 4.1 First launch and authentication

1. User enters or receives the gateway endpoint (an organization can preconfigure it).
2. User authenticates through the gateway's supported sign-in mechanism.
3. The app stores refresh/access credentials in the operating system's secure credential store where supported.
4. The app obtains available models/capabilities from the gateway and lets the user select a model.
5. If the gateway is unreachable or authentication expires, the app explains the state and offers retry/sign-in; it must not silently fall back to another provider.

The gateway authentication contract is deployment-specific and must be finalized with the gateway owner. Support OAuth/OIDC or a gateway-issued session/token flow through an auth adapter. Do not assume that an API key is the only possible credential.

### 4.2 Open a codebase

1. User selects **Open Folder** (or uses the OS file picker).
2. The folder becomes the active workspace.
3. The side panel shows a navigable file tree and workspace root; users can expand folders, select/open files, and see basic file status.
4. The app indexes supported content in the background and shows indexing state.
5. The user starts a new conversation scoped to that workspace or resumes one associated with it.

The v1 UI places the workspace explorer on the right side as requested. Keep panel visibility and width controllable. Opening a folder is not the same as granting arbitrary filesystem access: reads/writes must still be confined by workspace policy unless the user separately approves an outside path.

### 4.3 Agent-assisted change

1. User describes a task in a conversation.
2. Runtime sends the prompt and relevant context to the authenticated gateway/model.
3. Model proposes a tool call; the local runtime validates its schema and policy.
4. Depending on approval mode, the runtime asks for approval or executes within the granted scope.
5. File edits appear in a diff/review surface; command output and tool results are shown in the conversation timeline.
6. User accepts, continues, or reverts changes.

### 4.4 Resume and inspect history

Conversation list is local. A user can reopen a conversation, inspect its messages and tool activity, and continue it when gateway authentication is valid. Removing a conversation should not delete modified workspace files.

## 5. V1 scope

### Must have

- Windows and macOS desktop builds.
- Gateway endpoint configuration and mandatory gateway authentication for the standard path.
- Model list/capability discovery from the gateway, with a clear unavailable/error state.
- Optional direct provider/API-key configuration behind an advanced setting; never required for gateway use.
- Open-folder/workspace selection and a right-side file explorer.
- Local conversation/message/tool-event persistence.
- Streaming assistant responses, stop/cancel, retry, and resume.
- Local runtime mediation for file read/write and command execution.
- Approval modes, with a conservative default requiring approval for writes and command execution.
- Diff review for agent file edits.
- Workspace-aware text search/index status. Start with efficient file/text search; deeper semantic indexing can follow.
- Settings for gateway, model, workspace, approval mode, and optional provider credentials.

### Should have

- MCP client support for connecting external tools/resources, with per-server controls.
- Git status awareness and a simple checkpoint/revert path.
- Export and delete local conversation history.
- Plugin diagnostics (version, enabled state, requested capabilities, logs).

### Not required for v1

- Public plugin marketplace or automatic third-party plugin installation.
- Cloud synchronization of conversations.
- Collaboration/multi-user editing.
- Embeddings/vector database as a prerequisite for code search.
- A built-in hosted gateway service.

## 6. Success criteria

- A new user can authenticate to a configured gateway, open a folder, ask for a code change, review the diff, and resume the conversation after restarting the app.
- The normal gateway flow works without entering a model vendor API key.
- The user can identify which workspace is active and what permissions the agent has.
- Every tool action has an auditable request/result and a clear approval outcome.
- Conversation data stays available locally when offline, though model operations require a reachable authenticated gateway/provider.

## 7. Open decisions to resolve before implementation is locked

- Gateway API and auth contract: OAuth/OIDC, device code, browser SSO, or gateway-issued credentials.
- Whether gateway deployments expose an OpenAI-compatible API or require a dedicated adapter.
- Installer/update and code-signing approach for Windows and macOS.
- Exact default approval modes and shell sandbox strategy per operating system.
- Whether the explorer is always on the right or user-movable in the first UI release.

