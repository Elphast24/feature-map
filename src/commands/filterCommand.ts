import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { SidebarProvider } from "../views/sidebar/sidebarProvider";
import { TaskStatus, TaskType } from "../models/task";
import { RequirementPriority } from "../models/requirement";
import {
  SidebarFilters,
  emptyFilters,
  isFiltersEmpty,
} from "../services/search/searchTypes";

export async function filterCommand(
  sidebar: SidebarProvider,
  projectService: ProjectService,
  roadmapService: RoadmapService
): Promise<void> {
  const currentFilters = sidebar.getFilters();
  const hasFilters = !isFiltersEmpty(currentFilters);

  // Build filter menu
  const options: vscode.QuickPickItem[] = [
    {
      label: "$(filter)  Filter by Task Status",
      description: currentFilters.taskStatus
        ? `Active: ${currentFilters.taskStatus}`
        : "",
    },
    {
      label: "$(symbol-enum)  Filter by Task Type",
      description: currentFilters.taskType
        ? `Active: ${currentFilters.taskType}`
        : "",
    },
    {
      label: "$(folder)  Filter by Phase",
      description: currentFilters.phaseId
        ? "Active: phase filtered"
        : "",
    },
    {
      label: "$(arrow-up)  Filter by Requirement Priority",
      description: currentFilters.requirementPriority
        ? `Active: ${currentFilters.requirementPriority}`
        : "",
    },
    {
      label: "$(tag)  Filter by Requirement Tag",
      description: currentFilters.requirementTag
        ? `Active: ${currentFilters.requirementTag}`
        : "",
    },
    {
      label: "$(search)  Search Text",
      description: currentFilters.searchQuery
        ? `Active: "${currentFilters.searchQuery}"`
        : "",
    },
  ];

  if (hasFilters) {
    options.push({
      label: "",
      kind: vscode.QuickPickItemKind.Separator,
    });
    options.push({
      label: "$(close)  Clear All Filters",
      description: "Show everything",
    });
  }

  const selected = await vscode.window.showQuickPick(options, {
    title: "SBAtlas — Filter",
    placeHolder: hasFilters
      ? "Filters are active — select to change or clear"
      : "Select a filter category",
  });

  if (!selected) {
    return;
  }

  const label = selected.label;

  // Clear all
  if (label.includes("Clear All")) {
    sidebar.setFilters(emptyFilters());
    vscode.window.showInformationMessage(
      "SBAtlas: Filters cleared."
    );
    return;
  }

  // Task status
  if (label.includes("Task Status")) {
    await filterByTaskStatus(sidebar, currentFilters);
    return;
  }

  // Task type
  if (label.includes("Task Type")) {
    await filterByTaskType(sidebar, currentFilters);
    return;
  }

  // Phase
  if (label.includes("Phase")) {
    await filterByPhase(sidebar, currentFilters, roadmapService);
    return;
  }

  // Priority
  if (label.includes("Priority")) {
    await filterByPriority(sidebar, currentFilters);
    return;
  }

  // Tag
  if (label.includes("Tag")) {
    await filterByTag(sidebar, currentFilters, projectService);
    return;
  }

  // Search text
  if (label.includes("Search")) {
    await filterBySearchText(sidebar, currentFilters);
    return;
  }
}

// ── Filter handlers ───────────────────────────────────────────────

async function filterByTaskStatus(
  sidebar: SidebarProvider,
  filters: SidebarFilters
): Promise<void> {
  const options = [
    { label: "All Statuses", status: null },
    { label: "$(circle-outline)  Pending", status: TaskStatus.Pending },
    { label: "$(play)  In Progress", status: TaskStatus.InProgress },
    { label: "$(check)  Done", status: TaskStatus.Done },
    { label: "$(arrow-right)  Skipped", status: TaskStatus.Skipped },
  ];

  const selected = await vscode.window.showQuickPick(
    options.map((o) => ({
      label:
        o.status === filters.taskStatus && o.status !== null
          ? `$(check) ${o.label}`
          : o.label,
      status: o.status,
    })),
    { title: "SBAtlas — Filter by Task Status" }
  );

  if (!selected) {
    return;
  }

  sidebar.setFilters({
    ...filters,
    taskStatus: (selected as any).status,
  });
}

async function filterByTaskType(
  sidebar: SidebarProvider,
  filters: SidebarFilters
): Promise<void> {
  const types: (TaskType | null)[] = [
    null,
    "feature",
    "test",
    "refactor",
    "docs",
    "config",
    "research",
    "security",
    "bugfix",
  ];

  const options = types.map((type) => ({
    label:
      type === filters.taskType && type !== null
        ? `$(check) ${type ?? "All Types"}`
        : type ?? "All Types",
    type,
  }));

  const selected = await vscode.window.showQuickPick(options, {
    title: "SBAtlas — Filter by Task Type",
  });

  if (!selected) {
    return;
  }

  sidebar.setFilters({
    ...filters,
    taskType: (selected as any).type,
  });
}

async function filterByPhase(
  sidebar: SidebarProvider,
  filters: SidebarFilters,
  roadmapService: RoadmapService
): Promise<void> {
  const roadmap = roadmapService.getRoadmap();

  if (!roadmap || roadmap.phaseCount() === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: No roadmap to filter."
    );
    return;
  }

  const options = [
    { label: "All Phases", phaseId: null },
    ...roadmap.phases.map((p) => ({
      label:
        p.id === filters.phaseId
          ? `$(check) Phase ${p.order}: ${p.title}`
          : `Phase ${p.order}: ${p.title}`,
      phaseId: p.id,
    })),
  ];

  const selected = await vscode.window.showQuickPick(options, {
    title: "SBAtlas — Filter by Phase",
  });

  if (!selected) {
    return;
  }

  sidebar.setFilters({
    ...filters,
    phaseId: (selected as any).phaseId,
  });
}

async function filterByPriority(
  sidebar: SidebarProvider,
  filters: SidebarFilters
): Promise<void> {
  const options = [
    { label: "All Priorities", priority: null },
    { label: "🔴  High", priority: "high" as RequirementPriority },
    { label: "🟡  Medium", priority: "medium" as RequirementPriority },
    { label: "🟢  Low", priority: "low" as RequirementPriority },
  ];

  const selected = await vscode.window.showQuickPick(
    options.map((o) => ({
      label:
        o.priority === filters.requirementPriority &&
        o.priority !== null
          ? `$(check) ${o.label}`
          : o.label,
      priority: o.priority,
    })),
    { title: "SBAtlas — Filter by Requirement Priority" }
  );

  if (!selected) {
    return;
  }

  sidebar.setFilters({
    ...filters,
    requirementPriority: (selected as any).priority,
  });
}

async function filterByTag(
  sidebar: SidebarProvider,
  filters: SidebarFilters,
  projectService: ProjectService
): Promise<void> {
  const project = projectService.getProject();

  if (!project) {
    return;
  }

  // Collect all unique tags from requirements
  const allTags = new Set<string>();
  for (const req of project.requirements) {
    for (const tag of req.tags) {
      allTags.add(tag);
    }
  }

  if (allTags.size === 0) {
    vscode.window.showInformationMessage(
      "SBAtlas: No tags found on any requirement."
    );
    return;
  }

  const options = [
    { label: "All Tags", tag: null },
    ...Array.from(allTags)
      .sort()
      .map((tag) => ({
        label:
          tag === filters.requirementTag
            ? `$(check) ${tag}`
            : tag,
        tag,
      })),
  ];

  const selected = await vscode.window.showQuickPick(options, {
    title: "SBAtlas — Filter by Requirement Tag",
  });

  if (!selected) {
    return;
  }

  sidebar.setFilters({
    ...filters,
    requirementTag: (selected as any).tag,
  });
}

async function filterBySearchText(
  sidebar: SidebarProvider,
  filters: SidebarFilters
): Promise<void> {
  const query = await vscode.window.showInputBox({
    title: "SBAtlas — Filter by Text",
    prompt: "Enter text to filter sidebar items",
    value: filters.searchQuery,
    placeHolder: "e.g. authentication",
    ignoreFocusOut: true,
  });

  if (query === undefined) {
    return;
  }

  sidebar.setFilters({
    ...filters,
    searchQuery: query,
  });
}