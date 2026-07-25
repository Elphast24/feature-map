import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { CoverageTracker } from "../services/coverage/coverageTracker";
import { RequirementCoverageStatus } from "../services/coverage/coverageTypes";


export async function showCoverageCommand(
  projectService: ProjectService,
  roadmapService: RoadmapService,
  tracker: CoverageTracker
): Promise<void> {
  const project = projectService.getProject();

  if (!project) {
    vscode.window.showWarningMessage(
      "SBAtlas: No project found. Create a project first."
    );
    return;
  }

  if (project.requirements.length === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: No requirements to track coverage for."
    );
    return;
  }

  const roadmap = roadmapService.getRoadmap();
  const report = tracker.getReport(project, roadmap);

  // Build output channel report
  const channel = vscode.window.createOutputChannel("SBAtlas Coverage");
  channel.clear();
  channel.appendLine("═══════════════════════════════════════════════════════");
  channel.appendLine("  SBAtlas — Coverage Report");
  channel.appendLine("═══════════════════════════════════════════════════════");
  channel.appendLine("");
  channel.appendLine(report.description);
  channel.appendLine("");

  // ── Per-requirement detail
  channel.appendLine("───────────────────────────────────────────────────────");
  channel.appendLine("  Requirements");
  channel.appendLine("───────────────────────────────────────────────────────");
  channel.appendLine("");

  for (const rc of report.requirements) {
    const icon = statusIcon(rc.status);
    const preview = truncate(rc.requirement.content, 70);

    channel.appendLine(
      `  ${icon}  [${rc.requirement.id}] ${preview}`
    );
    channel.appendLine(
      `      Status: ${rc.status}  |  ` +
        `Tasks: ${rc.tasks.length}  |  ` +
        `Completed: ${rc.completedTaskCount}`
    );

    if (rc.tasks.length > 0) {
      for (const task of rc.tasks) {
        const taskIcon = task.isComplete ? "  ✓" : "  ○";
        channel.appendLine(
          `      ${taskIcon}  ${truncate(task.title, 60)}  (${task.status})`
        );
      }
    }

    channel.appendLine("");
  }

  // ── Orphan tasks 
  if (report.orphanTasks.length > 0) {
    channel.appendLine("───────────────────────────────────────────────────────");
    channel.appendLine("  Orphan Tasks (no requirement link)");
    channel.appendLine("───────────────────────────────────────────────────────");
    channel.appendLine("");

    for (const orphan of report.orphanTasks) {
      channel.appendLine(
        `  ⚠  ${orphan.task.title}`
      );
      channel.appendLine(
        `      Phase: ${orphan.phaseName}  |  Module: ${orphan.moduleName}`
      );
      channel.appendLine("");
    }
  }

  // ── Warnings 
  if (report.warnings.length > 0) {
    channel.appendLine("───────────────────────────────────────────────────────");
    channel.appendLine("  Warnings");
    channel.appendLine("───────────────────────────────────────────────────────");
    channel.appendLine("");

    for (const warning of report.warnings) {
      channel.appendLine(`  ${warning}`);
    }

    channel.appendLine("");
  }

  channel.appendLine("═══════════════════════════════════════════════════════");
  channel.show(true);

  // ── Short notification
  const uncoveredAction =
    report.uncoveredCount > 0 ? "Show Uncovered" : undefined;

  const clicked = await vscode.window.showInformationMessage(
    `SBAtlas: Coverage ${report.coveragePercentage}% ` +
      `(${report.coveredCount}/${report.totalRequirements} covered)` +
      (report.uncoveredCount > 0
        ? ` — ${report.uncoveredCount} uncovered`
        : " — all requirements addressed ✓"),
    ...(uncoveredAction ? [uncoveredAction] : [])
  );

  if (clicked === "Show Uncovered") {
    // Show uncovered requirements in a QuickPick for easy scanning
    const uncovered = report.requirements.filter(
      (r) => r.status === RequirementCoverageStatus.Uncovered
    );

    await vscode.window.showQuickPick(
      uncovered.map((rc) => ({
        label: `$(warning)  ${truncate(rc.requirement.content, 70)}`,
        detail: `ID: ${rc.requirement.id}  |  No tasks address this requirement`,
      })),
      {
        title: "SBAtlas — Uncovered Requirements",
        placeHolder: `${uncovered.length} requirement${uncovered.length === 1 ? "" : "s"} with no tasks`,
      }
    );
  }
}

function statusIcon(status: RequirementCoverageStatus): string {
  const icons: Record<RequirementCoverageStatus, string> = {
    [RequirementCoverageStatus.Covered]: "✅",
    [RequirementCoverageStatus.Partial]: "🔶",
    [RequirementCoverageStatus.Uncovered]: "❌",
  };
  return icons[status];
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}