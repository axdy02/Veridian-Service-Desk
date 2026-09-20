export type Category='PASSWORD'|'VPN'|'LAPTOP'|'SOFTWARE'|'PRINTER'|'MAILBOX'|'GUEST_WIFI'|'EXPENSE'|'SECURITY'|'WFH'|'PRIVILEGED_ACCESS'|'UNKNOWN';
export interface Facts { category:Category; failedAttempts?:number; laptopAgeYears?:number; wfhDays?:number; requestedQuotaGb?:number; lockedOut?:boolean; wantsReplacement?:boolean; queueChecked?:boolean; spoolerRestarted?:boolean; persists?:boolean; allowancePreviouslyUsed?:boolean; wantsQuotaIncrease?:boolean; expenseAccountExists?:boolean; problemResolved?:boolean; vpnIssue?:'expired'|'new_access'|'other'; employmentType?:'full_time'|'contractor'; laptopSymptom?:'dead'|'flickering'|'other'; catalogStatus?:'approved'|'not_catalog'|'unknown'; softwareName?:string; assetTag?:string; }
export interface CaseRecord {id:string; kind?:string; active:boolean; workState:string; text?:string; lastReasonCode?:string; [key:string]:unknown;}
export interface Decision { category:Category; reasonCode:string; disposition:'SELF_SERVICE'|'NEEDS_INFO'|'HUMAN_REVIEW'|'CONTINUE_EXISTING'|'HISTORY_ONLY';route:string|null;lifecycle:string;sourceIds:string[];historySourceIds:string[];messages:string[];questions:string[];conflicts:{sourceIds:string[];description:string}[];warnings:string[];serviceTicketRequired:boolean;externalActionExecuted:false;}
export interface Evidence {field:string;quote:string;}
export const CATEGORIES:readonly Category[];
export const POLICY_IDS:readonly string[];
export const FACT_FIELDS:readonly string[];
export function requiredPolicies(category:Category|string):string[];
export function normalizeFacts(input?:Record<string,unknown>|Partial<Facts>):Facts;
export function inferOffline(text:string,previous?:Partial<Facts>):Facts;
export function validateExtraction(extraction:{facts?:Record<string,unknown>;evidence?:Evidence[]},evidenceTexts:string[],previous?:Partial<Facts>):{facts:Facts;acceptedEvidence:Evidence[]};
export function decide(caseRecord:CaseRecord,inputFacts:Partial<Facts>,options?:{availablePolicyIds?:readonly string[]}):Decision;
