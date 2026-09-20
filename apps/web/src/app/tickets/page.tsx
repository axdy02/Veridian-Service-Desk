import { TicketsClient } from "@/components/tickets-client";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function TicketsPage() {
  return <WorkspaceShell title="Tickets"><TicketsClient /></WorkspaceShell>;
}
