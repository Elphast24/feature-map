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
  const commands: [string, (...args: unknown[]) => Promise<void>][] = [
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
      // args[0] is the requirementId when called from tree context menu.
      // It is undefined when called from the Command Palette.
      (...args) => editRequirementCommand(service, args[0] as string | undefined),
    ],
    [
      "sbatlas.refresh",
      () => refreshCommand(service),
    ],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async (...args) => {
        try {
          await handler(...args);
        } catch (error) {
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