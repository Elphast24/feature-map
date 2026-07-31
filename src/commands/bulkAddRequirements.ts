import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import {
  parseRequirementBlock,
  deduplicateRequirements,
} from "../utils/requirementParser";

export async function bulkAddRequirementsCommand(
  service: ProjectService
): Promise<void> {
  if (!service.getProject()) {
    const action = await vscode.window.showWarningMessage(
      "SBAtlas: No project found. Create a project first.",
      "Create Project"
    );
    if (action === "Create Project") {
      await vscode.commands.executeCommand("sbatlas.createProject");
    }
    return;
  }

  // VS Code input boxes are single-line. For multi-line input we
  // open a temporary untitled document where the user can paste.
  const doc = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: [
      "# SBAtlas — Bulk Add Requirements",
      "",
      "# Paste your requirements below, one per line.",
      "# Markdown lists (- item, * item, 1. item) are supported.",
      "# Lines starting with # are ignored.",
      "# When done, run the command: SBAtlas: Confirm Bulk Add",
      "",
      "",
    ].join("\n"),
  });

  await vscode.window.showTextDocument(doc);

  // Register a temporary command that processes the document
  const disposable = vscode.commands.registerCommand(
    "sbatlas.confirmBulkAdd",
    async () => {
      const text = doc.getText();

      // Parse
      const parsed = parseRequirementBlock(text);

      if (parsed.length === 0) {
        vscode.window.showWarningMessage(
          "SBAtlas: No requirements found. Write one per line."
        );
        return;
      }

      // Deduplicate
      const existingContents = service
        .getProject()!
        .requirements.map((r) => r.content);

      const unique = deduplicateRequirements(
        parsed,
        existingContents
      );

      if (unique.length === 0) {
        vscode.window.showInformationMessage(
          `SBAtlas: All ${parsed.length} requirements already exist.`
        );
        return;
      }

      // Confirm
      const duplicateCount = parsed.length - unique.length;
      const msg =
        `Add ${unique.length} requirement${unique.length === 1 ? "" : "s"}?` +
        (duplicateCount > 0
          ? ` (${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} skipped)`
          : "");

      const confirm = await vscode.window.showInformationMessage(
        `SBAtlas: ${msg}`,
        "Add All",
        "Cancel"
      );

      if (confirm !== "Add All") {
        return;
      }

      // Add
      const result = await service.addRequirementsBulk(
        unique.map((line) => ({
          content: line.content,
          source: "bulk" as const,
        }))
      );

      if (result.ok) {
        vscode.window.showInformationMessage(
          `SBAtlas: Added ${result.data.added.length} requirement${result.data.added.length === 1 ? "" : "s"}.`
        );

        // Close the temporary document
        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor"
        );
      } else {
        vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
      }

      disposable.dispose();
    }
  );
}