import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { Module } from "../models/module";
import { ProjectService } from "../services/project/projectService";

/**
 * Handles the "SBAtlas: Add Task" command.
 *
 * Lets the developer manually add a task to a specific module.
 * Useful when the AI missed a step or the developer wants to
 * capture an unplanned piece of work.
 *
 * Flow:
 *   1. Pick a module (shown as Phase → Module)
 *   2. Enter task title
 *   3. Enter task description (optional)
 *   4. Optionally link to requirements
 *   5. Save
 */
export async function addTaskCommand(
  roadmapService: RoadmapService,
  projectService: ProjectService,
  moduleId?: string
): Promise<void> {
  const roadmap = roadmapService.getRoadmap();

  if (!roadmap) {
    vscode.window.showWarningMessage(
      "SBAtlas: No roadmap found. Generate one first."
    );
    return;
  }

  // ── Step 1: Resolve target module ──────────────────────────────
  let targetModuleId: string;

  if (moduleId) {
    targetModuleId = moduleId;
  } else {
    // Build a flat list of all modules with their phase context
    interface ModuleQuickPickItem extends vscode.QuickPickItem {
      moduleId: string;
    }

    const items: ModuleQuickPickItem[] = roadmap.phases.flatMap(
      (phase) =>
        phase.modules.map((mod) => ({
          label: mod.title,
          description: `Phase ${phase.order}: ${phase.title}`,
          detail: `${mod.taskCount()} tasks, ${mod.completionPercentage()}% complete`,
          moduleId: mod.id,
        }))
    );

    if (items.length === 0) {
      vscode.window.showWarningMessage(
        "SBAtlas: No modules in the roadmap."
      );
      return;
    }

    const selected = await vscode.window.showQuickPick(items, {
      title: "SBAtlas — Add Task: Select Module",
      placeHolder: "Which module should this task belong to?",
      matchOnDescription: true,
    });

    if (!selected) {
      return;
    }

    targetModuleId = selected.moduleId;
  }

  // ── Step 2: Task title ─────────────────────────────────────────
  const title = await vscode.window.showInputBox({
    title: "SBAtlas — Add Task",
    prompt: "Enter the task title",
    placeHolder: "e.g. Implement password reset endpoint",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Task title is required.";
      }
      if (value.trim().length > 200) {
        return "Task title cannot exceed 200 characters.";
      }
      return null;
    },
  });

  if (title === undefined) {
    return;
  }

  // ── Step 3: Description (optional) ─────────────────────────────
  const description = await vscode.window.showInputBox({
    title: "SBAtlas — Add Task",
    prompt: "Enter a description (optional — press Enter to skip)",
    placeHolder: "e.g. POST /auth/reset-password sends a reset email",
    ignoreFocusOut: true,
  });

  if (description === undefined) {
    return;
  }

  // ── Step 4: Link to requirements (optional) ────────────────────
  let requirementIds: string[] = [];

  const project = projectService.getProject();

  if (project && project.requirements.length > 0) {
    interface ReqQuickPickItem extends vscode.QuickPickItem {
      reqId: string;
    }

    const reqItems: ReqQuickPickItem[] = project.requirements.map(
      (req, index) => ({
        label: `${index + 1}. ${truncate(req.content, 60)}`,
        detail: req.content,
        reqId: req.id,
        picked: false,
      })
    );

    const selectedReqs = await vscode.window.showQuickPick(reqItems, {
      title: "SBAtlas — Add Task: Link Requirements",
      placeHolder:
        "Select requirements this task addresses (optional — press Enter to skip)",
      canPickMany: true,
      matchOnDetail: true,
    });

    if (selectedReqs === undefined) {
      return;
    }

    requirementIds = selectedReqs.map((item) => item.reqId);
  }

  // ── Step 5: Save ───────────────────────────────────────────────
  const result = await roadmapService.addTask(
    targetModuleId,
    title,
    description ?? "",
    requirementIds
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Task "${truncate(title, 40)}" added.` +
        (requirementIds.length > 0
          ? ` Linked to ${requirementIds.length} requirement${requirementIds.length === 1 ? "" : "s"}.`
          : "")
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}