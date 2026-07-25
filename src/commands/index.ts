import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { ProgressTracker } from "../services/progress/progressTracker";
import { CoverageTracker } from "../services/coverage/coverageTracker";
import { createProjectCommand } from "./createProject";
import { deleteProjectCommand } from "./deleteProject";
import { pasteRequirementCommand } from "./pasteRequirement";
import { editRequirementCommand } from "./editRequirement";
import { refreshCommand } from "./refresh";
import { generateRoadmapCommand } from "./generateRoadmap";
import { updateTaskStatusCommand } from "./updateTaskStatus";
import { addTaskNoteCommand } from "./addTaskNote";
import { selectModelCommand } from "./selectModel";
import { showProgressCommand } from "./showProgress";
import { showCoverageCommand } from "./showCoverage";

export function registerCommands(
  context: vscode.ExtensionContext,
  service: ProjectService,
  roadmapService: RoadmapService
): void {
  const progressTracker = new ProgressTracker();
  const coverageTracker = new CoverageTracker();

  const commands: [string, (...args: unknown[]) => Promise<void>][] = [
    ["sbatlas.createProject", () => createProjectCommand(service)],
    ["sbatlas.deleteProject", () => deleteProjectCommand(service)],
    ["sbatlas.pasteRequirement", () => pasteRequirementCommand(service)],
    [
      "sbatlas.editRequirement",
      (...args) =>
        editRequirementCommand(service, args[0] as string | undefined),
    ],
    ["sbatlas.refresh", () => refreshCommand(service, roadmapService)],
    ["sbatlas.generateRoadmap", () => generateRoadmapCommand(roadmapService)],
    [
      "sbatlas.updateTaskStatus",
      (...args) =>
        updateTaskStatusCommand(roadmapService, args[0] as string | undefined),
    ],
    [
      "sbatlas.addTaskNote",
      (...args) =>
        addTaskNoteCommand(roadmapService, args[0] as string | undefined),
    ],
    [
      "sbatlas.showProgress",
      () => showProgressCommand(roadmapService, progressTracker),
    ],
    [
      "sbatlas.showCoverage",
      () => showCoverageCommand(service, roadmapService, coverageTracker),
    ],
    ["sbatlas.selectModel", () => selectModelCommand()],
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