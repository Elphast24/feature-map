import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";

export async function listProjectsCommand(
  service: ProjectService
): Promise<void> {
  const listResult = await service.listProjects();

  if (!listResult.ok) {
    vscode.window.showErrorMessage(`SBAtlas: ${listResult.error}`);
    return;
  }

  const index = listResult.data;

  if (index.isEmpty()) {
    vscode.window.showInformationMessage(
      "SBAtlas: No projects in this workspace."
    );
    return;
  }

  const channel = vscode.window.createOutputChannel("SBAtlas Projects");
  channel.clear();
  channel.appendLine("═══════════════════════════════════════════");
  channel.appendLine("  SBAtlas — Projects in this Workspace");
  channel.appendLine("═══════════════════════════════════════════");
  channel.appendLine("");
  channel.appendLine(`  Total: ${index.projectCount()} projects`);
  channel.appendLine(
    `  Active: ${index.getActiveEntry()?.name ?? "none"}`
  );
  channel.appendLine("");

  for (const entry of index.projects) {
    const isActive = entry.id === index.activeProjectId;
    const marker = isActive ? " ◀ active" : "";
    const date = new Date(entry.createdAt).toLocaleDateString();

    channel.appendLine(
      `  ${isActive ? "●" : "○"}  ${entry.name}${marker}`
    );
    channel.appendLine(`     ID: ${entry.id}`);
    channel.appendLine(`     Created: ${date}`);
    channel.appendLine("");
  }

  channel.appendLine("═══════════════════════════════════════════");
  channel.show(true);

  vscode.window.showInformationMessage(
    `SBAtlas: ${index.projectCount()} project${index.projectCount() === 1 ? "" : "s"} in this workspace.`
  );
}