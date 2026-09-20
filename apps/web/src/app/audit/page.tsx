import { AuditClient } from "@/components/audit-client";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function AuditPage() {
  return <WorkspaceShell title="Audit trail"><AuditClient /></WorkspaceShell>;
}
