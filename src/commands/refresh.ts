import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";


export async function refreshCommand(
  service: ProjectService
): Promise<void> {
  const result = await service.loadProject();

  if (!result.ok) {
    vscode.window.showErrorMessage(`SBAtlas: Failed to refresh. ${result.error}`);
    return;
  }

  if (result.data) {
    vscode.window.showInformationMessage(
      `SBAtlas: Refreshed — "${result.data.name}" is loaded.`
    );
  } else {
    vscode.window.showInformationMessage(
      "SBAtlas: Refreshed — no project found in this workspace."
    );
  }
}