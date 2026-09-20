# AI tools used - complete accurately after implementation

**Author and accountable developer:** Ansh Kapoor.

- ChatGPT: interpreted the supplied assessment, helped define architecture and source-grounded
  policy decisions, prepared normalized data, reference policy/auth code, tests and the Codex
  build specification. The supplied source documents remain the business source of truth.
- Codex: implementer assistance for the application and integration work. Record the model
  configuration actually selected, major tasks it performed, and which tests it actually ran.
  Do not assert a model identity or capability that was not observed.
- Gemini API: runtime language-to-structured-facts extraction. Record the actual configured
  model and live smoke-test status from the completed project. Rules and authorization are
  enforced by application code, not invented by the model.
- LangGraph/LangChain: orchestration/integration libraries, not extra independent agents or
  AI coding tools. No paid LangSmith account is required.

Ansh must review and be able to explain the submitted code and its limitations during the
15-minute defence. Do not claim all code was manually written or that unrun tests passed.
