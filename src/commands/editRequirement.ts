import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { Requirement } from "../models/requirement";

export async function editRequirementCommand(
  service: ProjectService,
  requirementId?: string
): Promise<void> {
  const project = service.getProject();

  if (!project) {
    vscode.window.showWarningMessage(
      "SBAtlas: No project found in this workspace."
    );
    return;
  }

  if (project.requirementCount() === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: This project has no requirements yet. Add one first."
    );
    return;
  }

  // ── Resolve which requirement to edit ─────────────────────────
  let targetRequirement: Requirement | undefined;

  if (requirementId) {
    // Called from tree context menu — ID was passed as an argument
    targetRequirement = project.findRequirement(requirementId);

    if (!targetRequirement) {
      vscode.window.showErrorMessage(
        `SBAtlas: Requirement not found.`
      );
      return;
    }
  } else {
    // Called from Command Palette — show QuickPick
    interface RequirementQuickPickItem extends vscode.QuickPickItem {
      requirement: Requirement;
    }

    const items: RequirementQuickPickItem[] = project.requirements.map(
      (req, index) => ({
        label: `$(circle-small) ${index + 1}. ${truncate(req.content, 60)}`,
        detail: req.content,
        requirement: req,
      })
    );

    const selected = await vscode.window.showQuickPick(items, {
      title: "SBAtlas — Edit Requirement",
      placeHolder: "Select a requirement to edit",
      matchOnDetail: true,
    });

    if (!selected) {
      return;
    }

    targetRequirement = selected.requirement;
  }

  // ── Edit the selected requirement ──────────────────────────────
  const newContent = await vscode.window.showInputBox({
    title: "SBAtlas — Edit Requirement",
    prompt: "Edit the requirement content",
    value: targetRequirement.content,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Requirement cannot be empty.";
      }
      if (value.trim().length > 2000) {
        return "Requirement cannot exceed 2000 characters.";
      }
      return null;
    },
  });

  if (newContent === undefined) {
    return;
  }

  const result = await service.editRequirement(
    targetRequirement.id,
    newContent
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      "SBAtlas: Requirement updated successfully."
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trimEnd() + "…";
}