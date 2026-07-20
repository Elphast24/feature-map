import * as vscode from "vscode";
import { ProjectService } from "../../services/project/projectService";
import { Project } from "../../models/project";
import {
  SBAtlasTreeItem,
  EmptyStateItem,
  ProjectRootItem,
  RequirementsSectionItem,
  RequirementItem,
  MetadataSectionItem,
  MetadataItem,
} from "./treeItem";


export class SidebarProvider
  implements vscode.TreeDataProvider<SBAtlasTreeItem>
{
  // ── Event system ───────────────────────────────────────────────

  /**
   * Private emitter — only this class fires the event.
   * Underscore prefix signals "internal use only" by convention.
   */
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<SBAtlasTreeItem | undefined | void>();

  /**
   * Public event — VS Code subscribes to this to know when to refresh.
   * readonly so external code cannot accidentally replace the event.
   */
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // ── Dependencies ───────────────────────────────────────────────

  private readonly service: ProjectService;

  constructor(service: ProjectService) {
    this.service = service;
  }


  getTreeItem(element: SBAtlasTreeItem): vscode.TreeItem {
    return element;
  }

 
  getChildren(
    element?: SBAtlasTreeItem
  ): vscode.ProviderResult<SBAtlasTreeItem[]> {
    const project = this.service.getProject();

    // ── Root level ─────────────────────────────────────────────
    if (!element) {
      return this.getRootItems(project);
    }

    // ── Project root children ───────────────────────────────────
    if (element instanceof ProjectRootItem && project) {
      return this.getProjectChildren(project);
    }

    // ── Requirements section children ───────────────────────────
    if (element instanceof RequirementsSectionItem && project) {
      return this.getRequirementItems(project);
    }

    // ── Metadata section children ────────────────────────────────
    if (element instanceof MetadataSectionItem && project) {
      return this.getMetadataItems(project);
    }

    // Leaf nodes (RequirementItem, MetadataItem) have no children
    return [];
  }

  // ── Public refresh method ──────────────────────────────────────

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // Private tree builders

  /**
   * Root level: either the empty state or the project root.
   */
  private getRootItems(project: Project | null): SBAtlasTreeItem[] {
    if (!project) {
      return [new EmptyStateItem()];
    }

    return [new ProjectRootItem(project)];
  }

  /**
   * Children of the project root node.
   */
  private getProjectChildren(project: Project): SBAtlasTreeItem[] {
    return [
      new RequirementsSectionItem(project.requirementCount()),
      new MetadataSectionItem(),
    ];
  }

  /**
   * Children of the Requirements section.
   * Returns one RequirementItem per requirement.
   * Returns a placeholder if none exist.
   */
  private getRequirementItems(project: Project): SBAtlasTreeItem[] {
    if (project.requirements.length === 0) {
      // Show a helpful placeholder instead of an empty collapsed section
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

  /**
   * Children of the Details (metadata) section.
   * Surfaces the most useful project metadata as readable rows.
   */
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