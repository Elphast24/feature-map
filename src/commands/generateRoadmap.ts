import * as vscode from "vscode";
import { RoadmapService } from "../services/roadmap/roadmapService";

export async function generateRoadmapCommand(
  roadmapService: RoadmapService
): Promise<void> {
  // Guard: confirm overwrite if roadmap exists
  const existing = roadmapService.getRoadmap();

  if (existing) {
    const overwrite = await vscode.window.showWarningMessage(
      `A roadmap already exists (${existing.totalTaskCount()} tasks, ` +
        `${existing.completionPercentage()}% complete). ` +
        `Generating a new one will replace it. Continue?`,
      { modal: true },
      "Generate New Roadmap"
    );

    if (overwrite !== "Generate New Roadmap") {
      return;
    }
  }

  // Show progress while the AI works
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "SBAtlas: Generating roadmap...",
      cancellable: false,
    },
    async (progress) => {
      progress.report({
        message: "Sending requirements to AI...",
      });

      const result = await roadmapService.generateRoadmap();

      if (!result.ok) {
        vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
        return;
      }

      const { roadmap, warnings, tokensUsed } = result.data;

      // Show success summary
      const summary =
        `Roadmap generated: ` +
        `${roadmap.phaseCount()} phases, ` +
        `${roadmap.totalTaskCount()} tasks. ` +
        `(${tokensUsed} tokens used)`;

      vscode.window.showInformationMessage(`SBAtlas: ${summary}`);

      // Show warnings if any
      if (warnings.length > 0) {
        const warningText = warnings.join("\n• ");
        vscode.window.showWarningMessage(
          `SBAtlas: AI reported ${warnings.length} warning(s):\n• ${warningText}`
        );
      }
    }
  );
}