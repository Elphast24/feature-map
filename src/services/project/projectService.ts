// src/services/project/ProjectService.ts

import { Project, ProjectStatus } from "../../models/project";
import { Requirement, RequirementSource } from "../../models/requirement";
import { StorageService } from "../storage/storageService";
import { generateId } from "../../utils/generateId";

// Result type
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Convenience constructors so call sites are not verbose
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(error: string): ServiceResult<T> => ({ ok: false, error });

// ─────────────────────────────────────────────────────────────────
// Input types
// ─────────────────────────────────────────────────────────────────

/**
 * Data required to create a new project.
 * Kept as a plain object so commands can build it from UI input
 * without importing the Project class directly.
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  author?: string;
}

/**
 * Data required to add a new requirement.
 */
export interface AddRequirementInput {
  content: string;
  source?: RequirementSource;
}

export class ProjectService {
  private storage: StorageService;

  /**
   * The project currently loaded in memory.
   * null means no project has been created or loaded yet.
   */
  private currentProject: Project | null = null;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

// Creates a brand-new project, saves it to storage, and holds it
  async createProject(
    input: CreateProjectInput
  ): Promise<ServiceResult<Project>> {
    // Guard: name is required
    const nameValidation = this.validateName(input.name);
    if (!nameValidation.ok) {
      return fail(nameValidation.error);
    }

    // Guard: only one project per workspace in Phase 1
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

    return ok(project);
  }

//   Load he current project
  async loadProject(): Promise<ServiceResult<Project | null>> {
    const project = await this.storage.loadProject();
    this.currentProject = project;
    return ok(project);
  }

//   Delete the current project
  async deleteProject(): Promise<ServiceResult<void>> {
    if (!this.currentProject) {
      return fail("No project to delete.");
    }

    await this.storage.deleteProject();
    this.currentProject = null;

    return ok(undefined);
  }


  async saveProject(): Promise<ServiceResult<void>> {
    if (!this.currentProject) {
      return fail("No project to save.");
    }

    await this.storage.saveProject(this.currentProject);
    return ok(undefined);
  }

//   Returns the current in memmory without hitting the storage 
  getProject(): Project | null {
    return this.currentProject;
  }


// Renames the current project.

  async renameProject(newName: string): Promise<ServiceResult<Project>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const nameValidation = this.validateName(newName);
    if (!nameValidation.ok) {
      return fail(nameValidation.error);
    }

    const trimmed = newName.trim();

    if (trimmed === this.currentProject.name) {
      return fail("The new name is the same as the current name.");
    }

    this.currentProject.name = trimmed;
    this.currentProject.metadata.touch();

    await this.persistIfAutoSave();

    return ok(this.currentProject);
  }

//   Update the prohect descriptuon
  async updateDescription(
    description: string
  ): Promise<ServiceResult<Project>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    if (description.length > 500) {
      return fail("Description cannot exceed 500 characters.");
    }

    this.currentProject.description = description.trim();
    this.currentProject.metadata.touch();

    await this.persistIfAutoSave();

    return ok(this.currentProject);
  }

  /**
   * Updates the project's status.
   * Fails if no project is loaded.
   */
  async updateStatus(
    status: ProjectStatus
  ): Promise<ServiceResult<Project>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    this.currentProject.updateStatus(status);

    await this.persistIfAutoSave();

    return ok(this.currentProject);
  }

//   Add a new requirement to the current project
  async addRequirement(
    input: AddRequirementInput
  ): Promise<ServiceResult<Requirement>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const contentValidation = this.validateRequirementContent(input.content);
    if (!contentValidation.ok) {
      return fail(contentValidation.error);
    }

    const trimmed = input.content.trim();

    // Duplicate content guard
    const duplicate = this.currentProject.requirements.find(
      (r) => r.content.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      return fail(
        "A requirement with identical content already exists."
      );
    }

    const requirement = new Requirement(
      generateId(),
      trimmed,
      input.source ?? "manual"
    );

    this.currentProject.addRequirement(requirement);

    await this.persistIfAutoSave();

    return ok(requirement);
  }

//   Updates the content of an existing requirement in the current project.
  async editRequirement(
    requirementId: string,
    newContent: string
  ): Promise<ServiceResult<Requirement>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const requirement = this.currentProject.findRequirement(requirementId);
    if (!requirement) {
      return fail(`Requirement "${requirementId}" not found.`);
    }

    const contentValidation = this.validateRequirementContent(newContent);
    if (!contentValidation.ok) {
      return fail(contentValidation.error);
    }

    requirement.updateContent(newContent.trim());
    this.currentProject.metadata.touch();

    await this.persistIfAutoSave();

    return ok(requirement);
  }

   // Removes a requirement from the current project.

  async removeRequirement(
    requirementId: string
  ): Promise<ServiceResult<void>> {
    if (!this.currentProject) {
      return fail("No project is loaded.");
    }

    const removed = this.currentProject.removeRequirement(requirementId);
    if (!removed) {
      return fail(`Requirement "${requirementId}" not found.`);
    }

    await this.persistIfAutoSave();

    return ok(undefined);
  }

  // Private helpers

// This saves to storage only when the project's autoSave setting is on.
// this is also called after every mutation so the caller does not have to think about it.
  private async persistIfAutoSave(): Promise<void> {
    if (this.currentProject?.settings.autoSave) {
      await this.storage.saveProject(this.currentProject);
    }
  }

//  Validates a project name.
  private validateName(name: string): ServiceResult<true> {
    if (!name || name.trim().length === 0) {
      return fail("Project name is required.");
    }
    if (name.trim().length > 100) {
      return fail("Project name cannot exceed 100 characters.");
    }
    return ok(true);
  }

   // Validates requirement content.
  private validateRequirementContent(content: string): ServiceResult<true> {
    if (!content || content.trim().length === 0) {
      return fail("Requirement content cannot be empty.");
    }
    if (content.trim().length > 2000) {
      return fail("Requirement content cannot exceed 2000 characters.");
    }
    return ok(true);
  }
}