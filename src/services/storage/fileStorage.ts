import * as vscode from "vscode";
import * as path from "path";
import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { ProjectIndex } from "../../models/projectIndex";
import { StorageService } from "./storageService";


export class FileStorage implements StorageService {
  private readonly storageDir: vscode.Uri;
  private readonly indexFile: vscode.Uri;
  private readonly projectsDir: vscode.Uri;

  /** The currently active project ID */
  private activeProjectId: string | null = null;

  constructor(workspaceRoot: vscode.Uri) {
    this.storageDir = vscode.Uri.joinPath(
      workspaceRoot,
      ".vscode",
      "sbatlas"
    );
    this.indexFile = vscode.Uri.joinPath(
      this.storageDir,
      "index.json"
    );
    this.projectsDir = vscode.Uri.joinPath(
      this.storageDir,
      "projects"
    );
  }

  // ─────────────────────────────────────────
  // Active project management
  // ─────────────────────────────────────────

  setActiveProject(projectId: string | null): void {
    this.activeProjectId = projectId;
  }

  getActiveProjectId(): string | null {
    return this.activeProjectId;
  }

  // ─────────────────────────────────────────
  // Index operations
  // ─────────────────────────────────────────

  async saveIndex(index: ProjectIndex): Promise<void> {
    await this.ensureDir(this.storageDir);
    await this.writeJSON(this.indexFile, index.toJSON());
  }

  async loadIndex(): Promise<ProjectIndex> {
    const data = await this.readJSON(this.indexFile);
    if (!data) {
      return new ProjectIndex();
    }
    return ProjectIndex.fromJSON(data);
  }

  // ─────────────────────────────────────────
  // Project operations (scoped to active project)
  // ─────────────────────────────────────────

  async saveProject(project: Project): Promise<void> {
    const dir = this.resolveProjectDir(project.id);
    await this.ensureDir(dir);
    const file = vscode.Uri.joinPath(dir, "project.json");
    await this.writeJSON(file, project.toJSON());
  }

  async loadProject(): Promise<Project | null> {
    if (!this.activeProjectId) {
      return null;
    }
    const file = this.resolveProjectFile(this.activeProjectId);
    const data = await this.readJSON(file);
    if (!data) {
      return null;
    }
    return Project.fromJSON(data);
  }

  async deleteProject(): Promise<void> {
    if (!this.activeProjectId) {
      return;
    }
    const dir = this.resolveProjectDir(this.activeProjectId);
    await this.deleteDir(dir);
  }

  async hasProject(): Promise<boolean> {
    if (!this.activeProjectId) {
      return false;
    }
    const file = this.resolveProjectFile(this.activeProjectId);
    return this.fileExists(file);
  }

  // ─────────────────────────────────────────
  // Roadmap operations (scoped to active project)
  // ─────────────────────────────────────────

  async saveRoadmap(roadmap: Roadmap): Promise<void> {
    const projectId = roadmap.projectId;
    const dir = this.resolveProjectDir(projectId);
    await this.ensureDir(dir);
    const file = vscode.Uri.joinPath(dir, "roadmap.json");
    await this.writeJSON(file, roadmap.toJSON());
  }

  async loadRoadmap(): Promise<Roadmap | null> {
    if (!this.activeProjectId) {
      return null;
    }
    const file = this.resolveRoadmapFile(this.activeProjectId);
    const data = await this.readJSON(file);
    if (!data) {
      return null;
    }
    return Roadmap.fromJSON(data);
  }

  async deleteRoadmap(): Promise<void> {
    if (!this.activeProjectId) {
      return;
    }
    const file = this.resolveRoadmapFile(this.activeProjectId);
    await this.deleteFile(file);
  }

  async hasRoadmap(): Promise<boolean> {
    if (!this.activeProjectId) {
      return false;
    }
    const file = this.resolveRoadmapFile(this.activeProjectId);
    return this.fileExists(file);
  }

  async deleteProjectAndRoadmap(): Promise<void> {
    if (!this.activeProjectId) {
      return;
    }
    const dir = this.resolveProjectDir(this.activeProjectId);
    await this.deleteDir(dir);
  }

  // ─────────────────────────────────────────
  // Load a specific project by ID (not the active one)
  // ─────────────────────────────────────────

  async loadProjectById(projectId: string): Promise<Project | null> {
    const file = this.resolveProjectFile(projectId);
    const data = await this.readJSON(file);
    if (!data) {
      return null;
    }
    return Project.fromJSON(data);
  }

  async loadRoadmapByProjectId(
    projectId: string
  ): Promise<Roadmap | null> {
    const file = this.resolveRoadmapFile(projectId);
    const data = await this.readJSON(file);
    if (!data) {
      return null;
    }
    return Roadmap.fromJSON(data);
  }

  async deleteProjectById(projectId: string): Promise<void> {
    const dir = this.resolveProjectDir(projectId);
    await this.deleteDir(dir);
  }

  // ─────────────────────────────────────────
  // Path accessors
  // ─────────────────────────────────────────

  getStorageDir(): vscode.Uri {
    return this.storageDir;
  }

  // ─────────────────────────────────────────
  // Private file operations
  // ─────────────────────────────────────────

  private resolveProjectDir(projectId: string): vscode.Uri {
    return vscode.Uri.joinPath(this.projectsDir, projectId);
  }

  private resolveProjectFile(projectId: string): vscode.Uri {
    return vscode.Uri.joinPath(
      this.projectsDir,
      projectId,
      "project.json"
    );
  }

  private resolveRoadmapFile(projectId: string): vscode.Uri {
    return vscode.Uri.joinPath(
      this.projectsDir,
      projectId,
      "roadmap.json"
    );
  }

  private async ensureDir(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(uri);
    } catch {
      // Already exists
    }
  }

  private async readJSON(
    uri: vscode.Uri
  ): Promise<Record<string, unknown> | null> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString("utf8");
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async writeJSON(
    uri: vscode.Uri,
    data: Record<string, unknown>
  ): Promise<void> {
    const text = JSON.stringify(data, null, 2);
    const bytes = Buffer.from(text, "utf8");
    await vscode.workspace.fs.writeFile(uri, bytes);
  }

  private async deleteFile(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri, { useTrash: false });
    } catch {
      // File did not exist
    }
  }

  private async deleteDir(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri, {
        recursive: true,
        useTrash: false,
      });
    } catch {
      // Directory did not exist
    }
  }

  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }
}

export class FileStorageError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "FileStorageError";
    this.cause = cause;
    Object.setPrototypeOf(this, FileStorageError.prototype);
  }
}