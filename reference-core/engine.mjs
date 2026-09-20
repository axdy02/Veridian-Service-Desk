/**
 * Veridian Service Desk - dependency-free policy kernel.
 * Source rules: supplied Assignment 2 data pack only.
 * Application states/routing labels are implementation choices, not company policies.
 * This module does not call Gemini, mutate a database, or perform external IT actions.
 */
export const CATEGORIES = Object.freeze(['PASSWORD','VPN','LAPTOP','SOFTWARE','PRINTER','MAILBOX','GUEST_WIFI','EXPENSE','SECURITY','WFH','PRIVILEGED_ACCESS','UNKNOWN']);
export const POLICY_IDS = Object.freeze(['KB-01','KB-02','KB-03','KB-04','KB-05','KB-06','KB-07','KB-08','KB-09','KB-10','ASSET-01']);
const POLICY_MAP = Object.freeze({PASSWORD:['KB-01'],VPN:['KB-02'],LAPTOP:['KB-03','ASSET-01'],SOFTWARE:['KB-04'],PRINTER:['KB-05'],MAILBOX:['KB-06'],GUEST_WIFI:['KB-07'],EXPENSE:['KB-08'],SECURITY:['KB-09'],WFH:['KB-10'],PRIVILEGED_ACCESS:[],UNKNOWN:[]});
const NUMERIC_BOUNDS = {failedAttempts:[0,1000],laptopAgeYears:[0,100],wfhDays:[0,7],requestedQuotaGb:[0,100000]};
const BOOLEAN_FIELDS = ['lockedOut','wantsReplacement','queueChecked','spoolerRestarted','persists','allowancePreviouslyUsed','wantsQuotaIncrease','expenseAccountExists','problemResolved'];
const ENUM_FIELDS = {vpnIssue:['expired','new_access','other'],employmentType:['full_time','contractor'],laptopSymptom:['dead','flickering','other'],catalogStatus:['approved','not_catalog','unknown']};
const STRING_FIELDS = ['softwareName','assetTag'];
export const FACT_FIELDS = Object.freeze([...Object.keys(NUMERIC_BOUNDS),...BOOLEAN_FIELDS,...Object.keys(ENUM_FIELDS),...STRING_FIELDS]);

export function requiredPolicies(category) { return [...(POLICY_MAP[category] ?? [])]; }
export function normalizeFacts(input = {}) {
  const out = {category:CATEGORIES.includes(input.category) ? input.category : 'UNKNOWN'};
  for (const [k,[min,max]] of Object.entries(NUMERIC_BOUNDS)) {
    const v=input[k]; if (typeof v==='number' && Number.isFinite(v) && v>=min && v<=max) out[k]=v;
  }
  for (const k of BOOLEAN_FIELDS) if(typeof input[k]==='boolean') out[k]=input[k];
  for(const [k,allowed] of Object.entries(ENUM_FIELDS)) if(allowed.includes(input[k])) out[k]=input[k];
  for(const k of STRING_FIELDS) if(typeof input[k]==='string' && input[k].trim().length>0 && input[k].length<=160) out[k]=input[k].trim();
  return out;
}
/** Evidence membership is necessary, not sufficient to prove semantic truth. The LLM never supplies approvals. */
export function validateExtraction(extraction, evidenceTexts, previous = {}) {
  const texts = Array.isArray(evidenceTexts) ? evidenceTexts : [];
  const evidence = new Map();
  for(const row of extraction?.evidence ?? []) {
    if(row && typeof row.field==='string' && typeof row.quote==='string' && row.quote.trim().length>0 && texts.some(t=>typeof t==='string' && t.includes(row.quote))) evidence.set(row.field,row.quote);
  }
  const raw = normalizeFacts(extraction?.facts ?? {});
  const accepted = normalizeFacts(previous);
  if(evidence.has('category')) accepted.category=raw.category;
  for(const key of FACT_FIELDS) if(evidence.has(key) && Object.hasOwn(raw,key)) accepted[key]=raw[key];
  const defensive = inferOffline(texts.join('\n'),previous);
  if(['SECURITY','PRIVILEGED_ACCESS'].includes(defensive.category)) accepted.category=defensive.category;
  // A clearly stated lockout or 5+ attempts must not be downgraded by an extraction.
  if(defensive.category==='PASSWORD' && (defensive.lockedOut || defensive.failedAttempts>=5)) {
    accepted.category='PASSWORD';
    if(defensive.lockedOut) accepted.lockedOut=true;
    if(defensive.failedAttempts!==undefined) accepted.failedAttempts=defensive.failedAttempts;
  }
  return {facts:normalizeFacts(accepted),acceptedEvidence:[...evidence].filter(([k])=>k==='category'||FACT_FIELDS.includes(k)).map(([field,quote])=>({field,quote}))};
}

/**
 * Explicitly labelled non-LLM fallback; keyword coverage is limited.
 * It operates on wording, not REQ/TK IDs and never reads golden expected outcomes.
 * Caller supplies original issue + latest relevant user turns and previous validated facts.
 */
export function inferOffline(text, previous = {}) {
  const f=normalizeFacts(previous); const s=String(text ?? '').toLowerCase();
  if(/phish|malware|unauthori[sz]ed access/.test(s)) f.category='SECURITY';
  else if(/\badmin\s+(access|privilege)|privileged access|root access/.test(s)) f.category='PRIVILEGED_ACCESS';
  else if(/\bguest\b/.test(s) && /wi[ -]?fi/.test(s)) f.category='GUEST_WIFI';
  else if(/\bvpn\b/.test(s)) f.category='VPN';
  else if(/expense (tool|software|management)|expense.*(log.?in|credential)/.test(s)) f.category='EXPENSE';
  else if(/home office|working from home|work.from.home|\bwfh\b/.test(s)) f.category='WFH';
  else if(/\blaptop\b|screen.*flicker/.test(s)) f.category='LAPTOP';
  else if(/\bprinter\b|print spooler/.test(s)) f.category='PRINTER';
  else if(/mailbox|mail quota/.test(s)) f.category='MAILBOX';
  else if(/software|browser extension|install.*(tool|extension)/.test(s)) f.category='SOFTWARE';
  else if(/password|locked out|account lockout/.test(s)) f.category='PASSWORD';
  if(/locked out|account lockout/.test(s)) f.lockedOut=true;
  const attempts=s.match(/(?:password|tried|attempts?)[^\n.]{0,35}?\b(\d+)\s*(?:times|attempts?)/) || s.match(/\b(\d+) failed attempts?/);
  if(attempts) f.failedAttempts=Number(attempts[1]);
  if(/six (times|attempts)/.test(s)) f.failedAttempts=6;
  if(/five (times|attempts)/.test(s)) f.failedAttempts=5;
  if(f.category==='VPN') {
    if(/expir/.test(s)) f.vpnIssue='expired';
    else if(/new|joining|need.*access/.test(s)) f.vpnIssue='new_access';
    if(/contractor/.test(s)) f.employmentType='contractor';
    else if(/full[ -]time/.test(s)) f.employmentType='full_time';
  }
  const age=s.match(/(?:about\s+|had it\s+|\()(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
  if(age) f.laptopAgeYears=Number(age[1]);
  if(/flicker/.test(s)) f.laptopSymptom='flickering';
  if(/completely dead|won.t turn on/.test(s)) f.laptopSymptom='dead';
  if(/not (?:a )?replacement/.test(s)) f.wantsReplacement=false;
  else if(/replacement|replace/.test(s)) f.wantsReplacement=true;
  if(/non.catalog|not (?:in )?the (?:software )?catalog|not listed/.test(s)) f.catalogStatus='not_catalog';
  else if(/listed in (?:the )?(?:approved )?catalog|in the approved catalog/.test(s)) f.catalogStatus='approved';
  const days=s.match(/(?:home|remote(?:ly)?|wfh)\s+(\d+)\s*days?/);
  if(days) f.wfhDays=Number(days[1]);
  if(/already used.*allowance/.test(s)) f.allowancePreviouslyUsed=true;
  if(/quota increase|increase.*(?:quota|mailbox)|mailbox.*increase/.test(s)) f.wantsQuotaIncrease=true;
  const quota=s.match(/(?:to|want|need|request(?:ing)?)\s*(\d+)\s*gb/);
  if(quota) {f.requestedQuotaGb=Number(quota[1]);f.wantsQuotaIncrease=true;}
  if(/checked (?:the )?(?:printer )?queue/.test(s)) f.queueChecked=true;
  if(/restart(?:ed)? (?:the )?(?:print )?spooler/.test(s)) f.spoolerRestarted=true;
  if(/still.*(?:jam|not working)|persists/.test(s)) f.persists=true;
  const tag=s.match(/asset tag[:\s]+([a-z0-9-]+)/i); if(tag) f.assetTag=tag[1];
  if(/account (?:already )?exists|already have an? (?:expense )?account/.test(s)) f.expenseAccountExists=true;
  if(/no (?:expense )?account|account.*not.*(?:created|provisioned)/.test(s)) f.expenseAccountExists=false;
  if(/(?:it is|it's|its) working now|that fixed it|issue is resolved/.test(s)) f.problemResolved=true;
  return normalizeFacts(f);
}

function outcome(f, reasonCode, disposition, route, lifecycle, message, extra={}) {
  return {category:f.category,reasonCode,disposition,route,lifecycle,sourceIds:requiredPolicies(f.category),historySourceIds:[],messages:[message],questions:[],conflicts:[],warnings:[],serviceTicketRequired:disposition==='HUMAN_REVIEW'||disposition==='CONTINUE_EXISTING',externalActionExecuted:false,...extra};
}
function conflict(){return {sourceIds:['KB-03','ASSET-01'],description:'KB-03 states a 3-year laptop replacement eligibility threshold; the Asset Management Policy specifies a 4-year hardware refresh cycle and Finance plus IT approval for early replacement. No precedence is supplied.'};}
function priorPolicyAction(caseRecord, f) {
  const st=caseRecord.workState;
  if(st==='PENDING_FULFILLMENT' && f.category==='LAPTOP') return outcome(f,'APPROVED_FULFILLMENT_CONFLICT','CONTINUE_EXISTING','IT_FINANCE','PENDING_FULFILLMENT','This ticket is already approved and awaiting fulfillment. Keep that recorded status. Before any further fulfillment, an IT/Finance reviewer should verify the approval basis and the conflicting refresh policies; the data does not establish the required sign-offs.',{conflicts:[conflict()],warnings:['Do not revoke the recorded approval or mark the item delivered.']});
  if(st==='WAITING_SECURITY' && f.category==='SOFTWARE') return outcome(f,'SECURITY_REVIEW_ALREADY_PENDING','CONTINUE_EXISTING','SECURITY','WAITING_SECURITY','Security review is already pending. Keep this case in that queue; do not submit a duplicate approval. KB-04 gives a 3-5 business-day review duration, but the actual review start date is not supplied.',{warnings:['No exact approval date or installation permission can be inferred.']});
  if(st==='WAITING_FINANCE' && f.category==='WFH') return outcome(f,'FINANCE_REVIEW_ALREADY_PENDING','CONTINUE_EXISTING','FINANCE','WAITING_FINANCE','Finance processing is already pending. Preserve that status. KB-10 requires manager sign-off and Finance processing; IT shipping comes only after approval. The record does not show approval or shipment.',{warnings:['Do not invent manager sign-off or mark equipment shipped.']});
  if(st==='INVESTIGATING' && f.category==='PRINTER') return outcome(f,'TECHNICIAN_ALREADY_ASSIGNED','CONTINUE_EXISTING','IT','INVESTIGATING','A technician is already assigned. Preserve the investigation. KB-05 calls for checking the queue and restarting the print spooler, then recording a persistent issue with the printer asset tag. Do not assume those steps were performed or duplicate the existing investigation.');
  return null;
}
export function decide(caseRecord, inputFacts, options={}) {
  const f=normalizeFacts(inputFacts);
  if(caseRecord.active===false || caseRecord.workState==='CLOSED') return outcome(f,'CLOSED_HISTORY_ONLY','HISTORY_ONLY',null,'CLOSED','This is a closed historical record. It is retained for context only; no new action or reopening is permitted.',{sourceIds:[],historySourceIds:[caseRecord.id],serviceTicketRequired:false});
  const available=options.availablePolicyIds ?? POLICY_IDS;
  const required=requiredPolicies(f.category);
  if(required.some(id=>!available.includes(id))) return outcome(f,'POLICY_EVIDENCE_MISSING','HUMAN_REVIEW','IT','HUMAN_REVIEW','The required source evidence is unavailable. A human must review the request; no policy-dependent action was performed.',{sourceIds:required.filter(id=>available.includes(id)),warnings:['Required policy evidence is missing.']});
  if(f.category==='SECURITY') {
    const already=['SECURITY_ESCALATED','SECURITY_INVESTIGATION'].includes(caseRecord.workState);
    return outcome(f,already?'SECURITY_ESCALATION_ALREADY_OPEN':'SECURITY_ESCALATE_IMMEDIATELY',already?'CONTINUE_EXISTING':'HUMAN_REVIEW','SECURITY',already?caseRecord.workState:'SECURITY_ESCALATED','Stop forwarding the suspected message to teammates. KB-09 requires immediate reporting to security@veridian-corp.example. '+(already?'The source record already shows an open Security escalation; retain it.':'Route this case to Security without delaying for additional questions.'),{warnings:['This assessment records the escalation locally only. No real email was sent.']});
  }
  const ongoing=priorPolicyAction(caseRecord,f);if(ongoing)return ongoing;
  const confirmable=['PASSWORD_RESET_SELF_SERVICE','VPN_RENEWAL_GUIDANCE','MAILBOX_ARCHIVE_GUIDANCE','PRINTER_SELF_SERVICE'];
  if(f.problemResolved===true && caseRecord.workState==='AWAITING_CONFIRMATION' && confirmable.includes(caseRecord.lastReasonCode)) return outcome(f,'EMPLOYEE_CONFIRMED_RESOLUTION','SELF_SERVICE',null,'RESOLVED','The employee confirmed that the issue is resolved. Record that confirmation in this local case; this is not an externally verified IT action.',{serviceTicketRequired:false});
  switch(f.category) {
    case 'GUEST_WIFI': return outcome(f,'GUEST_WIFI_INFORMATION','SELF_SERVICE',null,'ANSWERED','Any employee can generate guest Wi-Fi credentials at the front-desk kiosk. They are valid for 24 hours. No IT ticket is required.',{serviceTicketRequired:false});
    case 'PASSWORD':
      if(f.lockedOut===true || (f.failedAttempts??0)>=5) return outcome(f,'MANUAL_ACCOUNT_UNLOCK','HUMAN_REVIEW','IT',caseRecord.workState==='IN_PROGRESS'?'IN_PROGRESS':'HUMAN_REVIEW','An account locked after five failed attempts requires IT to unlock it manually. No approval is required. '+(caseRecord.workState==='IN_PROGRESS'?'A reset is already queued, but the record does not show a completed manual unlock. Preserve the work in progress and record that IT must check the unlock.':'Create a local IT handoff; do not claim the account has been unlocked.'),{warnings:['A password reset and a manual account unlock are not interchangeable.']});
      return outcome(f,'PASSWORD_RESET_SELF_SERVICE','SELF_SERVICE',null,'AWAITING_CONFIRMATION','Use the self-service portal to reset your password. If you are locked out after five failed attempts, IT must unlock the account manually. No approval is required.',{questions:['Did the self-service reset resolve the issue?'],serviceTicketRequired:false});
    case 'VPN':
      if(f.vpnIssue==='expired') return outcome(f,'VPN_RENEWAL_GUIDANCE','SELF_SERVICE',null,'AWAITING_CONFIRMATION','VPN credentials expire every 90 days and must be renewed by the employee. Please renew the expired credentials; the data pack does not provide a renewal URL.',{questions:['After renewal, can you connect to the VPN?'],serviceTicketRequired:false});
      if(f.employmentType==='contractor') return outcome(f,'CONTRACTOR_VPN_MANAGER_APPROVAL','HUMAN_REVIEW','MANAGER','WAITING_APPROVAL','A contractor needs manager approval submitted through the access request form for VPN access. No form URL is supplied, and this agent cannot grant access.');
      if(f.employmentType==='full_time') return outcome(f,'FULL_TIME_VPN_POLICY','SELF_SERVICE',null,'ANSWERED','KB-02 says VPN access is granted automatically to full-time employees. This describes the policy; this prototype has not provisioned or verified actual VPN access.',{serviceTicketRequired:false});
      return outcome(f,'VPN_TYPE_UNCLEAR','NEEDS_INFO',null,'AWAITING_EMPLOYEE','The next step depends on whether this is expired access or a new access request.',{questions:['Are your VPN credentials expired, or do you need access for the first time?','For new access, are you a full-time employee or a contractor?'],serviceTicketRequired:false});
    case 'LAPTOP': {
      const replacement=(f.wantsReplacement===true||f.laptopSymptom==='dead'||(f.laptopAgeYears??0)>=3);
      if(replacement) return outcome(f,'LAPTOP_POLICY_CONFLICT','HUMAN_REVIEW','IT_FINANCE','HUMAN_REVIEW','The laptop policies conflict: KB-03 gives 3-year eligibility and early replacement for verified failure, while the Asset Management Policy uses a 4-year refresh cycle and requires Finance plus IT approval for early replacement. A reported failure is not a verified failure. Route the decision to human IT/Finance review; do not approve or reject replacement automatically.',{conflicts:[conflict()],warnings:['KB-03 also requires requests at least 2 weeks ahead of intended replacement. The sources do not specify an emergency waiver. No replacement date is promised.']});
      return outcome(f,'LAPTOP_REPAIR_ASSESSMENT','HUMAN_REVIEW','IT','HUMAN_REVIEW','Arrange an IT assessment of the reported laptop fault. A flickering screen is not evidence of a verified hardware failure and does not justify automatic replacement. If replacement is proposed, both laptop policies and their approval requirements must be reviewed.',{warnings:['Repair-first assessment is an application routing choice, not a repair procedure specified in the data pack.']});
    }
    case 'SOFTWARE':
      if(f.catalogStatus==='not_catalog') return outcome(f,'NON_CATALOG_SECURITY_REVIEW','HUMAN_REVIEW','SECURITY','WAITING_SECURITY','Non-catalog software requires IT Security review. The stated review duration is 3-5 business days. This is not permission to install, and no review completion date is known.');
      if(f.catalogStatus==='approved') return outcome(f,'CATALOG_SOFTWARE_GUIDANCE','SELF_SERVICE',null,'ANSWERED','Standard software listed in the approved catalog can be self-installed. The actual catalog is not supplied here, so this guidance is conditional on the item really being listed; employee statements are not an independently verified catalog lookup.',{serviceTicketRequired:false});
      return outcome(f,'SOFTWARE_CATALOG_UNKNOWN','NEEDS_INFO',null,'AWAITING_EMPLOYEE','The data does not establish whether this software is in the approved catalog. Listed standard software can be self-installed; non-catalog items need IT Security review.',{questions:[f.softwareName?'Is this item listed in the approved software catalog?':'What is the software or extension name, and is it listed in the approved catalog?'],serviceTicketRequired:false});
    case 'PRINTER':
      if(f.spoolerRestarted===true&&f.persists===true) {
        if(!f.assetTag) return outcome(f,'PRINTER_ASSET_TAG_REQUIRED','NEEDS_INFO',null,'AWAITING_EMPLOYEE','A printer issue that persists after restarting the print spooler needs a ticket with the printer asset tag.',{questions:["What is the printer's asset tag?"],serviceTicketRequired:false});
        return outcome(f,'PRINTER_PERSISTENT_TICKET','HUMAN_REVIEW','IT','HUMAN_REVIEW','The issue persists after the print spooler restart and the asset tag has been supplied. Create or update a local IT ticket with that asset tag.');
      }
      return outcome(f,'PRINTER_SELF_SERVICE','SELF_SERVICE',null,'AWAITING_CONFIRMATION','First check the printer queue and restart the print spooler. If the issue persists after restart, log a ticket with the printer asset tag.',{questions:['Did those steps resolve the printer issue?'],serviceTicketRequired:false});
    case 'MAILBOX':
      if(f.wantsQuotaIncrease===true) {
        if(f.requestedQuotaGb>50) return outcome(f,'MAILBOX_CAP_EXCEEDED','HUMAN_REVIEW','MANAGER','HUMAN_REVIEW','The policy caps mailbox quota increases at 50GB. The requested amount exceeds that cap and cannot be approved by this agent. A manager can review a request within the policy; no exception authority is supplied.');
        return outcome(f,'MAILBOX_MANAGER_APPROVAL','HUMAN_REVIEW','MANAGER','WAITING_APPROVAL','The default mailbox quota is 25GB. An increase beyond 25GB requires manager approval and is capped at 50GB. The agent cannot change the quota or treat the request as approved.');
      }
      return outcome(f,'MAILBOX_ARCHIVE_GUIDANCE','SELF_SERVICE',null,'AWAITING_CONFIRMATION','Archive old mail to reduce mailbox usage. The default quota is 25GB, but your actual quota is not provided. Increases beyond 25GB need manager approval and are capped at 50GB.',{questions:['After archiving, are you able to send email?'],serviceTicketRequired:false});
    case 'WFH':
      if(f.wfhDays!==undefined && f.wfhDays<=3) return outcome(f,'WFH_DAYS_NOT_ELIGIBLE','SELF_SERVICE',null,'ANSWERED','KB-10 requires working remotely more than 3 days per week for the one-time allowance. The reported schedule does not meet that threshold.',{serviceTicketRequired:false});
      if(f.allowancePreviouslyUsed===true) return outcome(f,'WFH_ONE_TIME_ALREADY_USED','HUMAN_REVIEW','FINANCE','HUMAN_REVIEW','KB-10 describes a one-time allowance. You report already using it, so the agent cannot authorize a second allowance. Finance must review; no exception entitlement or allowance amount is supplied.');
      if(f.wfhDays===undefined) return outcome(f,'WFH_SCHEDULE_UNKNOWN','NEEDS_INFO',null,'AWAITING_EMPLOYEE','The one-time home-office allowance applies to employees working remotely more than 3 days per week and requires manager sign-off and Finance processing.',{questions:['How many days per week do you work remotely, and have you used the one-time allowance before?'],serviceTicketRequired:false});
      return outcome(f,'WFH_MANAGER_FINANCE_REQUIRED','HUMAN_REVIEW','MANAGER_FINANCE','WAITING_APPROVAL','Your reported schedule meets the more-than-3-days-per-week frequency condition. The allowance is one-time and still requires manager sign-off and Finance processing. IT handles shipping only once approved.',{questions:['Have you already used the one-time home-office allowance?'],warnings:['The supplied data does not establish prior allowance use or completed approvals.']});
    case 'EXPENSE':
      if(f.expenseAccountExists===false) return outcome(f,'EXPENSE_PROVISIONING_FINANCE','HUMAN_REVIEW','FINANCE','HUMAN_REVIEW','Finance grants access to the expense management tool. IT only handles login or technical problems after an account exists. Route account provisioning to Finance.');
      if(f.expenseAccountExists===true) return outcome(f,'EXPENSE_TECHNICAL_IT','HUMAN_REVIEW','IT','HUMAN_REVIEW','An existing expense account with a login or technical problem is within IT support scope. Route this issue to IT; no password reset or account change was performed.');
      return outcome(f,'EXPENSE_ACCOUNT_EXISTENCE_UNKNOWN','NEEDS_INFO',null,'AWAITING_EMPLOYEE',caseRecord.workState==='WAITING_EMPLOYEE'?'A screenshot has already been requested and no reply is recorded. Preserve the waiting state; do not send the same request again automatically. KB-08 distinguishes Finance provisioning from IT technical support.':'KB-08 distinguishes Finance account provisioning from IT technical support for an existing account.',{questions:['Has Finance already created your expense-tool account?'],serviceTicketRequired:false});
    case 'PRIVILEGED_ACCESS':return outcome(f,'PRIVILEGED_ACCESS_POLICY_GAP','HUMAN_REVIEW','IT','HUMAN_REVIEW','The supplied policies do not authorize this privileged-access request. Urgency is not approval. A human IT reviewer must establish the appropriate authorization process; do not grant access.',{sourceIds:[],historySourceIds:['TK-1050'],questions:['What specific work requires administrator access?'],warnings:['TK-1050 is a closed historical example, not a privileged-access policy or a rule that every request must be rejected.','Routing to IT is an application safety choice because the authoritative approval procedure is absent.']});
    default:return outcome(f,'ISSUE_UNCLEAR','NEEDS_INFO',null,'AWAITING_EMPLOYEE','There is not enough information to identify the affected service or a relevant policy.',{sourceIds:[],questions:["What is not working, and what error or behaviour are you seeing?"],serviceTicketRequired:false});
  }
}
