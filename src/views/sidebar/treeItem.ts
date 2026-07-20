import * as vscode from "vscode";
import { Project, ProjectStatus } from "../../models/project";
import { Requirement } from "../../models/requirement";

export const ContextValues = {
  projectRoot: "projectRoot",
  requirementsSection: "requirementsSection",
  requirementItem: "requirementItem",
  metadataSection: "metadataSection",
  metadataItem: "metadataItem",
  emptyState: "emptyState",
} as const;

export abstract class SBAtlasTreeItem extends vscode.TreeItem {
  abstract readonly contextValue: string;
}


export class EmptyStateItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.emptyState;

  constructor() {
    super("No project found. Click to create one.", vscode.TreeItemCollapsibleState.None);

    this.tooltip = "Create a new SBAtlas project in this workspace";
    this.iconPath = new vscode.ThemeIcon("add");

    // Clicking this item fires the create command directly
    this.command = {
      command: "sbatlas.createProject",
      title: "Create Project",
    };
  }
}

// Project root

export class ProjectRootItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.projectRoot;

  constructor(project: Project) {
    super(project.name, vscode.TreeItemCollapsibleState.Expanded);

    this.description = ProjectRootItem.statusLabel(project.status);
    this.tooltip = new vscode.MarkdownString(
      `**${project.name}**\n\n` +
      `${project.description ? project.description + "\n\n" : ""}` +
      `Status: ${project.status}\n\n` +
      `Requirements: ${project.requirementCount()}\n\n` +
      `Author: ${project.metadata.author ?? "—"}\n\n` +
      `Created: ${project.metadata.createdAt.toLocaleDateString()}`
    );

    this.iconPath = new vscode.ThemeIcon(
      "folder",
      new vscode.ThemeColor("charts.blue")
    );
  }

  /**
   * Maps ProjectStatus enum values to readable sidebar labels.
   */
  private static statusLabel(status: ProjectStatus): string {
    const labels: Record<ProjectStatus, string> = {
      [ProjectStatus.Active]: "● Active",
      [ProjectStatus.Paused]: "⏸ Paused",
      [ProjectStatus.Completed]: "✓ Completed",
      [ProjectStatus.Archived]: "◌ Archived",
    };
    return labels[status];
  }
}

// Requirements section

export class RequirementsSectionItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.requirementsSection;

  constructor(count: number) {
    const collapsibleState =
      count > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;

    super("Requirements", collapsibleState);

    this.description = `${count} ${count === 1 ? "item" : "items"}`;
    this.tooltip = count === 0
      ? "No requirements yet. Right-click to add one."
      : `${count} requirement${count === 1 ? "" : "s"}`;

    this.iconPath = new vscode.ThemeIcon("list-unordered");
  }
}


export class RequirementItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.requirementItem;

  /** The full requirement object, needed by editRequirement command */
  readonly requirement: Requirement;

  constructor(requirement: Requirement, index: number) {
    // Truncate long requirements so they fit on one line in the sidebar
    const label = `${index + 1}. ${truncate(requirement.content, 55)}`;

    super(label, vscode.TreeItemCollapsibleState.None);

    this.requirement = requirement;

    // Full content visible on hover
    this.tooltip = new vscode.MarkdownString(
      `**Requirement ${index + 1}**\n\n` +
      `${requirement.content}\n\n` +
      `Source: ${requirement.source}\n\n` +
      `Added: ${requirement.createdAt.toLocaleDateString()}`
    );

    this.iconPath = new vscode.ThemeIcon("circle-small-filled");

    // Clicking a requirement opens the edit command for that specific item
    this.command = {
      command: "sbatlas.editRequirement",
      title: "Edit Requirement",
      arguments: [requirement.id],
    };
  }
}

// Metadata section

export class MetadataSectionItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.metadataSection;

  constructor() {
    super("Details", vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("info");
    this.tooltip = "Project metadata and settings";
  }
}

/**
 * A single key/value row inside the Details section.
 */
export class MetadataItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.metadataItem;

  constructor(label: string, value: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
    this.iconPath = new vscode.ThemeIcon("dash");
    this.tooltip = `${label}: ${value}`;
  }
}

// Helpers

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trimEnd() + "…";
}