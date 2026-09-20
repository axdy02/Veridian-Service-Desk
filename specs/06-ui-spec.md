# 06 - Visual and interaction specification

## Direction: quiet operational software
No blue/cyan/purple palette, neon, gradients, glassmorphism, floating AI orbs, sparkles,
fake productivity charts, giant marketing headings, random percentages or animated robot.
No landing-page work. Prioritize a usable service desk. Name: **Veridian Service Desk**.
Author credit can appear in About/README, not as a huge hero banner.

Suggested tokens (verify text contrast in browser):
- page: #F7F5F0, surfaces: #FFFEFA
- text: #24201D, secondary text: #6E645B
- border: #DDD5CB, muted fill: #F0ECE5
- primary/action: #9A3F22 (burnt rust) with white text
- success: #506246 (olive); warning: #8A5A1F; critical: #9D352D
- focus outline: clearly visible dark rust; never color-only status meaning
System font stack: Segoe UI, system-ui, Arial, sans-serif. Optional Georgia only for a small
wordmark. No build-time Google Font downloads, external images or asset subscriptions.
Use simple line icons where helpful, labelled buttons, clean tables, restrained 6-10px
corners, 1px borders and very subtle shadows. Keep animation under 150ms; respect reduced motion.

## Auth screens
A compact centered login/signup card on the warm background. Show product name, a one-line
'Private assessment sandbox' description and a switch between signup/login. Signup has name,
email, password, show-password toggle, visible 12-character guidance, inline validation,
loading and correct error states. Enter submits. Never show a fake 'forgot password' link.
After signup, create and load the user's seeded workspace and show all source records.

## App shell
Desktop sidebar ~224px: Inbox, Tickets, Knowledge, Audit, Settings. Main header includes
page title, authenticated user menu, and real mode badge (Gemini / Offline / Fallback).
Small source-week banner: 'Assessment dataset: 21-25 Sep 2026 - fictional Veridian Corp'.
On smaller screens sidebar becomes accessible drawer; detail layout stacks without clipping.

### Inbox/dashboard
Real count cards: 15 source requests, 4 active source tickets, 6 closed historical tickets,
and current processed/pending counts computed from the workspace. Do not call source cases
'AI resolved' before running anything. Search/filter by type/current state. Source ID,
request summary, employee name, source date or 'Not provided', current status. Clear rows
for all 25 cases; filter actionable/history rather than silently dropping closed records.
A New request button opens a text form; no image/file upload requirement.

### Case detail (the main demonstration)
Two columns on desktop: ~60% conversation/record, ~40% evidence/decision.
Left: original employee text, immutable source ID/date/status, current state, conversation,
input box and Run analysis/Send follow-up. No auto-run on every page render or refresh.
Right: decision label, grounded explanation, necessary questions, current route, local ticket
link if any, warnings/conflicts, clickable source cards. A visible policy-conflict callout
shows KB-03 and ASSET-01 side by side. Unknown source authority reads 'No governing policy
supplied'; historical sources have a separate History badge.

Run button disables during execution. Show actual elapsed loading state, not a staged fake
checklist. Optional run polling uses stored real events. Completed trace expands to show
actual nodes, source IDs, durations and local ticket operations. Do not label this 'chain of
thought' or display hidden reasoning. Refresh restores messages/current status from PostgreSQL.

Closed case view shows 'Historical record - no action required'; analysis and mutations are
disabled and server-enforced. In-progress cases show their existing progress, not 'Not started'.
Success messages distinguish 'guidance recorded', 'local handoff created', and 'employee
confirmed resolution'. A small fixed notice says no external account changes/emails occur.

### Tickets
Existing TK-104x records retain source IDs; generated VDS IDs are clearly local. Open/history
filters, owner queue, state, source evidence and case link. Do not imply a manager signed an
approval by changing only a badge. No arbitrary approve/reject/ship buttons.

### Knowledge
All 11 source passages, title, exact normalized text, page/section and source filename. Search
works through PostgreSQL. Conflict cross-link on both laptop documents. No fake download link
or invented self-service portal URL. Source PDF can be served as a local read-only static file
if bundled; otherwise citation panel alone is sufficient and has no broken button.

### Audit
Chronological actual events, ordered by sequence ID, filter by case/run. Expand a safe payload;
show no secrets or private model thoughts. Distinguish original source status from observed
application transitions. Loading/empty/error states must be designed, not raw JSON blobs.

### Settings
Read-only runtime model name/mode, source version, local-only limitation, About/author and
logout. No API-key entry field in a browser persisted to localStorage. Point to ignored .env
for server setup. No paid-account links or telemetry toggle pretending to work.

## Browser acceptance
Check 1440x900 and 390x844 viewports. Keyboard navigation, visible focus, form labels,
aria-expanded for details, readable status text, no horizontal page overflow and no console
errors. Long employee messages/source titles wrap. All visible buttons and navigation work.
No broken placeholder pages. No random mock data outside the supplied and reviewer-created data.
