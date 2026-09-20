import { SettingsClient } from "@/components/settings-client";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function SettingsPage() {
  return <WorkspaceShell title="Settings"><SettingsClient /></WorkspaceShell>;
}
