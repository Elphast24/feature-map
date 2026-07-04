import { Requirement, IRequirement } from "./requirement";
import { Metadata } from "./metaData";
import { ProjectSettings, IProjectSettings } from "./projectSettings";

export enum ProjectStatus {
  Active = "active",
  Paused = "paused",
  Completed = "completed",
  Archived = "archived",
}

export interface IProject {
  id: string;
  name: string;
  description: string;
  requirements: IRequirement[];
  metadata: Metadata;
  settings: ProjectSettings;
  status: ProjectStatus;
}

export class Project implements IProject {
  id: string;
  name: string;
  description: string;
  requirements: Requirement[];
  metadata: Metadata;
  settings: ProjectSettings;
  status: ProjectStatus;

  constructor(
    id: string,
    name: string,
    description: string = "",
    settings?: Partial<IProjectSettings>,
    author?: string
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.requirements = [];
    this.metadata = new Metadata(author);
    this.settings = new ProjectSettings(settings);
    this.status = ProjectStatus.Active;
  }
  addRequirement(requirement: Requirement): void {
    this.requirements.push(requirement);
    this.metadata.touch();
  }
  removeRequirement(requirementId: string): boolean {
    const before = this.requirements.length;
    this.requirements = this.requirements.filter((r) => r.id !== requirementId);
    const removed = this.requirements.length < before;

    if (removed) {
      this.metadata.touch();
    }

    return removed;
  }
  findRequirement(requirementId: string): Requirement | undefined {
    return this.requirements.find((r) => r.id === requirementId);
  }
  updateStatus(status: ProjectStatus): void {
    this.status = status;
    this.metadata.touch();
  }
  requirementCount(): number {
    return this.requirements.length;
  }
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      requirements: this.requirements.map((r) => r.toJSON()),
      metadata: this.metadata.toJSON(),
      settings: this.settings.toJSON(),
      status: this.status,
    };
  }

  static fromJSON(data: Record<string, unknown>): Project {
    const project = new Project(
      data.id as string,
      data.name as string,
      data.description as string
    );

    // Restore requirements
    const rawRequirements = data.requirements as Record<string, unknown>[];
    project.requirements = rawRequirements.map((r) => Requirement.fromJSON(r));

    // Restore metadata and settings
    project.metadata = Metadata.fromJSON(
      data.metadata as Record<string, unknown>
    );
    project.settings = ProjectSettings.fromJSON(
      data.settings as Record<string, unknown>
    );

    // Restore status
    project.status = data.status as ProjectStatus;

    return project;
  }
}