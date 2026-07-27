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
import { deleteRoadmapCommand } from "./deleteRoadmap";
import { updateTaskStatusCommand } from "./updateTaskStatus";
import { addTaskNoteCommand } from "./addTaskNote";
import { addTaskCommand } from "./addTask";
import { removeTaskCommand } from "./removeTask";
import { nextTaskCommand } from "./nextTask";
import { showProgressCommand } from "./showProgress";
import { showCoverageCommand } from "./showCoverage";
import { selectModelCommand } from "./selectModel";

function extractId(
  arg: unknown,
  property: string
): string | undefined {
  if (!arg) {
    return undefined;
  }
  // Tree item with the domain object attached
  if (
    typeof arg === "object" &&
    arg !== null &&
    property in arg
  ) {
    const domainObject = (arg as Record<string, unknown>)[property];
    if (
      typeof domainObject === "object" &&
      domainObject !== null &&
      "id" in domainObject
    ) {
      return (domainObject as { id: string }).id;
    }
  }
  // Direct string ID
  if (typeof arg === "string") {
    return arg;
  }
  return undefined;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  service: ProjectService,
  roadmapService: RoadmapService
): void {
  const progressTracker = new ProgressTracker();
  const coverageTracker = new CoverageTracker();

  const commands: [string, (...args: unknown[]) => Promise<void>][] = [
    // Project commands
    ["sbatlas.createProject", () => createProjectCommand(service)],
    ["sbatlas.deleteProject", () => deleteProjectCommand(service)],
    ["sbatlas.pasteRequirement", () => pasteRequirementCommand(service)],
    [
      "sbatlas.editRequirement",
      (...args) =>
        editRequirementCommand(
          service,
          extractId(args[0], "requirement")
        ),
    ],
    ["sbatlas.refresh", () => refreshCommand(service, roadmapService)],

    // Roadmap commands
    ["sbatlas.generateRoadmap", () => generateRoadmapCommand(roadmapService)],
    ["sbatlas.deleteRoadmap", () => deleteRoadmapCommand(roadmapService)],
    [
      "sbatlas.addTask",
      (...args) =>
        addTaskCommand(
          roadmapService,
          service,
          extractId(args[0], "module")
        ),
    ],
    [
      "sbatlas.removeTask",
      (...args) =>
        removeTaskCommand(
          roadmapService,
          extractId(args[0], "task")
        ),
    ],

    // Task execution commands
    [
      "sbatlas.updateTaskStatus",
      (...args) =>
        updateTaskStatusCommand(
          roadmapService,
          extractId(args[0], "task")
        ),
    ],
    [
      "sbatlas.addTaskNote",
      (...args) =>
        addTaskNoteCommand(
          roadmapService,
          extractId(args[0], "task")
        ),
    ],
    ["sbatlas.nextTask", () => nextTaskCommand(roadmapService, progressTracker)],

    // Report commands
    [
      "sbatlas.showProgress",
      () => showProgressCommand(roadmapService, progressTracker),
    ],
    [
      "sbatlas.showCoverage",
      () => showCoverageCommand(service, roadmapService, coverageTracker),
    ],

    // Settings commands
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