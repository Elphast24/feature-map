import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { SettingsService } from "../services/settings/settingsService";

export async function createProjectCommand(
  service: ProjectService,
  settingsService: SettingsService
): Promise<void> {
  // Name
  const name = await vscode.window.showInputBox({
    title: "SBAtlas — New Project",
    prompt: "Enter a name for your project",
    placeHolder: "e.g. Inventory System",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Project name is required.";
      }
      if (value.trim().length > 100) {
        return "Project name cannot exceed 100 characters.";
      }
      return null;
    },
  });

  if (name === undefined) {
    return;
  }

  // Description
  const description = await vscode.window.showInputBox({
    title: "SBAtlas — New Project",
    prompt: "Enter a short description (optional)",
    placeHolder: "e.g. Track warehouse stock levels.",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (value && value.length > 500) {
        return "Description cannot exceed 500 characters.";
      }
      return null;
    },
  });

  if (description === undefined) {
    return;
  }

  // Author — pre-filled from workspace settings
  const defaultAuthor = settingsService.getSettings().defaultAuthor;

  const author = await vscode.window.showInputBox({
    title: "SBAtlas — New Project",
    prompt: "Enter your name as author (optional)",
    placeHolder: "e.g. Alex",
    value: defaultAuthor, // ← pre-filled from settings
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (value && value.trim().length > 100) {
        return "Author name cannot exceed 100 characters.";
      }
      return null;
    },
  });

  if (author === undefined) {
    return;
  }

  const result = await service.createProject({
    name,
    description: description || undefined,
    author: author || undefined,
  });

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Project "${result.data.name}" created.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}