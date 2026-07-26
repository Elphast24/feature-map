import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { Task } from "../models/task";

export async function removeTaskCommand(
  roadmapService: RoadmapService,
  taskId?: string
): Promise<void> {
  const roadmap = roadmapService.getRoadmap();

  if (!roadmap) {
    vscode.window.showWarningMessage(
      "SBAtlas: No roadmap found. Generate one first."
    );
    return;
  }

  // ── Resolve target task ─────────────────────────────────────────
  let targetTask: Task;
  let targetModuleName: string;

  if (taskId) {
    const found = roadmap.findTask(taskId);
    if (!found) {
      vscode.window.showErrorMessage("SBAtlas: Task not found.");
      return;
    }
    targetTask = found.task;
    targetModuleName = found.module.title;
  } else {
    interface TaskQuickPickItem extends vscode.QuickPickItem {
      task: Task;
      moduleName: string;
    }

    const items: TaskQuickPickItem[] = roadmap.phases.flatMap(
      (phase) =>
        phase.modules.flatMap((mod) =>
          mod.tasks.map((task) => ({
            label: task.title,
            description: `${phase.title} → ${mod.title}`,
            detail: task.description,
            task,
            moduleName: mod.title,
          }))
        )
    );

    if (items.length === 0) {
      vscode.window.showWarningMessage(
        "SBAtlas: No tasks in the roadmap."
      );
      return;
    }

    const selected = await vscode.window.showQuickPick(items, {
      title: "SBAtlas — Remove Task",
      placeHolder: "Select a task to remove",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) {
      return;
    }

    targetTask = selected.task;
    targetModuleName = selected.moduleName;
  }

  // ── Confirm ─────────────────────────────────────────────────────
  const confirmation = await vscode.window.showWarningMessage(
    `Remove task "${truncate(targetTask.title, 50)}" ` +
      `from module "${targetModuleName}"? This cannot be undone.`,
    { modal: true },
    "Remove Task"
  );

  if (confirmation !== "Remove Task") {
    return;
  }

  // ── Delete ──────────────────────────────────────────────────────
  const result = await roadmapService.removeTask(targetTask.id);

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Task "${truncate(targetTask.title, 40)}" removed.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}