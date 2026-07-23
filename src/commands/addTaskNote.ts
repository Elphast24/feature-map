import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { Task } from "../models/task";

export async function addTaskNoteCommand(
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
      label: item.task.title,
      description: `${item.phaseName} → ${item.moduleName}`,
      task: item.task,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: "SBAtlas — Add Task Note",
      placeHolder: "Select a task to add a note to",
      matchOnDescription: true,
    });

    if (!selected) {
      return;
    }

    targetTask = selected.task;
  }

  // ── Collect note ────────────────────────────────────────────────
  const note = await vscode.window.showInputBox({
    title: `SBAtlas — Note for "${truncate(targetTask.title, 50)}"`,
    prompt: "Enter a note (decision, blocker, context)",
    placeHolder: "e.g. Decided to use bcrypt over argon2 for compatibility.",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Note cannot be empty.";
      }
      if (value.length > 500) {
        return "Note cannot exceed 500 characters.";
      }
      return null;
    },
  });

  if (note === undefined) {
    return;
  }

  // ── Save ────────────────────────────────────────────────────────
  const result = await roadmapService.addTaskNote(targetTask.id, note);

  if (result.ok) {
    vscode.window.showInformationMessage(
      "SBAtlas: Note added to task."
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}