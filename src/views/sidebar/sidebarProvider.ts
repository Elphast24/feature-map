import * as vscode from "vscode";
import { ProjectService } from "../../services/project/projectService";
import { RoadmapService } from "../../services/roadmap/roadmapService";
import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { Module } from "../../models/module";
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

  constructor(
    projectService: ProjectService,
    roadmapService: RoadmapService
  ) {
    this.projectService = projectService;
    this.roadmapService = roadmapService;
  }

  getTreeItem(element: SBAtlasTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: SBAtlasTreeItem
  ): vscode.ProviderResult<SBAtlasTreeItem[]> {
    const project = this.projectService.getProject();
    const roadmap = this.roadmapService.getRoadmap();

    // Root level
    if (!element) {
      return this.getRootItems(project);
    }

    // Project root children
    if (element instanceof ProjectRootItem && project) {
      return this.getProjectChildren(project, roadmap);
    }

    // Requirements section children
    if (element instanceof RequirementsSectionItem && project) {
      return this.getRequirementItems(project);
    }

    // Roadmap section children 
    if (element instanceof RoadmapSectionItem) {
      return this.getRoadmapChildren(roadmap);
    }

    // Phase children
    if (element instanceof PhaseItem) {
      return this.getPhaseChildren(element.phase);
    }

    // Module children
    if (element instanceof ModuleItem) {
      return this.getModuleChildren(element.module);
    }

    // Metadata section children 
    if (element instanceof MetadataSectionItem && project) {
      return this.getMetadataItems(project);
    }

    // Leaf nodes have no children
    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  //────────────────────
  // Private tree builders
  //────────────────────

  private getRootItems(project: Project | null): SBAtlasTreeItem[] {
    if (!project) {
      return [new EmptyStateItem()];
    }
    return [new ProjectRootItem(project)];
  }

  private getProjectChildren(
    project: Project,
    roadmap: Roadmap | null
  ): SBAtlasTreeItem[] {
    return [
      new RequirementsSectionItem(project.requirementCount()),
      new RoadmapSectionItem(roadmap),
      new MetadataSectionItem(),
    ];
  }

  private getRequirementItems(project: Project): SBAtlasTreeItem[] {
    if (project.requirements.length === 0) {
      const placeholder = new MetadataItem(
        "No requirements yet",
        "Right-click to add"
      );
      placeholder.iconPath = new vscode.ThemeIcon("info");
      return [placeholder];
    }

    return project.requirements.map(
      (req, index) => new RequirementItem(req, index)
    );
  }

  private getRoadmapChildren(
    roadmap: Roadmap | null
  ): SBAtlasTreeItem[] {
    if (!roadmap || roadmap.phaseCount() === 0) {
      return [new RoadmapEmptyItem()];
    }

    return roadmap.phases.map((phase) => new PhaseItem(phase));
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

    return phase.modules.map((mod) => new ModuleItem(mod));
  }

 private getModuleChildren(
    module: Module
  ): SBAtlasTreeItem[] {
    if (module.tasks.length === 0) {
      const placeholder = new MetadataItem(
        "No tasks in this module",
        "Right-click to add"
      );
      placeholder.iconPath = new vscode.ThemeIcon("info");
      return [placeholder];
    }

    // Build a task map for dependency resolution
    const roadmap = this.roadmapService.getRoadmap();
    const taskMap = new Map<string, Task>();

    if (roadmap) {
      roadmap.phases.forEach((p) =>
        p.modules.forEach((m) =>
          m.tasks.forEach((t) => taskMap.set(t.id, t))
        )
      );
    }

    return module.tasks.map((task) => new TaskItem(task, taskMap));
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