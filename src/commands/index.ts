
import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { createProjectCommand } from "./createProject";
import { deleteProjectCommand } from "./deleteProject";
import { pasteRequirementCommand } from "./pasteRequirement";
import { editRequirementCommand } from "./editRequirement";
import { refreshCommand } from "./refresh";

export function registerCommands(
  context: vscode.ExtensionContext,
  service: ProjectService
): void {
  const commands: [string, () => Promise<void>][] = [
    [
      "sbatlas.createProject",
      () => createProjectCommand(service),
    ],
    [
      "sbatlas.deleteProject",
      () => deleteProjectCommand(service),
    ],
    [
      "sbatlas.pasteRequirement",
      () => pasteRequirementCommand(service),
    ],
    [
      "sbatlas.editRequirement",
      () => editRequirementCommand(service),
    ],
    [
      "sbatlas.refresh",
      () => refreshCommand(service),
    ],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async () => {
        try {
          await handler();
        } catch (error) {
          // Catch unexpected errors so one crashing command does not
          // take down the entire extension.
          vscode.window.showErrorMessage(
            `SBAtlas: An unexpected error occurred. ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          console.error(`[SBAtlas] Command "${id}" threw:`, error);
        }
      })
    );
  }

  console.log(`[SBAtlas] Registered ${commands.length} commands.`);
}