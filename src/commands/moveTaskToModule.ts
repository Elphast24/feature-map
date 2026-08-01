import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { Task } from "../models/task";

/**
 * Handles the "SBAtlas: Move Task to Module" command.
 */
export async function moveTaskToModuleCommand(
  roadmapService: RoadmapService,
  taskId?: string
): Promise<void> {
  const roadmap = roadmapService.getRoadmap();

  if (!roadmap) {
    vscode.window.showWarningMessage(
      "SBAtlas: No roadmap found."
    );
    return;
  }

  //  Resolve source task 
  let resolvedTaskId = taskId;

  if (!resolvedTaskId) {
    interface TaskItem extends vscode.QuickPickItem {
      task: Task;
    }

    const taskItems: TaskItem[] = roadmap.phases.flatMap((p) =>
      p.modules.flatMap((m) =>
        m.tasks.map((t) => ({
          label: t.title,
          description: `${p.title} → ${m.title}`,
          task: t,
        }))
      )
    );

    const selectedTask = await vscode.window.showQuickPick(
      taskItems,
      {
        title: "SBAtlas — Move Task to Module: Select Task",
        placeHolder: "Which task do you want to move?",
        matchOnDescription: true,
      }
    );

    if (!selectedTask) {
      return;
    }

    resolvedTaskId = selectedTask.task.id;
  }

  // Find the current module for context
  const sourceFound = roadmap.findTask(resolvedTaskId);

  if (!sourceFound) {
    vscode.window.showErrorMessage("SBAtlas: Task not found.");
    return;
  }

  //  Resolve target module
  interface ModuleItem extends vscode.QuickPickItem {
    moduleId: string;
  }

  const moduleItems: ModuleItem[] = roadmap.phases.flatMap(
    (p) =>
      p.modules
        .filter((m) => m.id !== sourceFound.module.id) // exclude current
        .map((m) => ({
          label: m.title,
          description: `Phase ${p.order}: ${p.title}`,
          detail: `${m.taskCount()} tasks, ${m.completionPercentage()}% complete`,
          moduleId: m.id,
        }))
  );

  if (moduleItems.length === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: No other modules to move to."
    );
    return;
  }

  const selectedModule = await vscode.window.showQuickPick(
    moduleItems,
    {
      title: `SBAtlas — Move "${truncate(sourceFound.task.title, 40)}" to Module`,
      placeHolder: "Select the target module",
      matchOnDescription: true,
    }
  );

  if (!selectedModule) {
    return;
  }

  const result = await roadmapService.moveTaskToModule(
    resolvedTaskId,
    selectedModule.moduleId
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Task moved to "${selectedModule.label}".`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}