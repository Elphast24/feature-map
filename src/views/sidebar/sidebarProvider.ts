import * as vscode from "vscode";
import { ProjectService } from "../../services/project/projectService";
import { RoadmapService } from "../../services/roadmap/roadmapService";
import { SearchService } from "../../services/search/searchService";
import { SidebarFilters, emptyFilters, isFiltersEmpty } from "../../services/search/searchTypes";
import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { Task } from "../../models/task";
import {
  SBAtlasTreeItem,
  EmptyStateItem,
  ProjectRootItem,
  RequirementsSectionItem,
  RequirementItem,
  MetadataSectionItem,
  MetadataItem,
  RoadmapSectionItem,
  RoadmapEmptyItem,
  PhaseItem,
  ModuleItem,
  TaskItem,
} from "./treeItem";

export class SidebarProvider
  implements vscode.TreeDataProvider<SBAtlasTreeItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<SBAtlasTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly projectService: ProjectService;
  private readonly roadmapService: RoadmapService;
  private readonly searchService: SearchService;

  private filters: SidebarFilters = emptyFilters();

  constructor(
    projectService: ProjectService,
    roadmapService: RoadmapService
  ) {
    this.projectService = projectService;
    this.roadmapService = roadmapService;
    this.searchService = new SearchService();
  }

  // Filter management

  setFilters(filters: SidebarFilters): void {
    this.filters = filters;
    this.refresh();
  }

  getFilters(): SidebarFilters {
    return { ...this.filters };
  }

  clearFilters(): void {
    this.filters = emptyFilters();
    this.refresh();
  }

  // TreeDataProvider implementation

  getTreeItem(element: SBAtlasTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: SBAtlasTreeItem
  ): vscode.ProviderResult<SBAtlasTreeItem[]> {
    const project = this.projectService.getProject();
    const roadmap = this.roadmapService.getRoadmap();
    const hasFilters = !isFiltersEmpty(this.filters);

    if (!element) {
      return this.getRootItems(project, hasFilters);
    }

    if (element instanceof ProjectRootItem && project) {
      return this.getProjectChildren(project, roadmap, hasFilters);
    }

    if (element instanceof RequirementsSectionItem && project) {
      return this.getRequirementItems(project);
    }

    if (element instanceof RoadmapSectionItem) {
      return this.getRoadmapChildren(roadmap);
    }

    if (element instanceof PhaseItem) {
      return this.getPhaseChildren(element.phase);
    }

    if (element instanceof ModuleItem) {
      return this.getModuleChildren(element.module);
    }

    if (element instanceof MetadataSectionItem && project) {
      return this.getMetadataItems(project);
    }

    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // Private tree builders
  private getRootItems(
    project: Project | null,
    hasFilters: boolean
  ): SBAtlasTreeItem[] {
    if (!project) {
      return [new EmptyStateItem()];
    }

    const items: SBAtlasTreeItem[] = [new ProjectRootItem(project)];

    // Show filter indicator at root level
    if (hasFilters) {
      const filterDesc = this.searchService.describeFilters(
        this.filters
      );
      const filterItem = new MetadataItem("🔍 " + filterDesc, "Clear: SBAtlas: Filter → Clear All");
      items.push(filterItem);
    }

    return items;
  }

  private getProjectChildren(
    project: Project,
    roadmap: Roadmap | null,
    hasFilters: boolean
  ): SBAtlasTreeItem[] {
    // Get filtered requirement count
    const filteredReqs = this.searchService.filterRequirements(
      project.requirements,
      this.filters
    );

    return [
      new RequirementsSectionItem(filteredReqs.length),
      new RoadmapSectionItem(roadmap),
      new MetadataSectionItem(),
    ];
  }

  private getRequirementItems(project: Project): SBAtlasTreeItem[] {
    const filtered = this.searchService.filterRequirements(
      project.requirements,
      this.filters
    );

    if (filtered.length === 0) {
      if (!isFiltersEmpty(this.filters)) {
        const placeholder = new MetadataItem(
          "No matching requirements",
          "Clear filters to show all"
        );
        placeholder.iconPath = new vscode.ThemeIcon("info");
        return [placeholder];
      }

      const placeholder = new MetadataItem(
        "No requirements yet",
        "Right-click to add"
      );
      placeholder.iconPath = new vscode.ThemeIcon("info");
      return [placeholder];
    }

    return filtered.map(
      (req, index) => new RequirementItem(req, index)
    );
  }

  private getRoadmapChildren(
    roadmap: Roadmap | null
  ): SBAtlasTreeItem[] {
    if (!roadmap || roadmap.phaseCount() === 0) {
      return [new RoadmapEmptyItem()];
    }

    // Filter phases
    const visiblePhases = roadmap.phases.filter((phase) => {
      const phaseTasks = phase.modules.flatMap((m) => m.tasks);
      return this.searchService.shouldShowPhase(
        phase.id,
        phaseTasks,
        this.filters
      );
    });

    if (visiblePhases.length === 0 && !isFiltersEmpty(this.filters)) {
      const placeholder = new MetadataItem(
        "No matching phases",
        "Clear filters to show all"
      );
      placeholder.iconPath = new vscode.ThemeIcon("info");
      return [placeholder];
    }

    return visiblePhases.map((phase) => new PhaseItem(phase));
  }

  private getPhaseChildren(
    phase: import("../../models/phase").Phase
  ): SBAtlasTreeItem[] {
    if (phase.modules.length === 0) {
      const placeholder = new MetadataItem(
        "No modules in this phase",
        ""
      );
      placeholder.iconPath = new vscode.ThemeIcon("info");
      return [placeholder];
    }

    // Filter modules — show only modules with matching tasks
    const visibleModules = phase.modules.filter((mod) => {
      if (isFiltersEmpty(this.filters)) {
        return true;
      }
      const filteredTasks = this.searchService.filterTasks(
        mod.tasks,
        this.filters
      );
      return filteredTasks.length > 0;
    });

    if (visibleModules.length === 0) {
      const placeholder = new MetadataItem(
        "No matching modules",
        "Clear filters to show all"
      );
      placeholder.iconPath = new vscode.ThemeIcon("info");
      return [placeholder];
    }

    return visibleModules.map((mod) => new ModuleItem(mod));
  }

  private getModuleChildren(
    module: import("../../models/module").Module
  ): SBAtlasTreeItem[] {
    // Build task map for dependency resolution
    const roadmap = this.roadmapService.getRoadmap();
    const taskMap = new Map<string, Task>();

    if (roadmap) {
      roadmap.phases.forEach((p) =>
        p.modules.forEach((m) =>
          m.tasks.forEach((t) => taskMap.set(t.id, t))
        )
      );
    }

    // Filter tasks
    const filteredTasks = this.searchService.filterTasks(
      module.tasks,
      this.filters
    );

    if (filteredTasks.length === 0) {
      if (!isFiltersEmpty(this.filters)) {
        const placeholder = new MetadataItem(
          "No matching tasks",
          "Clear filters to show all"
        );
        placeholder.iconPath = new vscode.ThemeIcon("info");
        return [placeholder];
      }

      const placeholder = new MetadataItem(
        "No tasks in this module",
        "Right-click to add"
      );
      placeholder.iconPath = new vscode.ThemeIcon("info");
      return [placeholder];
    }

    return filteredTasks.map((task) => new TaskItem(task, taskMap));
  }

  private getMetadataItems(project: Project): SBAtlasTreeItem[] {
    const { metadata, settings } = project;

    return [
      new MetadataItem("Author", metadata.author ?? "—"),
      new MetadataItem("Schema Version", metadata.version),
      new MetadataItem(
        "Created",
        metadata.createdAt.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      ),
      new MetadataItem(
        "Last Updated",
        metadata.updatedAt.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      ),
      new MetadataItem(
        "Auto Save",
        settings.autoSave ? "Enabled" : "Disabled"
      ),
      new MetadataItem(
        "Analysis",
        settings.analysisEnabled ? "Enabled" : "Disabled"
      ),
    ];
  }
}