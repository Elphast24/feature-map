import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { ReportService } from "../services/report/reportService";


export async function generateReportCommand(
  projectService: ProjectService,
  roadmapService: RoadmapService,
  reportService: ReportService,
  workspaceRoot: vscode.Uri | null
): Promise<void> {
  const project = projectService.getProject();

  if (!project) {
    vscode.window.showWarningMessage("SBAtlas: No active project found to report on.");
    return;
  }

  if (!workspaceRoot) {
    vscode.window.showErrorMessage("SBAtlas: An open workspace folder is required to save reports.");
    return;
  }

  const roadmap = roadmapService.getRoadmap();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `SBAtlas: Compiling status report for "${project.name}"...`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Synthesizing metrics and generating executive summary..." });

      const reportResult = await reportService.generateReport(project, roadmap);

      if (!reportResult.ok) {
        vscode.window.showErrorMessage(`SBAtlas: ${reportResult.error}`);
        return;
      }

      const { content, isAiGeneratedSummary, warnings } = reportResult.data;

      progress.report({ message: "Saving report to workspace..." });

      const saveResult = await reportService.saveReport(workspaceRoot, project, content);

      if (!saveResult.ok) {
        vscode.window.showErrorMessage(`SBAtlas: ${saveResult.error}`);
        return;
      }

      const fileUri = saveResult.data;

      // Notify user with action buttons
      const summaryType = isAiGeneratedSummary ? "AI Executive Summary" : "Rule-Based Summary";
      const msg = `SBAtlas: Report generated with ${summaryType}!`;

      vscode.window
        .showInformationMessage(msg, "Open Report", "Open Preview")
        .then(async (action) => {
          if (action === "Open Report") {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc);
          } else if (action === "Open Preview") {
            await vscode.commands.executeCommand("markdown.showPreview", fileUri);
          }
        });

      if (warnings.length > 0) {
        console.warn("[SBAtlas] Report warnings:", warnings);
      }
    }
  );
}