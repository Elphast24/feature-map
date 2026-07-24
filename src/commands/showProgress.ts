import * as vscode from "vscode";
import { ProgressTracker } from "../services/progress/progressTracker";
import { RoadmapService } from "../services/roadmap/roadmapService";


export async function showProgressCommand(
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

  const summary = tracker.getSummary(roadmap);
  const allTasks = tracker.getAllTasks(roadmap);
  const velocities = tracker.getVelocitySnapshots(allTasks);

  // Build the detail sections
  const sections: string[] = [];

  // ── Overall
  sections.push(`Overall: ${summary.description}`);

  // ── Phase breakdown 
  const phaseLines = summary.phases
    .map(
      (p) =>
        `   Phase ${p.phaseOrder} — ${p.phaseTitle}: ` +
        `${p.completionPercentage}% (${p.completedTasks}/${p.totalTasks})`
    )
    .join("\n");
  sections.push(`Phases:\n${phaseLines}`);

  // ── Task type breakdown
  if (summary.tasksByType.length > 0) {
    const typeLines = summary.tasksByType
      .map(
        (t) =>
          `   ${t.type}: ${t.completedTasks}/${t.totalTasks} (${t.completionPercentage}%)`
      )
      .join("\n");
    sections.push(`By type:\n${typeLines}`);
  }

  // ── Next task 
  if (summary.nextTask) {
    sections.push(
      `Next: ${summary.nextTask.title}`
    );
  }

  // ── Recent activity 
  const today = velocities[0];
  if (today.tasksCompleted > 0) {
    sections.push(
      `Today: ${today.tasksCompleted} task${today.tasksCompleted === 1 ? "" : "s"} completed`
    );
  }

  // ── Remaining effort 
  if (summary.remainingEffort > 0) {
    sections.push(
      `Remaining effort: ${summary.remainingEffort} points`
    );
  }

  // Show as a multi-line information message
  const fullMessage = sections.join("\n\n");

  // VS Code information messages are short, so we use an output channel
  // for the full report and show a summary in the notification.
  const channel = vscode.window.createOutputChannel("SBAtlas Progress");
  channel.clear();
  channel.appendLine("═══════════════════════════════════════════");
  channel.appendLine("  SBAtlas — Progress Report");
  channel.appendLine("═══════════════════════════════════════════");
  channel.appendLine("");
  channel.appendLine(fullMessage);
  channel.appendLine("");

  // Velocity section in output channel
  channel.appendLine("Velocity:");
  for (const v of velocities) {
    channel.appendLine(
      `   ${v.windowLabel}: ${v.tasksCompleted} completed, ${v.tasksStarted} started`
    );
  }

  channel.appendLine("");
  channel.appendLine("═══════════════════════════════════════════");
  channel.show(true);

  // Short notification pointing to the output channel
  const action = summary.nextTask ? "Start Next Task" : undefined;

  const clicked = await vscode.window.showInformationMessage(
    `SBAtlas: ${summary.completionPercentage}% complete ` +
      `(${summary.completedTasks}/${summary.totalTasks} tasks)` +
      (summary.nextTask
        ? ` — Next: ${truncate(summary.nextTask.title, 40)}`
        : " — All tasks complete!"),
    ...(action ? [action] : [])
  );

  // If you click "Start Next Task", mark it as in progress
  if (clicked === "Start Next Task" && summary.nextTask) {
    await roadmapService.startTask(summary.nextTask.id);
    vscode.window.showInformationMessage(
      `SBAtlas: Started task "${truncate(summary.nextTask.title, 50)}".`
    );
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}