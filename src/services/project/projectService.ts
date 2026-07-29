import * as vscode from "vscode";
import { Project, ProjectStatus } from "../../models/project";
import { Requirement, RequirementSource } from "../../models/requirement";
import { StorageService } from "../storage/storageService";
import { ValidationService } from "../validation/validationService";
import { generateId } from "../../utils/generateId";
import { FileStorage } from "../storage/fileStorage";
import { ProjectIndex } from "../../models/projectIndex";


export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(error: string): ServiceResult<T> => ({ ok: false, error });

export interface CreateProjectInput {
  name: string;
  description?: string;
  author?: string;
}

export interface AddRequirementInput {
  content: string;
  source?: RequirementSource;
}
export class ProjectService {
  private storage: StorageService;
  private validator: ValidationService;
  private currentProject: Project | null = null;


  private readonly _onDidChangeProject =
    new vscode.EventEmitter<Project | null>();

  readonly onDidChangeProject = this._onDidChangeProject.event;

  constructor(storage: StorageService, validator?: ValidationService) {
    this.storage = storage;
    this.validator = validator ?? new ValidationService();
  }

  /**
   * Disposes the event emitter.
   * Call this when the extension deactivates to prevent memory leaks.
   */
  dispose(): void {
    this._onDidChangeProject.dispose();
  }

  // ─────────────────────────────────────────
  // Project lifecycle
  // ─────────────────────────────────────────

  async createProject(
    input: CreateProjectInput
  ): Promise<ServiceResult<Project>> {
    const validation = this.validator.validateCreateProject(input);
    if (!validation.isValid) {
      return fail(validation.summary);
    }

    const project = new Project(
      generateId(),
      input.name.trim(),
      input.description?.trim() ?? "",
      {},
      input.author?.trim()
    );

    // Update file storage to point to the new project
    const fileStorage = this.getFileStorage();
    if (fileStorage) {
      fileStorage.setActiveProject(project.id);

      // Update the index
      const index = await fileStorage.loadIndex();
      index.addProject(project.id, project.name);
      index.setActive(project.id);
      await fileStorage.saveIndex(index);
    }

    await this.storage.saveProject(project);
    this.currentProject = project;

    this._onDidChangeProject.fire(this.currentProject);

    return ok(project);
  }

  async loadProject(): Promise<ServiceResult<Project | null>> {
    const project = await this.storage.loadProject();
    this.currentProject = project;

    // ← Fire so the sidebar renders whatever was loaded (or null)
    this._onDidChangeProject.fire(this.currentProject);

    return ok(project);
  }

   async deleteProject(): Promise<ServiceResult<void>> {
    if (!this.currentProject) {
      return fail("No project to delete.");
    }

    const projectId = this.currentProject.id;

    await this.storage.deleteProjectAndRoadmap();

    // Update the index
    const fileStorage = this.getFileStorage();
    if (fileStorage) {
      const index = await fileStorage.loadIndex();
      index.removeProject(projectId);

      // Activate the next available project or clear
      if (!index.isEmpty()) {
        const next = index.projects[0];
        index.setActive(next.id);
        fileStorage.setActiveProject(next.id);
      } else {
        fileStorage.setActiveProject(null);
      }

      await fileStorage.saveIndex(index);
    }

    this.currentProject = null;
    this._onDidChangeProject.fire(null);

    return ok(undefined);
  }

  async saveProject(): Promise<ServiceResult<void>> {
    if (!this.currentProject) {
      return fail("No project to save.");
    }

    await this.storage.saveProject(this.currentProject);

    // No event fire here — saveProject does not change data,
    // it persists existing data. The UI is already up to date.

    return ok(undefined);
  }

  getProject(): Project | null {
    return this.currentProject;
  }

  // ─────────────────────────────────────────
  // Project mutations
  // ─────────────────────────────────────────

  async renameProject(newName: string): Promise<ServiceResult<Project>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const validation = this.validator.validateRename(
      newName,
      this.currentProject.name
    );
    if (!validation.isValid) {
      return fail(validation.summary);
    }

    this.currentProject.name = newName.trim();
    this.currentProject.metadata.touch();

    // Update the index name
    const fileStorage = this.getFileStorage();
    if (fileStorage) {
      const index = await fileStorage.loadIndex();
      index.updateName(this.currentProject.id, newName.trim());
      await fileStorage.saveIndex(index);
    }

    await this.persistIfAutoSave();
    this._onDidChangeProject.fire(this.currentProject);

    return ok(this.currentProject);
  }

  async updateStatus(
    status: ProjectStatus
  ): Promise<ServiceResult<Project>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    this.currentProject.updateStatus(status);

    await this.persistIfAutoSave();
    this._onDidChangeProject.fire(this.currentProject);

    return ok(this.currentProject);
  }

  // ─────────────────────────────────────────
  // Requirement mutations
  // ─────────────────────────────────────────

  async addRequirement(
    input: AddRequirementInput
  ): Promise<ServiceResult<Requirement>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const existingContents = this.currentProject.requirements.map(
      (r) => r.content
    );

    const validation = this.validator.validateAddRequirement(
      input.content,
      existingContents
    );
    if (!validation.isValid) {
      return fail(validation.summary);
    }

    const requirement = new Requirement(
      generateId(),
      input.content.trim(),
      input.source ?? "manual"
    );

    this.currentProject.addRequirement(requirement);

    await this.persistIfAutoSave();
    this._onDidChangeProject.fire(this.currentProject);

    return ok(requirement);
  }

  async editRequirement(
    requirementId: string,
    newContent: string
  ): Promise<ServiceResult<Requirement>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const idValidation = this.validator.validateId(
      requirementId,
      "Requirement"
    );
    if (!idValidation.isValid) {
      return fail(idValidation.summary);
    }

    const requirement =
      this.currentProject.findRequirement(requirementId);
    if (!requirement) {
      return fail(`Requirement "${requirementId}" not found.`);
    }

    const validation = this.validator.validateEditRequirement(
      requirementId,
      newContent,
      this.currentProject.requirements
    );
    if (!validation.isValid) {
      return fail(validation.summary);
    }

    requirement.updateContent(newContent.trim());
    this.currentProject.metadata.touch();

    await this.persistIfAutoSave();
    this._onDidChangeProject.fire(this.currentProject);

    return ok(requirement);
  }

  async removeRequirement(
    requirementId: string
  ): Promise<ServiceResult<void>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const idValidation = this.validator.validateId(
      requirementId,
      "Requirement"
    );
    if (!idValidation.isValid) {
      return fail(idValidation.summary);
    }

    const removed =
      this.currentProject.removeRequirement(requirementId);
    if (!removed) {
      return fail(`Requirement "${requirementId}" not found.`);
    }

    await this.persistIfAutoSave();
    this._onDidChangeProject.fire(this.currentProject);

    return ok(undefined);
  }

  // ─────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────

  private async persistIfAutoSave(): Promise<void> {
    if (this.currentProject?.settings.autoSave) {
      await this.storage.saveProject(this.currentProject);
    }
  }

   private getFileStorage(): FileStorage | null {
    if (this.storage instanceof FileStorage) {
      return this.storage;
    }
    return null;
  }


  async switchProject(
    projectId: string
  ): Promise<ServiceResult<Project>> {
    const fileStorage = this.getFileStorage();
    if (!fileStorage) {
      return fail("Multi-project support requires file-based storage.");
    }

    const index = await fileStorage.loadIndex();
    const entry = index.findEntry(projectId);

    if (!entry) {
      return fail(`Project "${projectId}" not found.`);
    }

    // Activate the new project
    fileStorage.setActiveProject(projectId);
    index.setActive(projectId);
    await fileStorage.saveIndex(index);

    // Load the project
    const project = await fileStorage.loadProjectById(projectId);
    if (!project) {
      return fail(`Project "${entry.name}" data could not be loaded.`);
    }

    this.currentProject = project;
    this._onDidChangeProject.fire(this.currentProject);

    return ok(project);
  }

  async listProjects(): Promise<ServiceResult<ProjectIndex>> {
    const fileStorage = this.getFileStorage();
    if (!fileStorage) {
      return fail("Multi-project support requires file-based storage.");
    }

    const index = await fileStorage.loadIndex();
    return ok(index);
  }
}
