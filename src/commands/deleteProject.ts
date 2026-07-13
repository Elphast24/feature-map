import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";

/**
 * Handles the "SBAtlas: Delete Project" command.
 *
 * Always asks for confirmation before destroying data.
 * A delete without a confirmation dialog is a support ticket waiting
 * to happen.
 */
export async function deleteProjectCommand(
  service: ProjectService
): Promise<void> {
  const project = service.getProject();

  // ── Guard: nothing to delete ───────────────────────────────────
  if (!project) {
    vscode.window.showWarningMessage(
      "SBAtlas: No project found in this workspace."
    );
    return;
  }

  // ── Confirmation dialog ────────────────────────────────────────
  // showWarningMessage with button options returns the button label
  // the user clicked, or undefined if they dismissed the dialog.
  const confirmation = await vscode.window.showWarningMessage(
    `Are you sure you want to delete "${project.name}"? This cannot be undone.`,
    { modal: true }, // modal forces the user to respond before doing anything else
    "Delete"         // only show one action button — Cancel is implicit
  );

  // User clicked Cancel or pressed Escape
  if (confirmation !== "Delete") {
    return;
  }

  // ── Call the service ───────────────────────────────────────────
  const result = await service.deleteProject();

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Project "${project.name}" has been deleted.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}