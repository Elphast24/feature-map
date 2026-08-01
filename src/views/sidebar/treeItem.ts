import * as vscode from "vscode";
import { Project, ProjectStatus } from "../../models/project";
import { Requirement } from "../../models/requirement";
import { Roadmap } from "../../models/roadMap";
import { Phase, PhaseStatus } from "../../models/phase";
import { Module, ModuleStatus } from "../../models/module";
import { Task, TaskStatus } from "../../models/task";

export const ContextValues = {
  projectRoot: "projectRoot",
  requirementsSection: "requirementsSection",
  requirementItem: "requirementItem",
  metadataSection: "metadataSection",
  metadataItem: "metadataItem",
  emptyState: "emptyState",
  roadmapSection: "roadmapSection",
  phaseItem: "phaseItem",
  moduleItem: "moduleItem",
  taskItem: "taskItem",
} as const;

export abstract class SBAtlasTreeItem extends vscode.TreeItem {
  abstract readonly contextValue: string;
}

export class EmptyStateItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.emptyState;

  constructor() {
    super(
      "No project found. Click to create one.",
      vscode.TreeItemCollapsibleState.None
    );
    this.tooltip = "Create a new SBAtlas project in this workspace";
    this.iconPath = new vscode.ThemeIcon("add");
    this.command = {
      command: "sbatlas.createProject",
      title: "Create Project",
    };
  }
}


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
    this.tooltip =
      count === 0
        ? "No requirements yet. Right-click to add one."
        : `${count} requirement${count === 1 ? "" : "s"}`;
    this.iconPath = new vscode.ThemeIcon("list-unordered");
  }
}


// Requirement item
export class RequirementItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.requirementItem;
  readonly requirement: Requirement;

  constructor(requirement: Requirement, index: number) {
    const priorityIcon = RequirementItem.priorityIcon(
      requirement.priority
    );
    const label = `${priorityIcon} ${index + 1}. ${truncate(requirement.content, 50)}`;

    super(label, vscode.TreeItemCollapsibleState.None);

    this.requirement = requirement;

    // Show tags in description if they exist
    const tagText =
      requirement.tags.length > 0
        ? requirement.tags.join(", ")
        : "";

    this.description = tagText;

    this.tooltip = new vscode.MarkdownString(
      `**Requirement ${index + 1}**\n\n` +
        `${requirement.content}\n\n` +
        `Priority: ${requirement.priority}\n\n` +
        `Source: ${requirement.source}\n\n` +
        (requirement.tags.length > 0
          ? `Tags: ${requirement.tags.join(", ")}\n\n`
          : "") +
        `Added: ${requirement.createdAt.toLocaleDateString()}`
    );

    this.iconPath = new vscode.ThemeIcon("circle-small-filled");

    this.command = {
      command: "sbatlas.editRequirement",
      title: "Edit Requirement",
      arguments: [requirement.id],
    };
  }

  private static priorityIcon(priority: string): string {
    const icons: Record<string, string> = {
      high: "🔴",
      medium: "🟡",
      low: "🟢",
    };
    return icons[priority] ?? "🟡";
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

export class MetadataItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.metadataItem;

  constructor(label: string, value: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
    this.iconPath = new vscode.ThemeIcon("dash");
    this.tooltip = `${label}: ${value}`;
  }
}


// Roadmap section
export class RoadmapSectionItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.roadmapSection;

  constructor(roadmap: Roadmap | null) {
    const hasRoadmap = roadmap !== null && roadmap.phaseCount() > 0;

    super(
      "Roadmap",
      hasRoadmap
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    if (hasRoadmap) {
      const percentage = roadmap!.completionPercentage();
      this.description = `${percentage}% complete`;
      this.tooltip = new vscode.MarkdownString(
        `**Roadmap**\n\n` +
          `Phases: ${roadmap!.phaseCount()}\n\n` +
          `Tasks: ${roadmap!.completedTaskCount()}/${roadmap!.totalTaskCount()}\n\n` +
          `Progress: ${percentage}%`
      );
    } else {
      this.description = "Not generated";
      this.tooltip = "Generate a roadmap from your requirements";
    }

    this.iconPath = new vscode.ThemeIcon("map");
  }
}

/**
 * Shown inside the Roadmap section when no roadmap exists.
 * Clicking it fires the generateRoadmap command.
 */
export class RoadmapEmptyItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.emptyState;

  constructor() {
    super(
      "No roadmap. Click to generate one.",
      vscode.TreeItemCollapsibleState.None
    );
    this.tooltip = "Generate a development roadmap from your requirements";
    this.iconPath = new vscode.ThemeIcon("sparkle");
    this.command = {
      command: "sbatlas.generateRoadmap",
      title: "Generate Roadmap",
    };
  }
}


// Phase item
export class PhaseItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.phaseItem;
  readonly phase: Phase;

  constructor(phase: Phase) {
    super(
      `Phase ${phase.order}: ${phase.title}`,
      vscode.TreeItemCollapsibleState.Expanded
    );

    this.phase = phase;

    const percentage = phase.completionPercentage();
    this.description = PhaseItem.statusLabel(phase.status, percentage);

    this.tooltip = new vscode.MarkdownString(
      `**Phase ${phase.order} — ${phase.title}**\n\n` +
        `${phase.description ? phase.description + "\n\n" : ""}` +
        `Status: ${phase.status}\n\n` +
        `Modules: ${phase.moduleCount()}\n\n` +
        `Tasks: ${phase.completedTaskCount()}/${phase.taskCount()}\n\n` +
        `Progress: ${percentage}%`
    );

    this.iconPath = new vscode.ThemeIcon(
      PhaseItem.statusThemeIcon(phase.status),
      PhaseItem.statusColor(phase.status)
    );
  }

  private static statusLabel(
    status: PhaseStatus,
    percentage: number
  ): string {
    if (status === PhaseStatus.Completed) {
      return "✓ Complete";
    }
    if (status === PhaseStatus.InProgress) {
      return `${percentage}%`;
    }
    return "Not started";
  }

  private static statusThemeIcon(status: PhaseStatus): string {
    const icons: Record<PhaseStatus, string> = {
      [PhaseStatus.Completed]: "pass-filled",
      [PhaseStatus.InProgress]: "loading~spin",
      [PhaseStatus.NotStarted]: "circle-large-outline",
    };
    return icons[status];
  }

  private static statusColor(
    status: PhaseStatus
  ): vscode.ThemeColor | undefined {
    const colors: Record<PhaseStatus, string | undefined> = {
      [PhaseStatus.Completed]: "testing.iconPassed",
      [PhaseStatus.InProgress]: "charts.yellow",
      [PhaseStatus.NotStarted]: undefined,
    };
    const color = colors[status];
    return color ? new vscode.ThemeColor(color) : undefined;
  }
}


// Module item


export class ModuleItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.moduleItem;
  readonly module: Module;

  constructor(module: Module) {
    const hasIncompleteTasks = module.completionPercentage() < 100;

    super(
      module.title,
      hasIncompleteTasks
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.module = module;

    const percentage = module.completionPercentage();
    this.description = `${percentage}% (${module.completedTaskCount()}/${module.taskCount()})`;

    this.tooltip = new vscode.MarkdownString(
      `**${module.title}**\n\n` +
        `${module.description ? module.description + "\n\n" : ""}` +
        `Status: ${module.status}\n\n` +
        `Tasks: ${module.completedTaskCount()}/${module.taskCount()}\n\n` +
        `Progress: ${percentage}%`
    );

    this.iconPath = new vscode.ThemeIcon(
      ModuleItem.statusIcon(module.status)
    );
  }

  private static statusIcon(status: ModuleStatus): string {
    const icons: Record<ModuleStatus, string> = {
      [ModuleStatus.Completed]: "package",
      [ModuleStatus.InProgress]: "package",
      [ModuleStatus.NotStarted]: "package",
    };
    return icons[status];
  }
}


// Task item

export class TaskItem extends SBAtlasTreeItem {
  readonly contextValue = ContextValues.taskItem;
  readonly task: Task;

  constructor(task: Task, allTasks: Map<string, Task>) {
    super(task.title, vscode.TreeItemCollapsibleState.None);

    this.task = task;

    const isBlocked =
      task.blockedBy.length > 0 && !task.isUnblocked(allTasks);

    this.description = [
      isBlocked ? "⛔ blocked" : null,
      task.blockedBy.length > 0 && !isBlocked
        ? "🔓 unblocked"
        : null,
      TaskItem.typeLabel(task.type),
    ]
      .filter(Boolean)
      .join("  ");

    this.tooltip = new vscode.MarkdownString(
      `**${task.title}**\n\n` +
        `${task.description ? task.description + "\n\n" : ""}` +
        `Status: ${task.status}\n\n` +
        `Type: ${task.type}\n\n` +
        (task.estimatedEffort
          ? `Effort: ${task.estimatedEffort} points\n\n`
          : "") +
        (isBlocked ? `⛔ **Blocked** — complete prerequisite tasks first.\n\n` : "") +
        (task.blockedBy.length > 0
          ? `Blockers: ${task.blockedBy.length} task(s)\n\n`
          : "") +
        (task.notes ? `**Notes:**\n${task.notes}\n\n` : "") +
        (task.requirementIds.length > 0
          ? `Linked to ${task.requirementIds.length} requirement(s)\n\n`
          : "⚠ No requirement link\n\n") +
        `Updated: ${task.updatedAt.toLocaleDateString()}`
    );

    this.iconPath = new vscode.ThemeIcon(
      isBlocked
        ? "circle-slash"
        : TaskItem.statusThemeIcon(task.status),
      isBlocked
        ? new vscode.ThemeColor("errorForeground")
        : TaskItem.statusColor(task.status)
    );

    this.command = {
      command: "sbatlas.updateTaskStatus",
      title: "Update Task Status",
      arguments: [task.id],
    };
  }

  private static statusThemeIcon(status: TaskStatus): string {
    const icons: Record<TaskStatus, string> = {
      [TaskStatus.Pending]: "circle-outline",
      [TaskStatus.InProgress]: "play-circle",
      [TaskStatus.Done]: "pass-filled",
      [TaskStatus.Skipped]: "debug-step-over",
    };
    return icons[status];
  }

  private static statusColor(
    status: TaskStatus
  ): vscode.ThemeColor | undefined {
    const colors: Record<TaskStatus, string | undefined> = {
      [TaskStatus.Pending]: undefined,
      [TaskStatus.InProgress]: "charts.yellow",
      [TaskStatus.Done]: "testing.iconPassed",
      [TaskStatus.Skipped]: "disabledForeground",
    };
    const color = colors[status];
    return color ? new vscode.ThemeColor(color) : undefined;
  }

  private static typeLabel(type: string): string {
    const labels: Record<string, string> = {
      feature: "feature",
      test: "test",
      refactor: "refactor",
      docs: "docs",
      config: "config",
      research: "research",
      security: "security",
      bugfix: "bugfix",
    };
    return labels[type] ?? type;
  }
}


// Helpers


function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trimEnd() + "…";
}