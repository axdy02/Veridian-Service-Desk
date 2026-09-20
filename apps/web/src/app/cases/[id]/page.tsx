import { CaseDetail } from "@/components/case-detail";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkspaceShell title="Case workspace"><CaseDetail caseId={id} /></WorkspaceShell>;
}
