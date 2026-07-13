// src/commands/createProject.ts

import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";


export async function createProjectCommand(
  service: ProjectService
): Promise<void> {
  // ── Step 1: Project name ───────────────────────────────────────
  const name = await vscode.window.showInputBox({
    title: "SBAtlas — New Project",
    prompt: "Enter a name for your project",
    placeHolder: "e.g. Inventory System",
    ignoreFocusOut: true, // keeps the box open if user clicks away
    validateInput: (value) => {
      // Inline validation gives the user instant feedback while typing.
      // This is separate from ValidationService — it is purely cosmetic,
      // preventing an obviously bad submission before it even reaches the service.
      if (!value || value.trim().length === 0) {
        return "Project name is required.";
      }
      if (value.trim().length > 100) {
        return "Project name cannot exceed 100 characters.";
      }
      return null; // null means input is valid
    },
  });

  // showInputBox returns undefined if the user pressed Escape.
  // Treat that as a deliberate cancellation — do nothing, no error message.
  if (name === undefined) {
    return;
  }

  // ── Step 2: Description (optional) ────────────────────────────
  const description = await vscode.window.showInputBox({
    title: "SBAtlas — New Project",
    prompt: "Enter a short description (optional — press Enter to skip)",
    placeHolder: "e.g. Track warehouse stock levels in real time.",
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

  // ── Step 3: Author (optional) ──────────────────────────────────
  const author = await vscode.window.showInputBox({
    title: "SBAtlas — New Project",
    prompt: "Enter your name as author (optional — press Enter to skip)",
    placeHolder: "e.g. Alex",
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

  // ── Step 4: Call the service ───────────────────────────────────
  const result = await service.createProject({
    name,
    description: description || undefined,
    author: author || undefined,
  });

  // ── Step 5: Report the outcome ─────────────────────────────────
  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Project "${result.data.name}" created successfully.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}