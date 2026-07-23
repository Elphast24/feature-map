import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { Task, TaskStatus } from "../models/task";

export async function updateTaskStatusCommand(
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
  let targetTask: Task | undefined;

  if (taskId) {
    const found = roadmap.findTask(taskId);
    if (!found) {
      vscode.window.showErrorMessage("SBAtlas: Task not found.");
      return;
    }
    targetTask = found.task;
  } else {
    // Show all tasks as QuickPick
    const allTasks = roadmap.phases.flatMap((p) =>
      p.modules.flatMap((m) =>
        m.tasks.map((t) => ({
          task: t,
          moduleName: m.title,
          phaseName: p.title,
        }))
      )
    );

    if (allTasks.length === 0) {
      vscode.window.showWarningMessage(
        "SBAtlas: This roadmap has no tasks."
      );
      return;
    }

    interface TaskQuickPickItem extends vscode.QuickPickItem {
      task: Task;
    }

    const items: TaskQuickPickItem[] = allTasks.map((item) => ({
      label: `${statusIcon(item.task.status)}  ${item.task.title}`,
      description: `${item.phaseName} → ${item.moduleName}`,
      detail: item.task.description,
      task: item.task,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: "SBAtlas — Update Task Status",
      placeHolder: "Select a task",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) {
      return;
    }

    targetTask = selected.task;
  }

  // ── Pick new status ─────────────────────────────────────────────
  interface StatusQuickPickItem extends vscode.QuickPickItem {
    status: TaskStatus;
  }

  const statusOptions: StatusQuickPickItem[] = [
    {
      label: "$(circle-outline)  Pending",
      description: "Not started yet",
      status: TaskStatus.Pending,
    },
    {
      label: "$(play)  In Progress",
      description: "Currently being worked on",
      status: TaskStatus.InProgress,
    },
    {
      label: "$(check)  Done",
      description: "Completed",
      status: TaskStatus.Done,
    },
    {
      label: "$(arrow-right)  Skipped",
      description: "Deliberately excluded",
      status: TaskStatus.Skipped,
    },
  ];

  const selectedStatus = await vscode.window.showQuickPick(statusOptions, {
    title: `SBAtlas — Set Status for "${truncate(targetTask.title, 50)}"`,
    placeHolder: `Current status: ${targetTask.status}`,
  });

  if (!selectedStatus) {
    return;
  }

  // ── Update ──────────────────────────────────────────────────────
  const result = await roadmapService.updateTaskStatus(
    targetTask.id,
    selectedStatus.status
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Task marked as ${selectedStatus.status}.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

function statusIcon(status: TaskStatus): string {
  const icons: Record<TaskStatus, string> = {
    [TaskStatus.Pending]: "○",
    [TaskStatus.InProgress]: "▶",
    [TaskStatus.Done]: "✓",
    [TaskStatus.Skipped]: "→",
  };
  return icons[status];
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}