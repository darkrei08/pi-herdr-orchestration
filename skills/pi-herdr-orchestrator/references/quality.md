# Verification and review

For reproducible bugs, prefer a meaningful failing regression check followed by a minimal fix and passing check. Use TDD when it adds evidence; avoid tests that merely mirror implementation. A refactor needs explicit behavior-preservation tests before the change.

Auto-grill cause versus symptom, assumptions, simpler alternatives, duplication, edge cases, regression, security/performance where relevant and repository conventions. Return to diagnosis if a material doubt remains.

Run pertinent unit/integration/E2E tests, lint, types, build, security checks and CI where accessible. Report `PASS`, `FAIL`, `BLOCKED` or `NOT RUN`; unrun is never passing. When permitted and available, independent review checks the diff, requirements, tests, architecture and regressions. Resolve findings and repeat affected checks.

Order checks from narrow to wide: targeted tests, affected package, lint/types, build, integration, repository-wide, runtime, UI. Compiling is not success.

## Runtime and UI validation

When the project has Compose or equivalent runtime definitions and it is practical, validate integrated behavior: validate the config, check required env without exposing secrets, check port conflicts, never destroy persistent development data, start the smallest stack first, then verify startup, health, dependency resolution, logs, migrations, API connectivity and frontend/backend communication. Run it from a dedicated validation session and tear down disposable containers and volumes afterwards.

For frontend changes with a browser tool available, verify that the target route renders, console and network are clean, loading/empty/error states, responsive layouts, keyboard navigation and basic accessibility; capture screenshots as evidence when they help review. Report `NOT RUN` when tooling is absent.
