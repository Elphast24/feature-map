import * as vscode from "vscode";
import { Project, ProjectStatus } from "../../models/project";
import { Roadmap } from "../../models/roadMap";

export class SBAtlasStatusBarItem {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.renderNoProject();
    this.item.show();
  }


  update(project: Project | null, roadmap?: Roadmap | null): void {
    if (!project) {
      this.renderNoProject();
    } else {
      this.renderProject(project, roadmap ?? null);
    }
  }

  dispose(): void {
    this.item.dispose();
  }

  private renderNoProject(): void {
    this.item.text = "$(map) SBAtlas: No Project";
    this.item.tooltip =
      "SBAtlas — No project in this workspace. Click to create one.";
    this.item.command = "sbatlas.createProject";
    this.item.backgroundColor = undefined;
  }

  private renderProject(project: Project, roadmap: Roadmap | null): void {
    const statusIcon = SBAtlasStatusBarItem.statusIcon(project.status);

    if (roadmap) {
      const percentage = roadmap.completionPercentage();
      const completed = roadmap.completedTaskCount();
      const total = roadmap.totalTaskCount();

      this.item.text =
        `$(map)  ${project.name}  ${statusIcon}  ${percentage}% (${completed}/${total} tasks)`;

      this.item.tooltip = new vscode.MarkdownString(
        `**SBAtlas — ${project.name}**\n\n` +
          `Status: ${project.status}\n\n` +
          `Progress: ${percentage}% (${completed}/${total} tasks)\n\n` +
          `Phases: ${roadmap.phaseCount()}\n\n` +
          `Requirements: ${project.requirementCount()}\n\n` +
          `_Click to open SBAtlas commands_`
      );
    } else {
      const count = project.requirementCount();
      const reqLabel = `${count} ${count === 1 ? "requirement" : "requirements"}`;

      this.item.text =
        `$(map)  ${project.name}  ${statusIcon}  ${reqLabel}`;

      this.item.tooltip = new vscode.MarkdownString(
        `**SBAtlas — ${project.name}**\n\n` +
          `Status: ${project.status}\n\n` +
          `Requirements: ${count}\n\n` +
          `No roadmap generated yet.\n\n` +
          `_Click to open SBAtlas commands_`
      );
    }

    this.item.command = "workbench.action.quickOpen";
    this.item.backgroundColor = undefined;
  }

  private static statusIcon(status: ProjectStatus): string {
    const icons: Record<ProjectStatus, string> = {
      [ProjectStatus.Active]: "●",
      [ProjectStatus.Paused]: "⏸",
      [ProjectStatus.Completed]: "✓",
      [ProjectStatus.Archived]: "◌",
    };
    return icons[status];
  }
}