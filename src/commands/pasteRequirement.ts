// src/commands/pasteRequirement.ts

import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";


export async function pasteRequirementCommand(
  service: ProjectService
): Promise<void> {
  // ── Guard: no project loaded ───────────────────────────────────
  if (!service.getProject()) {
    const action = await vscode.window.showWarningMessage(
      "SBAtlas: No project found. Create a project first.",
      "Create Project"
    );

    // This creates a smooth flow instead of a dead end.
    if (action === "Create Project") {
      await vscode.commands.executeCommand("sbatlas.createProject");
    }

    return;
  }

  // ── Collect requirement content ────────────────────────────────
  const content = await vscode.window.showInputBox({
    title: "SBAtlas — Add Requirement",
    prompt: "Enter or paste a requirement",
    placeHolder:
      "e.g. Users must be able to register with an email and password.",
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

  if (content === undefined) {
    return;
  }

  // ── Call the service ───────────────────────────────────────────
  const result = await service.addRequirement({
    content,
    source: "manual",
  });

  if (result.ok) {
    vscode.window.showInformationMessage(
      "SBAtlas: Requirement added successfully."
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}