import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";

export async function refreshCommand(
  service: ProjectService,
  roadmapService: RoadmapService
): Promise<void> {
  const projectResult = await service.loadProject();
  const roadmapResult = await roadmapService.loadRoadmap();

  if (projectResult.ok && projectResult.data) {
    const roadmapInfo =
      roadmapResult.ok && roadmapResult.data
        ? ` | Roadmap: ${roadmapResult.data.completionPercentage()}% complete`
        : " | No roadmap";

    vscode.window.showInformationMessage(
      `SBAtlas: Refreshed — "${projectResult.data.name}" loaded.${roadmapInfo}`
    );
  } else {
    vscode.window.showInformationMessage(
      "SBAtlas: Refreshed — no project found."
    );
  }
}