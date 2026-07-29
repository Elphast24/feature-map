import * as vscode from "vscode";
import { FileStorage } from "./fileStorage";
import { WorkspaceStorage } from "./workspaceStorage";
import { ProjectIndex } from "../../models/projectIndex";

export interface MigrationResult {
  migrated: boolean;
  migratedItems: string[];
  warnings: string[];
}


export class StorageMigration {
  private readonly fileStorage: FileStorage;
  private readonly mementoStorage: WorkspaceStorage | null;
  private readonly workspaceRoot: vscode.Uri;

  constructor(
    fileStorage: FileStorage,
    mementoStorage: WorkspaceStorage | null,
    workspaceRoot: vscode.Uri
  ) {
    this.fileStorage = fileStorage;
    this.mementoStorage = mementoStorage;
    this.workspaceRoot = workspaceRoot;
  }

  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      migrated: false,
      migratedItems: [],
      warnings: [],
    };

    // Check if index already exists — if so, skip all migration
    const existingIndex = await this.fileStorage.loadIndex();
    if (existingIndex.projectCount() > 0) {
      return result;
    }

    // Try single-file layout migration first
    await this.migrateSingleFile(result);

    // Then try Memento migration
    if (this.mementoStorage) {
      await this.migrateMemento(result);
    }

    result.migrated = result.migratedItems.length > 0;
    return result;
  }

  /**
   * Migrates .vscode/sbatlas/project.json (root level)
   * to .vscode/sbatlas/projects/<id>/project.json
   */
  private async migrateSingleFile(
    result: MigrationResult
  ): Promise<void> {
    const oldProjectFile = vscode.Uri.joinPath(
      this.workspaceRoot,
      ".vscode",
      "sbatlas",
      "project.json"
    );

    const oldRoadmapFile = vscode.Uri.joinPath(
      this.workspaceRoot,
      ".vscode",
      "sbatlas",
      "roadmap.json"
    );

    try {
      const projectBytes = await vscode.workspace.fs.readFile(
        oldProjectFile
      );
      const projectText = Buffer.from(projectBytes).toString("utf8");
      const projectData = JSON.parse(projectText) as Record<
        string,
        unknown
      >;

      const { Project } = await import("../models/project");
      const project = Project.fromJSON(projectData);

      // Save in new multi-project layout
      this.fileStorage.setActiveProject(project.id);
      await this.fileStorage.saveProject(project);

      // Create index
      const index = new ProjectIndex();
      index.addProject(project.id, project.name);
      index.setActive(project.id);

      // Migrate roadmap if it exists
      try {
        const roadmapBytes = await vscode.workspace.fs.readFile(
          oldRoadmapFile
        );
        const roadmapText = Buffer.from(roadmapBytes).toString(
          "utf8"
        );
        const roadmapData = JSON.parse(roadmapText) as Record<
          string,
          unknown
        >;

        const { Roadmap } = await import("../../models/roadMap");
        const roadmap = Roadmap.fromJSON(roadmapData);
        await this.fileStorage.saveRoadmap(roadmap);

        result.migratedItems.push(
          `Roadmap (${roadmap.phaseCount()} phases)`
        );

        // Delete old roadmap file
        await vscode.workspace.fs.delete(oldRoadmapFile, {
          useTrash: false,
        });
      } catch {
        // No roadmap to migrate — that is fine
      }

      await this.fileStorage.saveIndex(index);

      result.migratedItems.push(`Project "${project.name}"`);

      // Delete old project file
      await vscode.workspace.fs.delete(oldProjectFile, {
        useTrash: false,
      });

      console.log(
        `[SBAtlas] Migrated single-file layout for "${project.name}"`
      );
    } catch {
      // No old single-file layout — that is fine
    }
  }

  /**
   * Migrates Memento data to multi-project file layout.
   */
  private async migrateMemento(
    result: MigrationResult
  ): Promise<void> {
    if (!this.mementoStorage) {
      return;
    }

    const mementoHasProject = await this.mementoStorage.hasProject();
    if (!mementoHasProject) {
      return;
    }

    try {
      const project = await this.mementoStorage.loadProject();
      if (!project) {
        return;
      }

      this.fileStorage.setActiveProject(project.id);
      await this.fileStorage.saveProject(project);

      const index = await this.fileStorage.loadIndex();
      index.addProject(project.id, project.name);
      index.setActive(project.id);

      // Migrate roadmap
      const mementoHasRoadmap =
        await this.mementoStorage.hasRoadmap();
      if (mementoHasRoadmap) {
        const roadmap = await this.mementoStorage.loadRoadmap();
        if (roadmap) {
          await this.fileStorage.saveRoadmap(roadmap);
          result.migratedItems.push(
            `Roadmap (${roadmap.phaseCount()} phases)`
          );
        }
      }

      await this.fileStorage.saveIndex(index);

      result.migratedItems.push(`Project "${project.name}"`);

      // Clear Memento
      await this.mementoStorage.deleteProjectAndRoadmap();

      console.log(
        `[SBAtlas] Migrated Memento data for "${project.name}"`
      );
    } catch (error) {
      result.warnings.push(
        `Failed to migrate Memento data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}