import { Memento } from "vscode";
import { Project } from "../models/project";
import { StorageService } from "./storageService";
import { storageKeys } from "./storageKeys";


export class WorkspaceStorage implements StorageService {

  private readonly memento: Memento;

  constructor(memento: Memento) {
    this.memento = memento;
  }


  async saveProject(project: Project): Promise<void> {
    try {
      const serialized = project.toJSON();
      await this.memento.update(storageKeys.PROJECT, serialized);
    } catch (error) {
      throw new StorageError("Failed to save project", error);
    }
  }

 
  async loadProject(): Promise<Project | null> {
    try {
      const data = this.memento.get<Record<string, unknown>>(
        storageKeys.PROJECT
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
      await this.memento.update(storageKeys.PROJECT, undefined);
    } catch (error) {
      throw new StorageError("Failed to delete project", error);
    }
  }

  
  async hasProject(): Promise<boolean> {
    try {
      const data = this.memento.get<Record<string, unknown>>(
        storageKeys.PROJECT
      );
      return data !== undefined && data !== null;
    } catch (error) {
      throw new StorageError("Failed to check project existence", error);
    }
  }
}


export class StorageError extends Error {
  /** The original error that caused this failure, if available */
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.cause = cause;

    Object.setPrototypeOf(this, StorageError.prototype);
  }
}