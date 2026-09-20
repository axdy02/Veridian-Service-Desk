# Primary technical references checked during preparation

These references justify technical choices only. They are NOT Veridian corporate policies.
Dependency packages could not be downloaded in the preparation sandbox, so Codex must verify
installed API compatibility and run the adapters, database and browser tests locally.

- LangGraph JavaScript graph/state/conditional routing:
  https://docs.langchain.com/oss/javascript/langgraph/graph-api
  https://docs.langchain.com/oss/javascript/langgraph/use-graph-api
  Annotation.Root is documented as supported; newer StateSchema is an alternative. Use one
  compatible approach rather than mixing examples from different package versions.
- Maintained Google integration:
  https://docs.langchain.com/oss/javascript/integrations/chat/google
  The documentation recommends @langchain/google / ChatGoogle for new integrations over
  legacy @langchain/google-genai. It documents structured output and standard tool support.
- Gemini 2.5 Flash model and lifecycle:
  https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
  https://ai.google.dev/gemini-api/docs/deprecations
  The model is documented as stable; the key's permissions/quota must still be tested.
- Next.js installation/platform requirements:
  https://nextjs.org/docs/app/getting-started/installation
- Node crypto password derivation/randomness/timing-safe comparison:
  https://nodejs.org/api/crypto.html
- Parameterized PostgreSQL client queries:
  https://node-postgres.com/features/queries
- PostgreSQL text search:
  https://www.postgresql.org/docs/current/textsearch-intro.html
- Express security practices:
  https://expressjs.com/en/advanced/best-practice-security/
- Docker Desktop license scope:
  https://docs.docker.com/subscription-billing/desktop-license/
  Personal/education use is free under the stated terms. Large-company professional use
  can require a subscription; supporting an existing PostgreSQL installation avoids
  requiring a reviewer to use Docker Desktop. No paid hosted platform is needed.
