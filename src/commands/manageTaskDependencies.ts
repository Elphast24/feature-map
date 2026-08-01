// src/commands/manageTaskDependencies.ts

import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { Task } from "../models/task";

/**
 * Handles the "SBAtlas: Manage Task Dependencies" command.
 *
 * Flow:
 *   1. Select the task to configure
 *   2. Choose: add blocker or remove blocker
 *   3. Select the blocking task
 */
export async function manageTaskDependenciesCommand(
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

  //  Resolve target task 
  let resolvedTaskId = taskId;

  if (!resolvedTaskId) {
    interface TaskItem extends vscode.QuickPickItem {
      task: Task;
    }

    const items: TaskItem[] = roadmap.phases.flatMap((p) =>
      p.modules.flatMap((m) =>
        m.tasks.map((t) => ({
          label: t.title,
          description: `${p.title} → ${m.title}`,
          detail:
            t.blockedBy.length > 0
              ? `Blocked by ${t.blockedBy.length} task${t.blockedBy.length === 1 ? "" : "s"}`
              : "No blockers",
          task: t,
        }))
      )
    );

    const selected = await vscode.window.showQuickPick(items, {
      title: "SBAtlas — Manage Task Dependencies",
      placeHolder: "Select a task to configure dependencies for",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) {
      return;
    }

    resolvedTaskId = selected.task.id;
  }

  const taskFound = roadmap.findTask(resolvedTaskId);
  if (!taskFound) {
    vscode.window.showErrorMessage("SBAtlas: Task not found.");
    return;
  }

  const { task } = taskFound;

  //  Choose action 
  const actions = [
    {
      label: "$(add)  Add Blocker",
      description: "Mark another task as a prerequisite",
      action: "add",
    },
  ];

  if (task.blockedBy.length > 0) {
    actions.push({
      label: "$(trash)  Remove Blocker",
      description: `Currently blocked by ${task.blockedBy.length} task${task.blockedBy.length === 1 ? "" : "s"}`,
      action: "remove",
    });

    actions.push({
      label: "$(list-unordered)  View Blockers",
      description: "Show what is blocking this task",
      action: "view",
    });
  }

  const action = await vscode.window.showQuickPick(actions, {
    title: `SBAtlas — Dependencies for "${truncate(task.title, 40)}"`,
    placeHolder: "What do you want to do?",
  });

  if (!action) {
    return;
  }

  if (action.action === "view") {
    await viewBlockers(task, roadmap);
    return;
  }

  if (action.action === "add") {
    await addBlocker(task, resolvedTaskId, roadmapService, roadmap);
    return;
  }

  if (action.action === "remove") {
    await removeBlocker(task, resolvedTaskId, roadmapService, roadmap);
  }
}

//  Action handlers 

async function viewBlockers(
  task: Task,
  roadmap: import("../models/roadMap").Roadmap
): Promise<void> {
  const blockerDetails = task.blockedBy.map((blockerId) => {
    const found = roadmap.findTask(blockerId);
    if (!found) {
      return {
        label: `$(warning)  Unknown task (${blockerId})`,
        description: "This task no longer exists",
      };
    }
    return {
      label: `${found.task.isComplete ? "$(check)" : "$(circle-outline)"}  ${found.task.title}`,
      description: `${found.phase.title} → ${found.module.title} | ${found.task.status}`,
    };
  });

  await vscode.window.showQuickPick(blockerDetails, {
    title: `Blockers for "${truncate(task.title, 40)}"`,
    placeHolder: "These tasks must be completed first",
  });
}

async function addBlocker(
  task: Task,
  taskId: string,
  roadmapService: RoadmapService,
  roadmap: import("../models/roadMap").Roadmap
): Promise<void> {
  interface BlockerItem extends vscode.QuickPickItem {
    task: Task;
  }

  // Show all other tasks that are not already blockers
  const candidates: BlockerItem[] = roadmap.phases
    .flatMap((p) =>
      p.modules.flatMap((m) =>
        m.tasks
          .filter(
            (t) =>
              t.id !== taskId && !task.blockedBy.includes(t.id)
          )
          .map((t) => ({
            label: `${t.isComplete ? "$(check)" : "$(circle-outline)"}  ${t.title}`,
            description: `${p.title} → ${m.title}`,
            detail: `Status: ${t.status}`,
            task: t,
          }))
      )
    );

  if (candidates.length === 0) {
    vscode.window.showInformationMessage(
      "SBAtlas: No other tasks available to add as blockers."
    );
    return;
  }

  const selected = await vscode.window.showQuickPick(candidates, {
    title: "SBAtlas — Add Blocker",
    placeHolder:
      "Select a task that must be completed before this one",
    matchOnDescription: true,
  });

  if (!selected) {
    return;
  }

  const result = await roadmapService.addTaskDependency(
    taskId,
    selected.task.id
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: "${task.title}" is now blocked by "${selected.task.title}".`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

async function removeBlocker(
  task: Task,
  taskId: string,
  roadmapService: RoadmapService,
  roadmap: import("../models/roadMap").Roadmap
): Promise<void> {
  interface BlockerItem extends vscode.QuickPickItem {
    blockerId: string;
  }

  const items: BlockerItem[] = task.blockedBy.map((blockerId) => {
    const found = roadmap.findTask(blockerId);
    return {
      label: found
        ? found.task.title
        : `Unknown task (${blockerId})`,
      description: found
        ? `${found.phase.title} → ${found.module.title}`
        : "Task not found",
      blockerId,
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    title: "SBAtlas — Remove Blocker",
    placeHolder: "Select a blocker to remove",
  });

  if (!selected) {
    return;
  }

  const result = await roadmapService.removeTaskDependency(
    taskId,
    selected.blockerId
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Blocker removed.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}