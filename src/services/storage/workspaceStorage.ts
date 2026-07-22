import { Memento } from "vscode";
import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { StorageService } from "./storageService";
import { StorageKeys } from "./storageKeys";
export class WorkspaceStorage implements StorageService {
  private readonly memento: Memento;

  constructor(memento: Memento) {
    this.memento = memento;
  }

  // ─────────────────────────────────────────
  // Project operations
  // ─────────────────────────────────────────

  async saveProject(project: Project): Promise<void> {
    try {
      await this.memento.update(StorageKeys.PROJECT, project.toJSON());
    } catch (error) {
      throw new StorageError("Failed to save project", error);
    }
  }

  async loadProject(): Promise<Project | null> {
    try {
      const data = this.memento.get<Record<string, unknown>>(
        StorageKeys.PROJECT
      );
      if (!data) {
        return null;
      }
      return Project.fromJSON(data);
    } catch (error) {
      throw new StorageError("Failed to load project", error);
    }
  }

  async deleteProject(): Promise<void> {
    try {
      await this.memento.update(StorageKeys.PROJECT, undefined);
    } catch (error) {
      throw new StorageError("Failed to delete project", error);
    }
  }

  async hasProject(): Promise<boolean> {
    try {
      const data = this.memento.get<Record<string, unknown>>(
        StorageKeys.PROJECT
      );
      return data !== undefined && data !== null;
    } catch (error) {
      throw new StorageError("Failed to check project existence", error);
    }
  }

  async saveRoadmap(roadmap: Roadmap): Promise<void> {
    try {
      await this.memento.update(
        StorageKeys.ROADMAP,
        roadmap.toJSON()
      );
    } catch (error) {
      throw new StorageError("Failed to save roadmap", error);
    }
  }

  async loadRoadmap(): Promise<Roadmap | null> {
    try {
      const data = this.memento.get<Record<string, unknown>>(
        StorageKeys.ROADMAP
      );

      if (!data) {
        return null;
      }

      return Roadmap.fromJSON(data);
    } catch (error) {
      throw new StorageError("Failed to load roadmap", error);
    }
  }

  async deleteRoadmap(): Promise<void> {
    try {
      await this.memento.update(StorageKeys.ROADMAP, undefined);
    } catch (error) {
      throw new StorageError("Failed to delete roadmap", error);
    }
  }


  async hasRoadmap(): Promise<boolean> {
    try {
      const data = this.memento.get<Record<string, unknown>>(
        StorageKeys.ROADMAP
      );
      return data !== undefined && data !== null;
    } catch (error) {
      throw new StorageError(
        "Failed to check roadmap existence",
        error
      );
    }
  }

  async deleteProjectAndRoadmap(): Promise<void> {
    try {
      await this.memento.update(StorageKeys.PROJECT, undefined);
      await this.memento.update(StorageKeys.ROADMAP, undefined);
    } catch (error) {
      throw new StorageError(
        "Failed to delete project and roadmap",
        error
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// StorageError
// ─────────────────────────────────────────────────────────────────

export class StorageError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.cause = cause;
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}