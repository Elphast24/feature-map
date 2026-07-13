// src/commands/editRequirement.ts

import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { Requirement } from "../models/requirement";


export async function editRequirementCommand(
  service: ProjectService
): Promise<void> {
  const project = service.getProject();

  // ── Guard: no project ──────────────────────────────────────────
  if (!project) {
    vscode.window.showWarningMessage(
      "SBAtlas: No project found in this workspace."
    );
    return;
  }

  // ── Guard: no requirements ─────────────────────────────────────
  if (project.requirementCount() === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: This project has no requirements yet. Add one first."
    );
    return;
  }

  // ── Step 1: Pick a requirement ─────────────────────────────────
  /**
   * QuickPickItem extended to carry the Requirement it represents.
   * VS Code's QuickPick items only support label/description/detail,
   * so we attach the full requirement to retrieve it after selection.
   */
  interface RequirementQuickPickItem extends vscode.QuickPickItem {
    requirement: Requirement;
  }

  const items: RequirementQuickPickItem[] = project.requirements.map(
    (req, index) => ({
      // Label: numbered short preview — readable at a glance
      label: `$(circle-small) ${index + 1}. ${truncate(req.content, 60)}`,
      // Detail: full content on a second line for context
      detail: req.content,
      requirement: req,
    })
  );

  const selected = await vscode.window.showQuickPick(items, {
    title: "SBAtlas — Edit Requirement",
    placeHolder: "Select a requirement to edit",
    matchOnDetail: true, // allows searching against the full content
  });

  if (!selected) {
    return;
  }

  // ── Step 2: Edit the content ───────────────────────────────────
  const newContent = await vscode.window.showInputBox({
    title: "SBAtlas — Edit Requirement",
    prompt: "Edit the requirement content",
    value: selected.requirement.content, // pre-fill with current content
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

  // ── Step 3: Call the service ───────────────────────────────────
  const result = await service.editRequirement(
    selected.requirement.id,
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

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trimEnd() + "…";
}