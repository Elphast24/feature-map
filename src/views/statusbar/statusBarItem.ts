import * as vscode from "vscode";
import { Project, ProjectStatus } from "../../models/project";
export class SBAtlasStatusBarItem {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    // Clicking the status bar item opens the Command Palette
    // pre-filtered to SBAtlas commands.
    this.item.command = "workbench.action.quickOpen";
    this.item.tooltip = "SBAtlas — Click to open commands";

    this.renderNoProject();
    this.item.show();
  }

  // ─────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────

  /**
   * Updates the status bar to reflect the current project state.
   * Call this whenever the project changes.
   */
  update(project: Project | null): void {
    if (!project) {
      this.renderNoProject();
    } else {
      this.renderProject(project);
    }
  }

  /**
   * Disposes the status bar item.
   * Must be called when the extension deactivates.
   */
  dispose(): void {
    this.item.dispose();
  }

  // ─────────────────────────────────────────
  // Private renderers
  // ─────────────────────────────────────────

  private renderNoProject(): void {
    this.item.text = "$(map) SBAtlas: No Project";
    this.item.tooltip =
      "SBAtlas — No project in this workspace. Click to create one.";
    this.item.command = "sbatlas.createProject";
    this.item.backgroundColor = undefined;
  }

  private renderProject(project: Project): void {
    const count = project.requirementCount();
    const statusIcon = StatusBarItem.statusIcon(project.status);
    const reqLabel = `${count} ${count === 1 ? "requirement" : "requirements"}`;

    this.item.text =
      `$(map)  ${project.name}  ${statusIcon}  ${reqLabel}`;

    this.item.tooltip = new vscode.MarkdownString(
      `**SBAtlas — ${project.name}**\n\n` +
      `Status: ${project.status}\n\n` +
      `Requirements: ${count}\n\n` +
      `Author: ${project.metadata.author ?? "—"}\n\n` +
      `Last updated: ${project.metadata.updatedAt.toLocaleDateString()}\n\n` +
      `_Click to open SBAtlas commands_`
    );

    this.item.command = "workbench.action.quickOpen";
    this.item.backgroundColor = undefined;
  }
}

/**
 * Maps ProjectStatus to a compact visual indicator.
 */
namespace StatusBarItem {
  export function statusIcon(status: ProjectStatus): string {
    const icons: Record<ProjectStatus, string> = {
      [ProjectStatus.Active]: "●",
      [ProjectStatus.Paused]: "⏸",
      [ProjectStatus.Completed]: "✓",
      [ProjectStatus.Archived]: "◌",
    };
    return icons[status];
  }
}