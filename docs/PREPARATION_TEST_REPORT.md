# Preparation test report

Status: reference-core verification only. The full application has not been built in this pack.

Environment: Node.js v22.16.0; npm 10.9.2; TypeScript 5.8.3; Linux preparation container.
Original assignment files were copied unchanged; SHA-256 hashes are in data/source-manifest.json.

## Executed successfully

```
node --test reference-core/engine.test.mjs reference-core/auth.test.mjs
```
Result: 72 tests, 72 passed, 0 failed, 0 skipped. Last recorded duration: approximately 922 ms.
This includes all 25 source-record fixtures (19 actionable plus 6 closed-history records),
policy-boundary/missing-evidence/fact-validation tests and five password/session tests.

```
node reference-core/run-fixtures.mjs
node --check reference-core/engine.mjs
node --check reference-core/auth.mjs
tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext reference-core/engine.d.mts reference-core/auth.d.mts
```
Result: fixture output produced; JavaScript syntax checks passed; declaration files typechecked.
The raw test and fixture outputs are bundled in docs for reproducibility.

## Not run here

- PostgreSQL migration execution and application/database integration tests.
- Installation/compilation/execution of LangGraph and ChatGoogle integration templates.
- A live Gemini request. No user API key was supplied to this environment.
- Next.js/Express application typecheck, build, lint, HTTP API or browser tests.
- Local Windows setup scripts; these remain part of the Codex implementation task.

The preparation container could not resolve registry.npmjs.org, so external dependency
installation was unavailable. This limitation did not affect the dependency-free kernel tests.
Official framework documentation was checked using web research, but documentation inspection
is not a substitute for executing the actual integration.

## What these results do and do not establish

They establish that the prepared deterministic core handles the named supplied records and
tested boundaries according to its explicit expected outcomes, and that the auth primitives
pass the included checks. They do not establish that a complete web app exists, all possible
language inputs are handled, an API key is valid, the SQL migration runs unchanged, or the
final project is bug-free or production-ready. Codex must produce its own actual end-to-end
TEST_REPORT.md after implementing the remaining layers.
