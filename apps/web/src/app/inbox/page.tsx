import { InboxClient } from "@/components/inbox-client";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function InboxPage() {
  return <WorkspaceShell title="Inbox"><InboxClient /></WorkspaceShell>;
}
