export interface ProjectIndexEntry {
  id: string;
  name: string;
  createdAt: string;
}

export interface IProjectIndex {
  /** The ID of the currently active project, or null if none */
  activeProjectId: string | null;

  /** Lightweight entries for all projects */
  projects: ProjectIndexEntry[];

  /** Schema version for future migrations */
  version: string;
}


export class ProjectIndex implements IProjectIndex {
  activeProjectId: string | null;
  projects: ProjectIndexEntry[];
  version: string;

  static readonly CURRENT_VERSION = "1.0.0";

  constructor() {
    this.activeProjectId = null;
    this.projects = [];
    this.version = ProjectIndex.CURRENT_VERSION;
  }

  // ─────────────────────────────────────────
  // Project management
  // ─────────────────────────────────────────

  addProject(id: string, name: string): void {
    // Prevent duplicates
    if (this.projects.some((p) => p.id === id)) {
      return;
    }

    this.projects.push({
      id,
      name,
      createdAt: new Date().toISOString(),
    });
  }

  removeProject(id: string): boolean {
    const before = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== id);
    const removed = this.projects.length < before;

    // If the active project was removed, clear it
    if (removed && this.activeProjectId === id) {
      this.activeProjectId = null;
    }

    return removed;
  }

  setActive(id: string): boolean {
    const exists = this.projects.some((p) => p.id === id);
    if (!exists) {
      return false;
    }
    this.activeProjectId = id;
    return true;
  }

  getActiveEntry(): ProjectIndexEntry | undefined {
    if (!this.activeProjectId) {
      return undefined;
    }
    return this.projects.find(
      (p) => p.id === this.activeProjectId
    );
  }

  findEntry(id: string): ProjectIndexEntry | undefined {
    return this.projects.find((p) => p.id === id);
  }

  updateName(id: string, newName: string): boolean {
    const entry = this.findEntry(id);
    if (!entry) {
      return false;
    }
    entry.name = newName;
    return true;
  }

  projectCount(): number {
    return this.projects.length;
  }

  isEmpty(): boolean {
    return this.projects.length === 0;
  }

  // ─────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────

  toJSON(): Record<string, unknown> {
    return {
      activeProjectId: this.activeProjectId,
      projects: this.projects,
      version: this.version,
    };
  }

  static fromJSON(data: Record<string, unknown>): ProjectIndex {
    const index = new ProjectIndex();
    index.activeProjectId =
      (data.activeProjectId as string | null) ?? null;
    index.projects =
      (data.projects as ProjectIndexEntry[]) ?? [];
    index.version =
      (data.version as string) ?? ProjectIndex.CURRENT_VERSION;
    return index;
  }
}