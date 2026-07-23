import { Phase, PhaseStatus, IPhase } from "./phase";
import { Module } from "./module";
import { Task } from "./task";

export interface IRoadmap {
  id: string;

  /** The project this roadmap belongs to */
  projectId: string;

  phases: IPhase[];

  generatedAt: Date;

  updatedAt: Date;
}

/** FuLL LECTURE NOTE -hehehe-
 * Roadmap entity — the root aggregate of Phase 2.
 *
 * A roadmap is the structured execution plan derived from a project's
 * requirements. It owns all phases, which own all modules, which own
 * all tasks. Like Project in Phase 1, Roadmap is the root aggregate:
 * you never save a Phase in isolation — you always save the Roadmap.
 *
 * Design note (one roadmap per project):
 * Each project has exactly one active roadmap. Re-generating the
 * roadmap replaces the existing one. This keeps the model simple.
 * Version history of roadmaps is deferred to a later phase.
 *
 * Design note (projectId):
 * The roadmap stores its parent project ID so the storage layer
 * can associate them correctly without embedding the entire project
 * inside the roadmap.
 */
export class Roadmap implements IRoadmap {
  id: string;
  projectId: string;
  phases: Phase[];
  generatedAt: Date;
  updatedAt: Date;

  constructor(id: string, projectId: string) {
    this.id = id;
    this.projectId = projectId;
    this.phases = [];
    this.generatedAt = new Date();
    this.updatedAt = new Date();
  }

  // ─────────────────────────────────────────
  // Phase management
  // ─────────────────────────────────────────

  addPhase(phase: Phase): void {
    this.phases.push(phase);
    // Keep phases sorted by their explicit order field
    this.phases.sort((a, b) => a.order - b.order);
    this.updatedAt = new Date();
  }

  removePhase(phaseId: string): boolean {
    const before = this.phases.length;
    this.phases = this.phases.filter((p) => p.id !== phaseId);
    const removed = this.phases.length < before;

    if (removed) {
      this.updatedAt = new Date();
    }

    return removed;
  }

  findPhase(phaseId: string): Phase | undefined {
    return this.phases.find((p) => p.id === phaseId);
  }

  /**
   * Finds a module anywhere in the roadmap.
   */
  findModule(
    moduleId: string
  ): { module: Module; phase: Phase } | undefined {
    for (const phase of this.phases) {
      const module = phase.findModule(moduleId);
      if (module) {
        return { module, phase };
      }
    }
    return undefined;
  }

  /**
   * Finds a task anywhere in the roadmap.
   */
  findTask(
    taskId: string
  ): { task: Task; module: Module; phase: Phase } | undefined {
    for (const phase of this.phases) {
      const result = phase.findTask(taskId);
      if (result) {
        return { ...result, phase };
      }
    }
    return undefined;
  }

  // ─────────────────────────────────────────
  // Computed properties
  // ─────────────────────────────────────────

  phaseCount(): number {
    return this.phases.length;
  }

  totalTaskCount(): number {
    return this.phases.reduce((sum, p) => sum + p.taskCount(), 0);
  }

  completedTaskCount(): number {
    return this.phases.reduce(
      (sum, p) => sum + p.completedTaskCount(),
      0
    );
  }

  /**
   * Overall roadmap completion like say,  on a scale of 0–100 integer.
   */
  completionPercentage(): number {
    const total = this.totalTaskCount();
    if (total === 0) {
      return 0;
    }
    return Math.round((this.completedTaskCount() / total) * 100);
  }

  /**
   * Returns the next phase that has not been completed yet.
   * Useful for the "what should I work on next?" prompt.
   */
  nextPhase(): Phase | undefined {
    return this.phases.find(
      (p) => p.status !== PhaseStatus.Completed
    );
  }

  /**
   * Returns all tasks across the entire roadmap that are not complete.
   */
  pendingTasks(): Task[] {
    return this.phases.flatMap((p) =>
      p.modules.flatMap((m) =>
        m.tasks.filter((t) => !t.isComplete)
      )
    );
  }

  /**
   * Returns all tasks that address a specific requirement.
   * Used by the coverage tracker in Milestone 6.
   */
  tasksForRequirement(requirementId: string): Task[] {
    return this.phases.flatMap((p) =>
      p.modules.flatMap((m) =>
        m.tasks.filter((t) =>
          t.requirementIds.includes(requirementId)
        )
      )
    );
  }

  // ─────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      projectId: this.projectId,
      phases: this.phases.map((p) => p.toJSON()),
      generatedAt: this.generatedAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): Roadmap {
    const roadmap = new Roadmap(
      data.id as string,
      data.projectId as string
    );

    roadmap.phases = (data.phases as Record<string, unknown>[]).map(
      (p) => Phase.fromJSON(p)
    );
    roadmap.generatedAt = new Date(data.generatedAt as string);
    roadmap.updatedAt = new Date(data.updatedAt as string);

    return roadmap;
  }
}