import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import {
  parseRequirementBlock,
  deduplicateRequirements,
} from "../utils/requirementParser";

export async function importRequirementsCommand(
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

  //  Pick a file 
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "Import Requirements",
    title: "SBAtlas — Select a file to import requirements from",
    filters: {
      "Text & Markdown": ["md", "markdown", "txt", "text"],
      "All Files": ["*"],
    },
  });

  if (!uris || uris.length === 0) {
    return;
  }

  //  Read the file
  const fileUri = uris[0];
  let fileContent: string;

  try {
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    fileContent = Buffer.from(bytes).toString("utf8");
  } catch (error) {
    vscode.window.showErrorMessage(
      `SBAtlas: Could not read file. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return;
  }

  if (fileContent.trim().length === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: The selected file is empty."
    );
    return;
  }

  //  Parse 
  const parsed = parseRequirementBlock(fileContent);

  if (parsed.length === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: No requirements could be extracted from the file. " +
        "Make sure requirements are listed one per line."
    );
    return;
  }

  //  Deduplicate 
  const existingContents = service
    .getProject()!
    .requirements.map((r) => r.content);

  const unique = deduplicateRequirements(parsed, existingContents);

  if (unique.length === 0) {
    vscode.window.showInformationMessage(
      `SBAtlas: All ${parsed.length} requirements from the file already exist.`
    );
    return;
  }

  //  Preview and confirm
  const duplicateCount = parsed.length - unique.length;

  const confirmMessage =
    `Found ${unique.length} new requirement${unique.length === 1 ? "" : "s"} ` +
    `in the file.` +
    (duplicateCount > 0
      ? ` (${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} will be skipped.)`
      : "");

  const confirm = await vscode.window.showInformationMessage(
    `SBAtlas: ${confirmMessage}`,
    { modal: true },
    "Import All"
  );

  if (confirm !== "Import All") {
    return;
  }

  // Import
  const result = await service.addRequirementsBulk(
    unique.map((line) => ({
      content: line.content,
      source: "imported" as const,
    }))
  );

  if (!result.ok) {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
    return;
  }

  const { added, skipped, errors } = result.data;

  let summary = `Imported ${added.length} requirement${added.length === 1 ? "" : "s"}`;

  if (skipped > 0) {
    summary += `, ${skipped} skipped (duplicates)`;
  }

  if (errors.length > 0) {
    summary += `, ${errors.length} error${errors.length === 1 ? "" : "s"}`;
  }

  vscode.window.showInformationMessage(`SBAtlas: ${summary}.`);

  if (errors.length > 0) {
    const channel = vscode.window.createOutputChannel(
      "SBAtlas Import"
    );
    channel.clear();
    channel.appendLine("Import errors:");
    errors.forEach((e) => channel.appendLine(`  • ${e}`));
    channel.show(true);
  }
}