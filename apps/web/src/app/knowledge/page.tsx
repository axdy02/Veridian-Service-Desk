import { KnowledgeClient } from "@/components/knowledge-client";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function KnowledgePage() {
  return <WorkspaceShell title="Knowledge"><KnowledgeClient /></WorkspaceShell>;
}
