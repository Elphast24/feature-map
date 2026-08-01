import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { Task } from "../models/task";

/**
 * Handles the "SBAtlas: Move Task Up" and "SBAtlas: Move Task Down"
 * commands.
 */
export async function moveTaskUpCommand(
  roadmapService: RoadmapService,
  taskId?: string
): Promise<void> {
  await reorderTask(roadmapService, taskId, "up");
}

export async function moveTaskDownCommand(
  roadmapService: RoadmapService,
  taskId?: string
): Promise<void> {
  await reorderTask(roadmapService, taskId, "down");
}

async function reorderTask(
  roadmapService: RoadmapService,
  taskId: string | undefined,
  direction: "up" | "down"
): Promise<void> {
  const roadmap = roadmapService.getRoadmap();

  if (!roadmap) {
    vscode.window.showWarningMessage(
      "SBAtlas: No roadmap found."
    );
    return;
  }

  let resolvedTaskId = taskId;

  if (!resolvedTaskId) {
    const allTasks = roadmap.phases.flatMap((p) =>
      p.modules.flatMap((m) =>
        m.tasks.map((t) => ({
          task: t,
          moduleName: m.title,
          phaseName: p.title,
        }))
      )
    );

    interface TaskItem extends vscode.QuickPickItem {
      task: Task;
    }

    const items: TaskItem[] = allTasks.map((item) => ({
      label: item.task.title,
      description: `${item.phaseName} → ${item.moduleName}`,
      task: item.task,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: `SBAtlas — Move Task ${direction === "up" ? "Up" : "Down"}`,
      placeHolder: "Select a task to move",
    });

    if (!selected) {
      return;
    }

    resolvedTaskId = selected.task.id;
  }

  const result =
    direction === "up"
      ? await roadmapService.moveTaskUp(resolvedTaskId)
      : await roadmapService.moveTaskDown(resolvedTaskId);

  if (!result.ok) {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}