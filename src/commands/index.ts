import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { SettingsService } from "../services/settings/settingsService";
import { ProgressTracker } from "../services/progress/progressTracker";
import { CoverageTracker } from "../services/coverage/coverageTracker";
import { createProjectCommand } from "./createProject";
import { deleteProjectCommand } from "./deleteProject";
import { switchProjectCommand } from "./switchProject";
import { listProjectsCommand } from "./listProjects";
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
import { openSettingsCommand } from "./openSettings";
import { importRequirementsCommand } from "./importRequirements";
import { bulkAddRequirementsCommand } from "./bulkAddRequirements";
import { setRequirementPriorityCommand } from "./setRequirementPriority";
import { tagRequirementCommand } from "./tagRequirement";
import { moveTaskUpCommand, moveTaskDownCommand } from "./reorderTask";
import { moveTaskToModuleCommand } from "./moveTaskToModule";
import { batchUpdateTasksCommand } from "./batchUpdateTask";
import { manageTaskDependenciesCommand } from "./manageTaskDependencies";

function extractId(
  arg: unknown,
  property: string
): string | undefined {
  if (!arg) {
    return undefined;
  }
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
  if (typeof arg === "string") {
    return arg;
  }
  return undefined;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  service: ProjectService,
  roadmapService: RoadmapService,
  settingsService: SettingsService
): void {
  const progressTracker = new ProgressTracker();
  const coverageTracker = new CoverageTracker();

  const commands: [string, (...args: unknown[]) => Promise<void>][] = [
    // Project commands
    ["sbatlas.createProject", () => createProjectCommand(service, settingsService)],
    ["sbatlas.deleteProject", () => deleteProjectCommand(service)],
    ["sbatlas.switchProject", () => switchProjectCommand(service, roadmapService)],
    ["sbatlas.listProjects", () => listProjectsCommand(service)],
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

    // Reports
    ["sbatlas.showProgress", () => showProgressCommand(roadmapService, progressTracker)],
    ["sbatlas.showCoverage", () => showCoverageCommand(service, roadmapService, coverageTracker)],

    // Settings
    ["sbatlas.openSettings", () => openSettingsCommand(settingsService)],
    ["sbatlas.selectModel", () => selectModelCommand()],

    // Requirement Import
    ["sbatlas.importRequirements", () => importRequirementsCommand(service)],
    ["sbatlas.bulkAddRequirements", () => bulkAddRequirementsCommand(service)],
    [
      "sbatlas.setRequirementPriority",
      (...args) =>
        setRequirementPriorityCommand(
          service,
          extractId(args[0], "requirement")
        ),
    ],
    [
      "sbatlas.tagRequirement",
      (...args) =>
        tagRequirementCommand(
          service,
          extractId(args[0], "requirement")
        ),
    ],
    ["sbatlas.confirmBulkAdd", async () => {}],

    // Task Management
    [
      "sbatlas.moveTaskUp",
      (...args) =>
        moveTaskUpCommand(roadmapService, extractId(args[0], "task")),
    ],
    [
      "sbatlas.moveTaskDown",
      (...args) =>
        moveTaskDownCommand(roadmapService, extractId(args[0], "task")),
    ],
    [
      "sbatlas.moveTaskToModule",
      (...args) =>
        moveTaskToModuleCommand(
          roadmapService,
          extractId(args[0], "task")
        ),
    ],
    ["sbatlas.batchUpdateTasks", () => batchUpdateTasksCommand(roadmapService)],
    [
      "sbatlas.manageTaskDependencies",
      (...args) =>
        manageTaskDependenciesCommand(
          roadmapService,
          extractId(args[0], "task")
        ),
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