# Session storage design

**Docs version:** 1.19.0
**Status:** Proposal — durable runtime storage is not implemented  
**Last updated:** 2026-09-29

## Current behavior

The renderer writes conversations and the selected conversation to versioned browser local storage. This survives an app restart in one Electron profile, but it is not a database, has no transcript recovery, and does not coordinate concurrent writers. Treat it as a UI persistence bridge, not the durable session store.

## Proposed durable model

Use the same useful separation present in Codex CLI: a queryable SQLite metadata index plus canonical append-only JSONL transcripts. Codex's thread-store describes JSONL as canonical history and SQLite as queryable metadata; its thread schema indexes identity, timestamps, source, working directory, title, and archive state. See the [Codex thread-store notes](https://github.com/openai/codex/blob/main/codex-rs/thread-store/README.md) and [threads migration](https://github.com/openai/codex/blob/main/codex-rs/state/migrations/0001_threads.sql).

Loom proposal:

- Store data under Electron `app.getPath("userData")`, separate from the project workspace.
- `state.sqlite` indexes threads: `id`, `title`, `created_at`, `updated_at`, `workspace_root`, `provider_id`, `archived`, and `transcript_path`.
- Store each thread's canonical transcript in `sessions/<date>/<thread-id>.jsonl`. Each line is a versioned event: session metadata, user message, assistant message/delta, tool request, approval decision, tool result, cancellation, or error.
- Treat JSONL append as the source of truth. SQLite rows are derived/queryable metadata updated after transcript appends; if metadata is stale, rebuild it from transcript headers and events.
- Resume by loading the indexed thread metadata and replaying its transcript. Keep an active thread ID in the UI, but do not make the renderer the transcript authority.
- Delete a thread through a runtime API that removes its database row and transcript as one recoverable operation; archive can remain metadata-only.
- Use migrations, transaction boundaries, corruption recovery, bounded event payloads, and crash-recovery tests before enabling long-lived agent sessions.
- Use a pure-Go SQLite driver with CGO disabled so Windows/macOS builds do not need GCC. Keep the repository behind an injected session-store port.

This is a proposal, not a promise to match Codex's private implementation details. Implement it after selecting and contract-testing the local storage adapter; until then renderer local storage remains the only durable chat implementation.
