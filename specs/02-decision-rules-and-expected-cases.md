# 02 - Source-grounded decisions and expected cases

## Source of truth and precedence
1. The uploaded assignment brief defines requested capabilities.
2. The uploaded Assignment 2 PDF defines the fictional policies, requests and queue.
3. JSON is a normalized transcription; source-manifest.json records original hashes and
   normalization choices. Page/section metadata must remain attached to every passage.
4. The deterministic kernel is an implementation of those sources, not a new policy source.
5. Gold fixtures are expected evaluation outcomes. They are never loaded by the production
   classifier to decide a case. IDs and employee names are not classification shortcuts.

There are **11 policy sources (10 KB entries + Asset Management extract)**, **15 requests**,
**10 existing queue records**, **4 active queue records**, **6 closed queue records**, hence
**19 actionable supplied cases**. Twenty-five total records does NOT mean 25 open cases.
Unknown source facts stay null. In particular, the existing ticket records do not include
email addresses, opening dates, review-start times, or the approving person's identity.
Never invent them to fill a database column or a UI table.

## Decision order
Closed-history gate -> safety signals -> required evidence completeness -> ongoing work
preservation -> validated language facts -> deterministic policy decision -> local write.
Security escalation takes precedence over routine troubleshooting. A missing policy
triggers clarification/human review, not a fabricated answer. The same applies to new
custom questions outside the supplied IT topics.

## Important distinctions
- `SELF_SERVICE` is a handling route, not proof a technical issue has been fixed.
- Guest Wi-Fi is informational: answer and audit it, but create NO formal IT ticket.
- Password reset, VPN renewal, mailbox archiving and initial printer steps wait for an
  employee confirmation. Only a matching safe pending-guidance case can then become
  `RESOLVED`, with a visible 'employee confirmed' basis.
- `NEEDS_INFO` records a case/conversation without an unnecessary escalated ticket.
- `HUMAN_REVIEW` creates or updates a LOCAL ticket and assigned queue; it cannot verify
  approvals or perform external IT actions.
- `CONTINUE_EXISTING` retains existing progress and updates context, not a second case.
- `HISTORY_ONLY` must not create messages, tickets or modify the source case. Viewing may
  create an access audit record, never an invented resolution event.

## Policy conflicts and gaps
For any laptop replacement question retrieve BOTH KB-03 and ASSET-01, even if only one
matched a text search. KB-03 has no update date; the Asset policy says Q2 2026. That does
not prove one document overrides the other. Do not invent a hierarchy, select a threshold
as authoritative, or promise delivery in an emergency exception that was never supplied.

A laptop reported dead is not a VERIFIED failure. A 2-year-old flickering laptop does not
become automatically replaceable. IT repair assessment is a safe application route, not
a troubleshooting recipe in the source. Do not invent a repair procedure.

Privileged/admin server access has no supplied authorization policy. TK-1050 is a closed
historical rejection with missing business justification, not a universal rejection rule.
KB-08 concerns the expense tool; it does not authorize access to a Finance server.

Employee statements that an approval exists are not verified approval records. Never
extract or accept `securityApproved`, `financeApproved`, `verifiedHardwareFailure` or
arbitrary permission flags from Gemini or browser form submissions.

## Existing work
Keep REQ-03's queued reset visible but explain that manual unlock is distinct. Keep REQ-04
and TK-1044 waiting on Security; keep REQ-06's assigned technician; keep REQ-12's waiting
for reply and do not automatically resend its screenshot request. Keep TK-1047 pending
Finance. REQ-08 and TK-1048 are existing Security escalations, not freshly resolved cases.
TK-1043 is approved AND ACTIVE pending fulfillment: preserve approval history, flag the
policy conflict and missing sign-off provenance before further fulfillment. Do not revoke,
reapprove or ship automatically.

## Dates and truthfulness
This is an all-data snapshot of 21-25 September 2026. Display that week as the EXERCISE
week. Do not use the actual system date to label source cases overdue, conceal later
records, or claim these are real-time support requests. Audit events use actual UTC
execution timestamps and can display in the browser's local time. No timezone or exact
review-start date was supplied. A 3-5-business-day policy duration is not an exact due date.

## Expected outcome matrix
The following expected decisions are interpretations of the supplied facts for this
prototype, not extra company policies. Their detailed acceptance notes are in JSON.

| Case | Reason code | Route | Evidence |
|---|---|---|---|
| REQ-01 | LAPTOP_POLICY_CONFLICT | IT_FINANCE | KB-03, ASSET-01 |
| REQ-02 | GUEST_WIFI_INFORMATION | - | KB-07 |
| REQ-03 | MANUAL_ACCOUNT_UNLOCK | IT | KB-01 |
| REQ-04 | SECURITY_REVIEW_ALREADY_PENDING | SECURITY | KB-04 |
| REQ-05 | VPN_RENEWAL_GUIDANCE | - | KB-02 |
| REQ-06 | TECHNICIAN_ALREADY_ASSIGNED | IT | KB-05 |
| REQ-07 | WFH_MANAGER_FINANCE_REQUIRED | MANAGER_FINANCE | KB-10 |
| REQ-08 | SECURITY_ESCALATION_ALREADY_OPEN | SECURITY | KB-09 |
| REQ-09 | MAILBOX_ARCHIVE_GUIDANCE | - | KB-06 |
| REQ-10 | PRIVILEGED_ACCESS_POLICY_GAP | IT | No governing KB / history only |
| REQ-11 | CONTRACTOR_VPN_MANAGER_APPROVAL | MANAGER | KB-02 |
| REQ-12 | EXPENSE_ACCOUNT_EXISTENCE_UNKNOWN | - | KB-08 |
| REQ-13 | LAPTOP_REPAIR_ASSESSMENT | IT | KB-03, ASSET-01 |
| REQ-14 | SOFTWARE_CATALOG_UNKNOWN | - | KB-04 |
| REQ-15 | ISSUE_UNCLEAR | - | No governing KB / history only |
| TK-1042 | CLOSED_HISTORY_ONLY | - | No governing KB / history only |
| TK-1043 | APPROVED_FULFILLMENT_CONFLICT | IT_FINANCE | KB-03, ASSET-01 |
| TK-1044 | SECURITY_REVIEW_ALREADY_PENDING | SECURITY | KB-04 |
| TK-1045 | CLOSED_HISTORY_ONLY | - | No governing KB / history only |
| TK-1046 | CLOSED_HISTORY_ONLY | - | No governing KB / history only |
| TK-1047 | FINANCE_REVIEW_ALREADY_PENDING | FINANCE | KB-10 |
| TK-1048 | SECURITY_ESCALATION_ALREADY_OPEN | SECURITY | KB-09 |
| TK-1049 | CLOSED_HISTORY_ONLY | - | No governing KB / history only |
| TK-1050 | CLOSED_HISTORY_ONLY | - | No governing KB / history only |
| TK-1051 | CLOSED_HISTORY_ONLY | - | No governing KB / history only |

## Record-specific notes

**REQ-01**: Unverified dead laptop, age 3.5 years. Surface both conflicting sources, verify failure/approvals through human review, no guessed policy precedence or delivery promise.

**REQ-02**: Answer the guest-access question; create an audit/interaction record but no formal service ticket. Credentials are not actually generated.

**REQ-03**: Keep reset-queued progress visible. Manual IT unlock remains necessary; no automated unlock or repeated password-guess advice.

**REQ-04**: Keep existing Security review; 3-5 business days is a policy duration, not an inferred deadline.

**REQ-05**: Provide employee renewal guidance; wait for confirmation before calling the technical issue resolved.

**REQ-06**: Keep the assigned technician; do not restart the entire workflow or claim troubleshooting steps have happened.

**REQ-07**: 4 days meets frequency threshold. One-time use and manager/Finance approvals are not established. No invented allowance amount.

**REQ-08**: Immediately stop forwarding, advise the supplied Security address, retain existing escalation. No real outbound email.

**REQ-09**: Archive first; do not infer actual quota or grant an increase. Manager sign-off and 50GB cap for increases.

**REQ-10**: No admin-access policy exists in the pack. Human IT review; historical rejection TK-1050 is context only. Urgency is not authority.

**REQ-11**: Contractor VPN needs manager approval through the access request form; no invented URL.

**REQ-12**: Retain the unanswered screenshot request, do not repeat it automatically. Existing account versus provisioning remains unknown; clarify.

**REQ-13**: IT assessment before replacement; flickering and age 2 years do not prove verified hardware failure. Do not offer an invented repair procedure.

**REQ-14**: Catalog membership and exact extension identity unknown. Ask before choosing self-install versus Security review.

**REQ-15**: Ask affected service and observed error. No made-up category, policy or confidence percentage.

**TK-1042**: Closed history only. No mutation, reopening, duplicate ticket, model call or generated resolution.

**TK-1043**: Approved is not closed here. Keep pending fulfillment and approval history, flag 3.2-year policy conflict and verify sign-off provenance; neither ship nor revoke approval.

**TK-1044**: Active existing Security review; preserve and route, no duplicate review.

**TK-1045**: Closed history only. No mutation, reopening, duplicate ticket, model call or generated resolution.

**TK-1046**: Closed history only. No mutation, reopening, duplicate ticket, model call or generated resolution.

**TK-1047**: Active pending Finance, not approved or shipped; keep status.

**TK-1048**: Active Security investigation, not resolved; keep escalation open.

**TK-1049**: Closed history only. No mutation, reopening, duplicate ticket, model call or generated resolution.

**TK-1050**: Closed history only. No mutation, reopening, duplicate ticket, model call or generated resolution.

**TK-1051**: Closed history only. No mutation, reopening, duplicate ticket, model call or generated resolution.
