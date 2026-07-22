import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";

export interface StorageService {
  saveProject(project: Project): Promise<void>;
  loadProject(): Promise<Project | null>;
  deleteProject(): Promise<void>;
  hasProject(): Promise<boolean>;

  // ─────────────────────────────────────────
  // Roadmap operations
  // ─────────────────────────────────────────

  saveRoadmap(roadmap: Roadmap): Promise<void>;

  loadRoadmap(): Promise<Roadmap | null>;

  deleteRoadmap(): Promise<void>;

  hasRoadmap(): Promise<boolean>;

  deleteProjectAndRoadmap(): Promise<void>;
}