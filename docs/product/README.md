# Desktop Agent Harness — Product Docs

**Documentation version:** 1.1.0  
**Product version covered:** v1 (initial definition)  
**Status:** Draft baseline  
**Last updated:** 2026-09-28

This folder is the source of truth for the first version of the desktop agent harness. Update the version and `CHANGELOG.md` whenever a decision or requirement changes. Keep implementation-specific proposals labeled as proposals until accepted.

## Documents

- [Product requirements](PRODUCT.md) — goals, users, core workflows, and v1 scope.
- [Architecture](ARCHITECTURE.md) — application boundaries, authentication, providers, tools, storage, and plugin model.
- [UI behavior](UI.md) — layout and interaction behavior, including workspace/folder navigation.
- [V1 delivery plan](PLAN.md) — staged implementation plan, TDD gates, and initial milestones.
- [Version history](CHANGELOG.md) — dated record of decisions and document changes.

## Versioning rules

Use Semantic Versioning for this documentation set:

- **MAJOR**: accepted changes that invalidate or substantially replace a prior product/architecture decision.
- **MINOR**: new requirements, workflows, or architectural capabilities that remain compatible with the current baseline.
- **PATCH**: clarifications, typo fixes, and detail that does not change product behavior.

Record every version bump in `CHANGELOG.md`. Update the version and last-updated date in this index and affected documents in the same change.

## Baseline decisions in v1.0.0

1. The desktop application is a local-first coding-agent harness for Windows and macOS.
2. The desktop UI is implemented in TypeScript; the local agent runtime is implemented in Go.
3. A user must authenticate to the configured LLM gateway before using an LLM. Gateway authentication is the default and required path.
4. Direct provider API-key configuration may be supported as an optional advanced provider path; it must not be required for the gateway flow.
5. Users can open/select a project folder and navigate its files in a dedicated side panel. The initial placement is the right side, configurable later if usability calls for it.
6. Tool calls are mediated by the local runtime and explicit workspace/security policies; plugins do not receive ambient access by default.
7. Development follows TDD. Core runtime capabilities depend on interfaces/ports and injected adapters, not concrete providers or operating-system implementations.

