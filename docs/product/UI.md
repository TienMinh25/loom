# UI and Interaction — v1

**Docs version:** 1.2.0
**Status:** Draft baseline  
**Last updated:** 2026-09-28

## 1. Main window

The selected v1 frontend stack is React + TypeScript hosted by Electron, with Bun for package management and UI development/build/test scripts. Electron provides the desktop shell; React renders the interface. The UI initially consumes a typed mock `RuntimeClient`; Go-backed transport is integrated progressively.

Use a three-area coding workspace:

```text
┌──────────────────┬─────────────────────────────┬──────────────────┐
│ Threads / recent │ Conversation and run events │ Workspace files  │
│                  │                             │ (right side)     │
│                  │                             │                  │
├──────────────────┴─────────────────────────────┴──────────────────┤
│ Active workspace · model/gateway · approval mode · index status    │
└────────────────────────────────────────────────────────────────────┘
```

The workspace explorer belongs on the right in v1. It can be collapsed and resized. Keep **Open Folder** available from the welcome state and workspace menu. The active root is always visible, and an empty state explains how to open one.

## 2. Navigation regions

- **Left sidebar:** conversation list, search, new conversation, workspace/thread grouping.
- **Center:** message composer and chronological conversation/run timeline.
- **Right sidebar:** active workspace root, file tree, selected-file preview/open action, and optionally changed-files list.
- **Bottom/status area:** gateway/auth state, active model, approval mode, active workspace, indexing progress, and run state.

Do not overload the right side with both the entire explorer and a large diff view at once. Selecting a changed file may open the diff in the center or a dedicated tab while preserving explorer state.

## 3. Workspace and folder behavior

- **Open Folder** invokes a native folder picker.
- Opening a new folder sets it as the active workspace; existing conversations retain their original workspace association.
- Display the canonical workspace name/path in workspace controls and the explorer header.
- Allow tree expansion/collapse, file selection, refresh, and opening a file in the app's editor/preview surface.
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

An approval response should update the timeline immediately and be persisted. If the request changes after presentation, invalidate the prior approval and ask again.

## 6. Diff and file changes

- Show changed files and per-file additions/deletions.
- Let the user inspect a unified or side-by-side diff.
- Mark whether each change is pending, applied, accepted, or reverted according to the implementation model.
- Provide a clear path to restore a file from a pre-edit checkpoint when available.
- Never imply that accepting a UI card is the same as a Git commit.

## 7. Authentication and provider settings

Settings should make the gateway the primary connection:

- Gateway URL/organization profile.
- Sign in, signed-in identity/status, refresh/re-authenticate, sign out.
- Available models and capabilities.
- Optional **Advanced: direct provider credentials** section, disabled or hidden unless explicitly enabled.
- Visible active route (gateway or direct provider) while chatting.

On gateway auth errors, stop new runs and explain whether the user should retry, reauthenticate, or contact the gateway administrator. Do not silently route around gateway auth.

## 8. Accessibility and keyboard basics

Support keyboard navigation among sidebar, conversation, composer, and explorer; visible focus; accessible names for icon-only controls; and a keyboard shortcut to open a folder and focus the composer. Avoid status-only color coding for approvals/errors.

