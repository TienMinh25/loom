# Documentation Changelog

All product/architecture/UI decisions that change the v1 baseline should be recorded here. Update the version in `README.md` and affected documents with each entry.

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

