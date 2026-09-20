# AI tools used - completed disclosure

**Author and accountable developer:** Ansh Kapoor.

- **ChatGPT:** interpreted the supplied assessment, helped define the architecture and the
  source-grounded policy decisions, prepared the normalized data, the reference policy/auth
  kernel, its 72 tests, and the Codex build specification (this pack). The supplied source
  documents remain the business source of truth.
- **Codex (user-selected configuration):** implemented the application and integration work
  in this repository: the Express/PostgreSQL API, the LangGraph workflow with the offline
  and Gemini extractors, the Next.js interface, the Docker setup, and the local scripts.
  The exact model identity is whatever configuration Ansh selected in Codex; no model
  capability is claimed beyond the work visible in the code and the test report.
- **Codebuff (Buffy agent):** completed the remaining verification and repair work after the
  Codex build: fixed the web typecheck errors, created the missing application stylesheet
  to the specs/06 design tokens, repaired the root `.env` loading for local development,
  fixed the inbox filter parameter wiring, made the API rate limits configurable for the
  e2e environment, and produced the integration and browser test suites, the verification
  report and the documentation. All claims in `docs/TEST_REPORT.md` come from commands that
  were actually executed in this repository.
- **Gemini API (runtime, optional):** language-to-structured-facts extraction when a server
  key is configured. In this verification run no key was present, so the workflow ran in
  the labelled offline mode and **no live Gemini request was made**. Rules and authorization
  are enforced by application code, not invented by the model.
- **LangGraph/LangChain:** orchestration/integration libraries, not extra independent agents
  or AI coding tools. No paid LangSmith account is required.

Ansh must review and be able to explain the submitted code and its limitations during the
15-minute defence. No test was claimed to pass without being run, and no tool claimed work
it did not do.
