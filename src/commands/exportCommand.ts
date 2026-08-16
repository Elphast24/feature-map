import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { ExportService, ExportFormat } from "../services/export/exportService";


export async function exportCommand(
  projectService: ProjectService,
  roadmapService: RoadmapService,
  exportService: ExportService
): Promise<void> {
  const project = projectService.getProject();

  if (!project) {
    vscode.window.showWarningMessage(
      "SBAtlas: No project to export."
    );
    return;
  }

  const roadmap = roadmapService.getRoadmap();

  interface FormatItem extends vscode.QuickPickItem {
    format: ExportFormat;
  }

  const formats: FormatItem[] = [
    {
      label: "$(markdown)  Markdown Report",
      description: "Full project report as .md",
      detail:
        "Requirements, roadmap, progress, and coverage in a readable document.",
      format: "markdown",
    },
    {
      label: "$(json)  JSON Export",
      description: "Complete project data as .json",
      detail:
        "Machine-readable export for external tools and integrations.",
      format: "json",
    },
    {
      label: "$(table)  CSV — Coverage Report",
      description: "Requirement coverage as .csv",
      detail:
        "Spreadsheet-friendly: requirement, status, task count.",
      format: "csv-coverage",
    },
    {
      label: "$(table)  CSV — Task List",
      description: "All tasks as .csv",
      detail:
        "Spreadsheet-friendly: phase, module, task, status, type.",
      format: "csv-tasks",
    },
  ];

  const selected = await vscode.window.showQuickPick(formats, {
    title: "SBAtlas — Export",
    placeHolder: "Select an export format",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!selected) {
    return;
  }

  const result = await exportService.exportToFile(
    project,
    roadmap,
    selected.format
  );

  if (!result.ok) {
    if (result.error !== "Export cancelled.") {
      vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
    }
    return;
  }

  // Success
  const openFile = await vscode.window.showInformationMessage(
    `SBAtlas: Exported to ${result.data.fsPath}`,
    "Open File"
  );

  if (openFile === "Open File") {
    await vscode.window.showTextDocument(result.data);
  }
}