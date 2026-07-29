import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";

export async function switchProjectCommand(
  service: ProjectService,
  roadmapService: RoadmapService
): Promise<void> {
  const listResult = await service.listProjects();

  if (!listResult.ok) {
    vscode.window.showErrorMessage(`SBAtlas: ${listResult.error}`);
    return;
  }

  const index = listResult.data;

  if (index.isEmpty()) {
    vscode.window.showWarningMessage(
      "SBAtlas: No projects in this workspace. Create one first."
    );
    return;
  }

  if (index.projectCount() === 1) {
    vscode.window.showInformationMessage(
      "SBAtlas: Only one project exists in this workspace."
    );
    return;
  }

  // Build QuickPick items
  interface ProjectQuickPickItem extends vscode.QuickPickItem {
    projectId: string;
  }

  const items: ProjectQuickPickItem[] = index.projects.map(
    (entry) => ({
      label:
        entry.id === index.activeProjectId
          ? `$(check)  ${entry.name}`
          : `       ${entry.name}`,
      description:
        entry.id === index.activeProjectId ? "active" : "",
      detail: `Created: ${new Date(entry.createdAt).toLocaleDateString()} | ID: ${entry.id}`,
      projectId: entry.id,
    })
  );

  const selected = await vscode.window.showQuickPick(items, {
    title: "SBAtlas — Switch Project",
    placeHolder: `${index.projectCount()} projects in this workspace`,
    matchOnDetail: true,
  });

  if (!selected) {
    return;
  }

  if (selected.projectId === index.activeProjectId) {
    vscode.window.showInformationMessage(
      "SBAtlas: This project is already active."
    );
    return;
  }

  // Switch project
  const switchResult = await service.switchProject(
    selected.projectId
  );

  if (!switchResult.ok) {
    vscode.window.showErrorMessage(`SBAtlas: ${switchResult.error}`);
    return;
  }

  // Also load the roadmap for the new project
  await roadmapService.loadRoadmap();

  vscode.window.showInformationMessage(
    `SBAtlas: Switched to project "${switchResult.data.name}".`
  );
}