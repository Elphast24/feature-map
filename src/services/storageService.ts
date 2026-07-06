import { Project } from "../models/project";


export interface StorageService {
//    Persists a project.
//    If a project already exists, it is overwritten.
  saveProject(project: Project): Promise<void>;

//    Retrieves the stored project.
//    Returns null if no project has been saved yet.
  loadProject(): Promise<Project | null>;

// Removes the stored project from storage entirely.
  deleteProject(): Promise<void>;

//    Checks whether a project exists in storage.
//    Avoids a full deserialization just to check existence.
  hasProject(): Promise<boolean>;
}