// src/services/storage/FileStorage.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { StorageService } from "./storageService";

export class FileStorage implements StorageService {
  private readonly storageDir: vscode.Uri;
  private readonly projectFile: vscode.Uri;
  private readonly roadmapFile: vscode.Uri;

  constructor(workspaceRoot: vscode.Uri) {
    this.storageDir = vscode.Uri.joinPath(
      workspaceRoot,
      ".vscode",
      "sbatlas"
    );
    this.projectFile = vscode.Uri.joinPath(
      this.storageDir,
      "project.json"
    );
    this.roadmapFile = vscode.Uri.joinPath(
      this.storageDir,
      "roadmap.json"
    );
  }


  // Project operations
  async saveProject(project: Project): Promise<void> {
    await this.ensureStorageDir();
    await this.writeJSON(this.projectFile, project.toJSON());
  }

  async loadProject(): Promise<Project | null> {
    const data = await this.readJSON(this.projectFile);
    if (!data) {
      return null;
    }
    return Project.fromJSON(data);
  }

  async deleteProject(): Promise<void> {
    await this.deleteFile(this.projectFile);
  }

  async hasProject(): Promise<boolean> {
    return this.fileExists(this.projectFile);
  }


  // Roadmap operations
  async saveRoadmap(roadmap: Roadmap): Promise<void> {
    await this.ensureStorageDir();
    await this.writeJSON(this.roadmapFile, roadmap.toJSON());
  }

  async loadRoadmap(): Promise<Roadmap | null> {
    const data = await this.readJSON(this.roadmapFile);
    if (!data) {
      return null;
    }
    return Roadmap.fromJSON(data);
  }

  async deleteRoadmap(): Promise<void> {
    await this.deleteFile(this.roadmapFile);
  }

  async hasRoadmap(): Promise<boolean> {
    return this.fileExists(this.roadmapFile);
  }

  async deleteProjectAndRoadmap(): Promise<void> {
    await this.deleteFile(this.projectFile);
    await this.deleteFile(this.roadmapFile);
  }


  // File path accessors
  // Used by StorageMigration to confirm file locations
  getStorageDir(): vscode.Uri {
    return this.storageDir;
  }

  getProjectFile(): vscode.Uri {
    return this.projectFile;
  }

  getRoadmapFile(): vscode.Uri {
    return this.roadmapFile;
  }


  // Private file operations
  /**
   * Creates the .vscode/sbatlas/ directory if it does not exist.
   * Also creates a .gitkeep so the directory is tracked by git
   * even when no project exists.
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(this.storageDir);
    } catch {
      // Directory already exists — not an error
    }
  }

  /**
   * Reads a JSON file and returns its parsed content.
   * Returns null if the file does not exist.
   * Throws FileStorageError if the file exists but cannot be parsed.
   */
  private async readJSON(
    uri: vscode.Uri
  ): Promise<Record<string, unknown> | null> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString("utf8");
      return JSON.parse(text) as Record<string, unknown>;
    } catch (error) {
      // File does not exist
      if (
        error instanceof Error &&
        error.message.includes("ENOENT")
      ) {
        return null;
      }
      // File exists but content is invalid JSON
      throw new FileStorageError(
        `Failed to read or parse ${path.basename(uri.fsPath)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error
      );
    }
  }

  private async writeJSON(
    uri: vscode.Uri,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const text = JSON.stringify(data, null, 2);
      const bytes = Buffer.from(text, "utf8");
      await vscode.workspace.fs.writeFile(uri, bytes);
    } catch (error) {
      throw new FileStorageError(
        `Failed to write ${path.basename(uri.fsPath)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error
      );
    }
  }

// Deletes a file. Safe to call when the file does not exist.
  private async deleteFile(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri, { useTrash: false });
    } catch {
      // File did not exist — not an error
    }
  }

//  Returns true if a file exists at the given URI.
  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }
}

// Error type
export class FileStorageError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "FileStorageError";
    this.cause = cause;
    Object.setPrototypeOf(this, FileStorageError.prototype);
  }
}