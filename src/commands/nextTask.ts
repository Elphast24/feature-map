import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { ProgressTracker } from "../services/progress/progressTracker";


export async function nextTaskCommand(
  roadmapService: RoadmapService,
  tracker: ProgressTracker
): Promise<void> {
  const roadmap = roadmapService.getRoadmap();

  if (!roadmap) {
    vscode.window.showWarningMessage(
      "SBAtlas: No roadmap found. Generate one first."
    );
    return;
  }

  const nextTask = tracker.getNextTask(roadmap);

  if (!nextTask) {
    vscode.window.showInformationMessage(
      "SBAtlas: All tasks are complete! 🎉"
    );
    return;
  }

  // Find the phase and module for context
  const found = roadmap.findTask(nextTask.id);

  const locationText = found
    ? `Phase ${found.phase.order}: ${found.phase.title} → ${found.module.title}`
    : "";

  const statusText =
    nextTask.status === "inProgress"
      ? "Currently in progress"
      : "Not started yet";

  // Show with actionable buttons
  const action = await vscode.window.showInformationMessage(
    `SBAtlas — Next Task: ${nextTask.title}\n` +
      `${locationText}  |  ${statusText}`,
    "Start Task",
    "Complete Task",
    "Skip Task"
  );

  if (!action) {
    return;
  }

  if (action === "Start Task") {
    const result = await roadmapService.startTask(nextTask.id);
    if (result.ok) {
      vscode.window.showInformationMessage(
        `SBAtlas: Started "${truncate(nextTask.title, 40)}".`
      );
    } else {
      vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
    }
  } else if (action === "Complete Task") {
    const result = await roadmapService.completeTask(nextTask.id);
    if (result.ok) {
      const percentage = roadmap.completionPercentage();
      vscode.window.showInformationMessage(
        `SBAtlas: Completed "${truncate(nextTask.title, 40)}". ` +
          `Progress: ${percentage}%`
      );
    } else {
      vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
    }
  } else if (action === "Skip Task") {
    const result = await roadmapService.skipTask(nextTask.id);
    if (result.ok) {
      vscode.window.showInformationMessage(
        `SBAtlas: Skipped "${truncate(nextTask.title, 40)}".`
      );
    } else {
      vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}