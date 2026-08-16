import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { ExportService } from "../services/export/exportService";

export async function copyProgressCommand(
  projectService: ProjectService,
  roadmapService: RoadmapService,
  exportService: ExportService
): Promise<void> {
  const project = projectService.getProject();

  if (!project) {
    vscode.window.showWarningMessage(
      "SBAtlas: No project to copy progress from."
    );
    return;
  }

  const roadmap = roadmapService.getRoadmap();
  const summary = exportService.generateClipboardSummary(
    project,
    roadmap
  );

  await vscode.env.clipboard.writeText(summary);

  vscode.window.showInformationMessage(
    "SBAtlas: Progress summary copied to clipboard."
  );
}