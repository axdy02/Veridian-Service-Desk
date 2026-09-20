# Veridian Service Desk - implementation handoff

Prepared for **Ansh Kapoor**, AIONOS round-two Assignment 2.

## What this pack is
This is a **tested policy/auth reference core plus a detailed Codex build specification**.
It is NOT the finished web application. Codex still implements and verifies the UI,
Express/PostgreSQL integration, session lifecycle and LangGraph/Gemini adapters.

## Use
1. Extract this pack into your NEW project folder. Keep its directories together.
2. Open that folder in Codex. Do not use the FloodReady folder.
3. Give Codex the text in CODEX_PROMPT.md, or the short launcher below.
4. Put a Gemini key ONLY in the local ignored .env when created. Do not paste it into chat.
5. Codex must implement and verify the app; inspect its real test report before recording.

Short launcher:
```
Implement the application specified in CODEX_PROMPT.md in this folder. The source data,
tested reference core, integration templates and detailed specifications are already here.
Read the prompt and specs, then implement, run tests and browser checks, fix failures, and
report verified results. Preserve source-grounded logic, do not create a presentation,
do not deploy or push to a remote, and do not expose secrets. Do not stop at a plan.
```

## Main contents
- CODEX_PROMPT.md: complete implementation instruction.
- data/: 11 sources, 15 requests, 10 queue records, source provenance, 25 gold fixtures.
- reference-core/: executable policy engine, safe fact normalization, fallback classifier,
  password/session helpers, declarations, 72 local tests and fixture display script.
- integration-templates/: real LangGraph/Gemini adapter patterns and PostgreSQL migration.
- specs/: seven detailed architecture/logic/API/UI/security/test specifications.
- docs/: assumptions, source notes, demo/defence script and honest test report.
- private-handoff/: credentials TEMPLATE only. The finished setup generates actual private
  local credentials in ignored private/REVIEWER_CREDENTIALS.txt.
- assignment-source/: the two original relevant assessment documents, unchanged.

## Tests already run
From this pack's folder, without installing any dependencies:
```
node --test reference-core/engine.test.mjs reference-core/auth.test.mjs
node reference-core/run-fixtures.mjs
```
Preparation result: 72 tests passed on Node 22.16.0. Full app/browser/database/live Gemini
verification has NOT occurred here. See docs/PREPARATION_TEST_REPORT.md for limitations.

## Delivery
Code is GitHub-first and local-running, no paid host. A reviewer still needs Node and
Docker/local PostgreSQL, then the documented setup command. No Gemini key is committed;
keyless rule-based mode is visibly distinguished from the genuine live-Gemini mode.
The original brief's demo/video/defence requirements still apply. Presentation work is
intentionally excluded from the coding task.
