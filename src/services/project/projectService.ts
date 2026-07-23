import * as vscode from "vscode";
import { Project, ProjectStatus } from "../../models/project";
import { Requirement, RequirementSource } from "../../models/requirement";
import { StorageService } from "../storage/storageService";
import { ValidationService } from "../validation/validationService";
import { generateId } from "../../utils/generateId";

// ─────────────────────────────────────────────────────────────────
// Result type  (unchanged)
// ─────────────────────────────────────────────────────────────────

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(error: string): ServiceResult<T> => ({ ok: false, error });

// ─────────────────────────────────────────────────────────────────
// Input types  (unchanged)
// ─────────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  description?: string;
  author?: string;
}

export interface AddRequirementInput {
  content: string;
  source?: RequirementSource;
}

// ─────────────────────────────────────────────────────────────────
// ProjectService
// ─────────────────────────────────────────────────────────────────

/**
 * ProjectService — business logic layer.
 *
 * NEW IN THIS UPDATE:
 * ProjectService now owns an EventEmitter that fires whenever
 * project data changes. Any UI component (sidebar, status bar,
 * future webview) subscribes to onDidChangeProject once and
 * refreshes automatically.
 *
 * Commands never call sidebar.refresh() directly. They call
 * the service. The service fires the event. The sidebar hears it.
 * This is the Observer Pattern.
 */
export class ProjectService {
  private storage: StorageService;
  private validator: ValidationService;
  private currentProject: Project | null = null;

  // ── Event system ───────────────────────────────────────────────
  /**
   * Private emitter — only ProjectService fires this.
   *
   * Why vscode.EventEmitter?
   * VS Code provides a battle-tested EventEmitter that integrates
   * with the extension lifecycle (disposable). Using Node's built-in
   * EventEmitter would work but would not be automatically cleaned up
   * when the extension deactivates, risking memory leaks.
   */
  private readonly _onDidChangeProject =
    new vscode.EventEmitter<Project | null>();

  /**
   * Public event — subscribers listen here.
   *
   * Usage:
   *   projectService.onDidChangeProject(() => {
   *     sidebar.refresh();
   *   });
   *
   * The emitter sends the current project (or null if deleted)
   * so subscribers can react intelligently without calling
   * getProject() separately.
   */
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

    const alreadyExists = await this.storage.hasProject();
    if (alreadyExists) {
      return fail(
        "A project already exists in this workspace. " +
          "Delete it before creating a new one."
      );
    }

    const project = new Project(
      generateId(),
      input.name.trim(),
      input.description?.trim() ?? "",
      {},
      input.author?.trim()
    );

    await this.storage.saveProject(project);
    this.currentProject = project;

    // ← Fire the event so all subscribers know about the new project
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

    await this.storage.deleteProject();
    this.currentProject = null;

    // ← Fire with null so the sidebar shows the empty state
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

    await this.persistIfAutoSave();
    this._onDidChangeProject.fire(this.currentProject);

    return ok(this.currentProject);
  }

  async updateDescription(
    description: string
  ): Promise<ServiceResult<Project>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const validation =
      this.validator.validateProjectDescription(description);
    if (!validation.isValid) {
      return fail(validation.summary);
    }

    this.currentProject.description = description.trim();
    this.currentProject.metadata.touch();

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
}