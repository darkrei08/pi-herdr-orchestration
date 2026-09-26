# Verification and review

For reproducible bugs, prefer a meaningful failing regression check followed by a minimal fix and passing check. Use TDD when it adds evidence; avoid tests that merely mirror implementation.

Auto-grill cause versus symptom, assumptions, simpler alternatives, duplication, edge cases, regression, security/performance where relevant and repository conventions. Return to diagnosis if a material doubt remains.

Run pertinent unit/integration/E2E tests, lint, types, build, security checks and CI where accessible. Report `PASS`, `FAIL`, `BLOCKED` or `NOT RUN`; unrun is never passing. When permitted and available, independent review checks the diff, requirements, tests, architecture and regressions. Resolve findings and repeat affected checks.
