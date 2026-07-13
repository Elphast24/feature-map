import * as vscode from "vscode";
import { WorkspaceStorage } from "./services/storage/workspaceStorage";
import { ProjectService } from "./services/project/projectService";
import { ValidationService } from "./services/validation/validationService";
import { registerCommands } from "./commands/index";

export let projectService: ProjectService;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log("[SBAtlas] Activating...");

  // ── Build the stack ────────────────────────────────────────────
  const storage = new WorkspaceStorage(context.workspaceState);
  const validator = new ValidationService();
  projectService = new ProjectService(storage, validator);

  // ── Load any existing project into memory ──────────────────────
  const loadResult = await projectService.loadProject();

  if (loadResult.ok && loadResult.data) {
    console.log(
      `[SBAtlas] Loaded project: "${loadResult.data.name}"`
    );
  } else {
    console.log("[SBAtlas] No existing project in this workspace.");
  }

  // ── Register commands ──────────────────────────────────────────
  registerCommands(context, projectService);

  console.log("[SBAtlas] Activated successfully.");
}

export function deactivate(): void {
  console.log("[SBAtlas] Deactivated.");
}