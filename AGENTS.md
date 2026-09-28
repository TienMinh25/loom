# Project Rules

## Required workflow: TDD

- Use test-driven development for every behavior change: write a focused failing test first, implement the smallest change that makes it pass, then refactor while keeping tests green.
- Do not add production behavior without corresponding tests. Bug fixes must include a regression test.
- Keep tests deterministic. Do not require real gateway access, real API credentials, or external services; use fakes or local stubs.
- Test domain and orchestration logic independently from UI, database, filesystem, and network adapters where practical. Add adapter integration/contract tests at those boundaries.
- Before finishing a change, run the relevant tests and report what was run and any tests that could not be run.

## Language and architecture

- Desktop UI is React + TypeScript hosted by Electron; use Bun for UI package management and scripts. Agent runtime is Go and is implemented incrementally after UI workflows are developed against a typed mock client. Keep the boundary explicit and versioned.
- Prefer small interfaces/ports at boundaries that need substitution, independent testing, or extension. Inject implementations at composition roots.
- Core logic must not depend directly on concrete gateway SDKs, OS credential APIs, SQLite, Electron, or global filesystem/process functions.
- Do not introduce interfaces for every type or speculative layers without a concrete testing or extension need.
- Plugins/providers/tools must declare capabilities and receive only granted access; do not provide ambient machine access.

## Formatting and linting

- Use Prettier as the formatter. It adds semicolons, uses double quotes, 2-space indentation, trailing commas, and wraps around 100 columns.
- Use CRLF line endings for text files, matching `.editorconfig` and `.gitattributes`.
- Separate imports from implementation with one blank line. Use at most one consecutive blank line; do not add blank lines at the beginning or end of files.
- Run `bun run format` to apply formatting. Run `bun run lint` to check ESLint rules and formatting; lint must not rewrite files.
- ESLint enforces TypeScript recommended rules, React Hooks rules, curly braces, strict equality, no `var`, no `debugger`, no unused declarations, and consistent type-only imports. `console.log` is disallowed; `console.warn` and `console.error` are allowed.
- Keep tests in the normal lint/format scope. Generated output, coverage, and dependencies are excluded.

## Product and documentation versioning

- `docs/product/` is the product/architecture source of truth.
- When a requirement or accepted architecture decision changes, update the affected docs, bump the docs version in `docs/product/README.md` and affected documents, and add a dated entry to `docs/product/CHANGELOG.md` in the same change.
- Keep proposals labeled as proposals until accepted.
