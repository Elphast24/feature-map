import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { TaskStatus } from "../models/task";


export async function batchUpdateTasksCommand(
  roadmapService: RoadmapService
): Promise<void> {
  const roadmap = roadmapService.getRoadmap();

  if (!roadmap) {
    vscode.window.showWarningMessage(
      "SBAtlas: No roadmap found."
    );
    return;
  }

  if (roadmap.totalTaskCount() === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: No tasks in the roadmap."
    );
    return;
  }

  //  Multi-select tasks 
  const allTasks = roadmap.phases.flatMap((p) =>
    p.modules.flatMap((m) =>
      m.tasks.map((t) => ({
        label: `${statusIcon(t.status)}  ${t.title}`,
        description: `${p.title} → ${m.title}`,
        detail: `Status: ${t.status}`,
        taskId: t.id,
        picked: false,
      }))
    )
  );

  const selected = await vscode.window.showQuickPick(allTasks, {
    title: "SBAtlas — Batch Update Tasks",
    placeHolder: "Select tasks to update (multi-select with Space)",
    canPickMany: true,
    matchOnDescription: true,
  });

  if (!selected || selected.length === 0) {
    return;
  }

  //  Pick target status 
  const statusOptions = [
    {
      label: "$(circle-outline)  Pending",
      description: "Reset to not started",
      status: TaskStatus.Pending,
    },
    {
      label: "$(play)  In Progress",
      description: "Mark as currently being worked on",
      status: TaskStatus.InProgress,
    },
    {
      label: "$(check)  Done",
      description: "Mark as completed",
      status: TaskStatus.Done,
    },
    {
      label: "$(arrow-right)  Skipped",
      description: "Mark as deliberately excluded",
      status: TaskStatus.Skipped,
    },
  ];

  const targetStatus = await vscode.window.showQuickPick(
    statusOptions,
    {
      title: `SBAtlas — Set Status for ${selected.length} Task${selected.length === 1 ? "" : "s"}`,
      placeHolder: "Select the new status",
    }
  );

  if (!targetStatus) {
    return;
  }

  //  Apply 
  const taskIds = selected.map((item) => (item as any).taskId as string);

  const result = await roadmapService.batchUpdateTaskStatus(
    taskIds,
    targetStatus.status
  );

  if (!result.ok) {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
    return;
  }

  const { updated, failed, errors } = result.data;

  let message = `SBAtlas: Updated ${updated} task${updated === 1 ? "" : "s"} to "${targetStatus.status}".`;

  if (failed > 0) {
    message += ` (${failed} failed)`;
  }

  vscode.window.showInformationMessage(message);

  if (errors.length > 0) {
    const channel = vscode.window.createOutputChannel(
      "SBAtlas Batch Update"
    );
    channel.clear();
    errors.forEach((e) => channel.appendLine(`• ${e}`));
    channel.show(true);
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