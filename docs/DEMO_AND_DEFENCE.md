# Demo and defence preparation (no presentation generation)

## Suggested 5-6 minute recorded product walkthrough
This duration is a suggested recording structure, not an imposed assignment video length.
The brief separately requires a 15-minute demo/defence after submission and an openly
accessible demo video. Keep all keys/passwords and terminal secret files out of the recording.

0:00-0:40: State the problem. Log in or sign up. Show the clearly labelled fictional workspace,
source week, 15 requests, four active queue cases and six closed historical tickets.
0:40-1:20: REQ-02 guest Wi-Fi: source KB-07, useful kiosk/24-hour response, no formal ticket.
Show persisted response and source evidence. Explain why answering is not credential issuance.
1:20-2:10: REQ-01 dead 3.5-year laptop: both sources, contradiction, human IT/Finance review.
Explain why neither a later date nor an unverified hardware failure automatically settles it.
2:10-2:50: REQ-08 phishing: stop forwarding, supplied Security address, existing escalation
preserved, local audit. Explicitly say no real Security email is sent by this prototype.
2:50-3:40: REQ-14 extension: unknown catalog membership -> question -> 'not in the catalog'
-> Security review. Show conversation persistence and one unique local ticket.
3:40-4:20: TK-1043: approved but active pending fulfillment; preserve status and verify sign-offs
against the conflict. Contrast TK-1045: closed approved quota history, no new action.
4:20-5:10: Trace/audit and logout/new-account isolation. Show actual Gemini mode when available;
do not call an offline run 'live AI'. Show the checks/test report, not a made-up success metric.
5:10-5:40: Architecture summary and limitations. Link the GitHub project and explain local setup.

## 15-minute defence outline
2 minutes: business problem and scope; 3 minutes: product demonstrations; 3 minutes:
architecture/data/action boundaries; 3 minutes: tricky policies and tests; 2 minutes:
failures/security; 2 minutes: questions and honest limitations.

## Questions and defensible answers
**Why LangGraph?** Explicit graph state and branches make the flow understandable and testable.
The model is used for language extraction; the graph routes clarification, guidance and review.
It is not decoration, but it is also not a swarm of autonomous agents.

**Why not a vector database?** There are 11 short policy passages. A complete mapping and
PostgreSQL browsing search make recall deterministic, especially the conflict pair. Extra
embedding infrastructure would add setup and failure paths without being required here.

**How is this different from one prompt over a PDF?** Validated facts, required evidence,
deterministic policy boundaries, preserved state, idempotent local ticket writes and audit.

**Does the model approve access?** No. It cannot supply verified-approval fields or call an
arbitrary write tool. The server decides only allowed local actions; privileged changes go
to a human and are not actually executed against corporate systems.

**What happens with contradictory sources?** Show both, do not invent authority precedence,
and hand off. TK-1043's historical approval remains recorded, without proving all sign-offs.

**How do follow-ups work?** Facts and conversation are stored in PostgreSQL. Each user turn
runs the bounded graph using saved context. This is not claimed to be a LangGraph checkpoint.

**What if Gemini fails?** Visible fallback mode, conservative keyword interpretation and the
same policy kernel. Unknown information stays unknown. A failed database write never appears
as a saved ticket. Offline mode is not presented as equivalent language capability.

**What do your tests prove?** Core rules and named edge cases; plus the exact implemented
integration/browser checks in the real test report. They do not prove production security,
all possible natural-language inputs or real external IT execution.

**Why must guests not get a ticket?** KB-07 explicitly says no IT ticket required. Auditability
is provided by an interaction/case record rather than violating that business instruction.

**What was AI-assisted?** Explain the actual planning, reference-code and implementation work
from AI_USAGE_TEMPLATE.md. Demonstrate understanding of the code rather than hiding tool use.
