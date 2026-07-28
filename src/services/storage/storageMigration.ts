import * as vscode from "vscode";
import { FileStorage } from "./fileStorage";
import { WorkspaceStorage } from "./workspaceStorage";
import { StorageKeys } from "./storageKeys";

// Info on migration status
export interface MigrationResult {
  migrated: boolean;
  migratedItems: string[];
  warnings: string[];
}

export class StorageMigration {
  private readonly fileStorage: FileStorage;
  private readonly mementoStorage: WorkspaceStorage;

  constructor(
    fileStorage: FileStorage,
    mementoStorage: WorkspaceStorage
  ) {
    this.fileStorage = fileStorage;
    this.mementoStorage = mementoStorage;
  }


  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      migrated: false,
      migratedItems: [],
      warnings: [],
    };

    // Rule 1: Skip if file storage already has data
    const fileHasProject = await this.fileStorage.hasProject();
    if (fileHasProject) {
      return result;
    }

    // Check if Memento has anything to migrate
    const mementoHasProject = await this.mementoStorage.hasProject();
    const mementoHasRoadmap = await this.mementoStorage.hasRoadmap();

    if (!mementoHasProject && !mementoHasRoadmap) {
      // Nothing to migrate — fresh workspace
      return result;
    }

    console.log(
      "[SBAtlas] Migrating data from Memento to file storage..."
    );

    // Rule 2: Migrate project
    if (mementoHasProject) {
      try {
        const project = await this.mementoStorage.loadProject();
        if (project) {
          await this.fileStorage.saveProject(project);
          result.migratedItems.push(
            `Project "${project.name}"`
          );
          console.log(
            `[SBAtlas] Migrated project: "${project.name}"`
          );
        }
      } catch (error) {
        result.warnings.push(
          `Failed to migrate project: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // Rule 3: Migrate roadmap
    if (mementoHasRoadmap) {
      try {
        const roadmap = await this.mementoStorage.loadRoadmap();
        if (roadmap) {
          await this.fileStorage.saveRoadmap(roadmap);
          result.migratedItems.push(
            `Roadmap (${roadmap.phaseCount()} phases, ` +
              `${roadmap.totalTaskCount()} tasks)`
          );
          console.log(
            `[SBAtlas] Migrated roadmap: ` +
              `${roadmap.phaseCount()} phases`
          );
        }
      } catch (error) {
        result.warnings.push(
          `Failed to migrate roadmap: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // Rule 4: Clear Memento if migration succeeded with no warnings
    if (result.warnings.length === 0) {
      try {
        await this.mementoStorage.deleteProjectAndRoadmap();
        console.log("[SBAtlas] Cleared Memento after migration.");
      } catch (error) {
        // Non-fatal — old data stays in Memento but is ignored
        result.warnings.push(
          `Could not clear old Memento data: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    result.migrated = result.migratedItems.length > 0;

    if (result.migrated) {
      console.log(
        `[SBAtlas] Migration complete. Migrated: ${result.migratedItems.join(", ")}`
      );
    }

    return result;
  }
}