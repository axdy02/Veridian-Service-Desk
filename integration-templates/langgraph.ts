/** Real StateGraph orchestration template with dependency-injected, authorization-scoped services.
 * Annotation.Root is a documented supported API. Verify installed package types before integration.
 * There is no dependency on LangSmith, hosted LangGraph, embeddings or an external tool server.
 */
import {Annotation,StateGraph,START,END} from '@langchain/langgraph';
import {decide,requiredPolicies,type Facts,type CaseRecord,type Decision,type Evidence} from '@veridian/domain';
export interface Actor {userId:string;workspaceId:string;}
export interface Policy {id:string;title:string;text:string;page:number;}
export interface LoadedCase {record:CaseRecord;previousFacts:Partial<Facts>;userTexts:string[];version:number;}
export interface Services {
 loadCase(actor:Actor,caseId:string):Promise<LoadedCase>;
 extract(input:{userTexts:string[];latestText:string;previousFacts:Partial<Facts>}):Promise<{facts:Facts;evidence:Evidence[];mode:'gemini'|'offline'|'offline-fallback';warning?:string}>;
 retrievePolicies(actor:Actor,ids:string[]):Promise<Policy[]>;
 audit(actor:Actor,runId:string,node:string,event:string,payload:Record<string,unknown>):Promise<void>;
 commit(input:{actor:Actor;caseId:string;runId:string;expectedVersion:number;facts:Facts;factEvidence:Evidence[];decision:Decision;mode:string}):Promise<{ticketId:string|null;state:string;version:number}>;
}
const State=Annotation.Root({
 actor:Annotation<Actor>(),caseId:Annotation<string>(),runId:Annotation<string>(),latestText:Annotation<string>(),
 loaded:Annotation<LoadedCase>(),facts:Annotation<Facts>(),evidence:Annotation<Evidence[]>(),
 policies:Annotation<Policy[]>(),mode:Annotation<string>(),warning:Annotation<string|undefined>(),decision:Annotation<Decision>(),
 receipt:Annotation<{ticketId:string|null;state:string;version:number}>()
});
export function buildServiceGraph(services:Services){
 const timed=<T extends Record<string,unknown>>(name:string,fn:(s:typeof State.State)=>Promise<T>)=>async(s:typeof State.State)=>{
  await services.audit(s.actor,s.runId,name,'NODE_STARTED',{});
  const began=performance.now();
  try {const result=await fn(s);await services.audit(s.actor,s.runId,name,'NODE_COMPLETED',{durationMs:Math.round(performance.now()-began)});return result;}
  catch(error){await services.audit(s.actor,s.runId,name,'NODE_FAILED',{code:'NODE_EXECUTION_FAILED'});throw error;}
 };
 const persist=async(s:typeof State.State)=>{
  await services.audit(s.actor,s.runId,'commit_outcome','NODE_STARTED',{});
  // commit() records NODE_COMPLETED and RUN_COMPLETED in its final transaction.
  return {receipt:await services.commit({actor:s.actor,caseId:s.caseId,runId:s.runId,expectedVersion:s.loaded.version,facts:s.facts,factEvidence:s.evidence,decision:s.decision,mode:s.mode})};
 };
 return new StateGraph(State)
 .addNode('load_case',timed('load_case',async s=>({loaded:await services.loadCase(s.actor,s.caseId)})))
 .addNode('understand_issue',timed('understand_issue',async s=>{const r=await services.extract({userTexts:s.loaded.userTexts,latestText:s.latestText,previousFacts:s.loaded.previousFacts});return {facts:r.facts,evidence:r.evidence,mode:r.mode,warning:r.warning};}))
 .addNode('retrieve_evidence',timed('retrieve_evidence',async s=>({policies:await services.retrievePolicies(s.actor,requiredPolicies(s.facts.category))})))
 .addNode('evaluate_policy',timed('evaluate_policy',async s=>({decision:decide(s.loaded.record,s.facts,{availablePolicyIds:s.policies.map(p=>p.id)})})))
 .addNode('ask_followup',timed('ask_followup',async s=>({decision:s.decision})))
 .addNode('record_guidance',timed('record_guidance',async s=>({decision:s.decision})))
 .addNode('route_human',timed('route_human',async s=>({decision:s.decision})))
 .addNode('history_only',timed('history_only',async s=>({facts:{category:'UNKNOWN'} as Facts,evidence:[],mode:'offline',decision:decide(s.loaded.record,{category:'UNKNOWN'})})))
 .addNode('commit_outcome',persist)
 .addEdge(START,'load_case')
 .addConditionalEdges('load_case',s=>s.loaded.record.active===false||s.loaded.record.workState==='CLOSED'?'history_only':'understand_issue')
 .addEdge('understand_issue','retrieve_evidence').addEdge('retrieve_evidence','evaluate_policy')
 .addConditionalEdges('evaluate_policy',s=>s.decision.disposition==='NEEDS_INFO'?'ask_followup':s.decision.disposition==='SELF_SERVICE'?'record_guidance':'route_human')
 .addEdge('ask_followup','commit_outcome').addEdge('record_guidance','commit_outcome').addEdge('route_human','commit_outcome')
 // Closed records are read-only: not even a service-case state update on this path.
 .addEdge('history_only',END).addEdge('commit_outcome',END).compile();
}
