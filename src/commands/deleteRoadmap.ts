import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";


export async function deleteRoadmapCommand(
  roadmapService: RoadmapService
): Promise<void> {
  const roadmap = roadmapService.getRoadmap();

  if (!roadmap) {
    vscode.window.showWarningMessage(
      "SBAtlas: No roadmap to delete."
    );
    return;
  }

  const completed = roadmap.completedTaskCount();
  const total = roadmap.totalTaskCount();

  let warningText =
    `Delete the current roadmap? (${total} tasks`;

  if (completed > 0) {
    warningText += `, ${completed} completed`;
  }

  warningText += `) This cannot be undone.`;

  const confirmation = await vscode.window.showWarningMessage(
    warningText,
    { modal: true },
    "Delete Roadmap"
  );

  if (confirmation !== "Delete Roadmap") {
    return;
  }

  const result = await roadmapService.deleteRoadmap();

  if (result.ok) {
    vscode.window.showInformationMessage(
      "SBAtlas: Roadmap deleted. Your project and requirements are unchanged."
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}