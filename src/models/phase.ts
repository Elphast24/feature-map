// src/models/Phase.ts

import { Module, ModuleStatus, IModule } from "./module";
import { Task } from "./task";

/**
 * The completion status of a phase.
 * Mirrors the logic of ModuleStatus but at the phase level.
 */
export enum PhaseStatus {
  NotStarted = "notStarted",
  InProgress = "inProgress",
  Completed = "completed",
}

export interface IPhase {
  id: string;

  /**
   * Display order. Phase 1 comes before Phase 2, then it follows like that.
   * Explicit ordering survives any re-sorting of the array.
   */
  order: number;

  title: string;
  description: string;
  modules: IModule[];
  status: PhaseStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Phase implements IPhase {
  id: string;
  order: number;
  title: string;
  description: string;
  modules: Module[];
  status: PhaseStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    order: number,
    title: string,
    description: string = ""
  ) {
    this.id = id;
    this.order = order;
    this.title = title;
    this.description = description;
    this.modules = [];
    this.status = PhaseStatus.NotStarted;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // ─────────────────────────────────────────
  // Module management
  // ─────────────────────────────────────────

  addModule(module: Module): void {
    this.modules.push(module);
    this.recalculateStatus();
    this.updatedAt = new Date();
  }

  removeModule(moduleId: string): boolean {
    const before = this.modules.length;
    this.modules = this.modules.filter((m) => m.id !== moduleId);
    const removed = this.modules.length < before;

    if (removed) {
      this.recalculateStatus();
      this.updatedAt = new Date();
    }

    return removed;
  }

  findModule(moduleId: string): Module | undefined {
    return this.modules.find((m) => m.id === moduleId);
  }

  /**
   * Finds a task anywhere within this phase by searching all modules.
   * Returns both the task and the module it belongs to.
   */
  findTask(
    taskId: string
  ): { task: Task; module: Module } | undefined {
    for (const module of this.modules) {
      const task = module.findTask(taskId);
      if (task) {
        return { task, module };
      }
    }
    return undefined;
  }

  // ─────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────

  recalculateStatus(): void {
    if (this.modules.length === 0) {
      this.status = PhaseStatus.NotStarted;
      return;
    }

    const allComplete = this.modules.every(
      (m) => m.status === ModuleStatus.Completed
    );
    const anyStarted = this.modules.some(
      (m) => m.status !== ModuleStatus.NotStarted
    );

    if (allComplete) {
      this.status = PhaseStatus.Completed;
    } else if (anyStarted) {
      this.status = PhaseStatus.InProgress;
    } else {
      this.status = PhaseStatus.NotStarted;
    }
  }

  // ─────────────────────────────────────────
  // Computed properties
  // ─────────────────────────────────────────

  moduleCount(): number {
    return this.modules.length;
  }

  /**
   * Total tasks across all modules in this phase.
   */
  taskCount(): number {
    return this.modules.reduce((sum, m) => sum + m.taskCount(), 0);
  }

  completedTaskCount(): number {
    return this.modules.reduce(
      (sum, m) => sum + m.completedTaskCount(),
      0
    );
  }

  completionPercentage(): number {
    const total = this.taskCount();
    if (total === 0) {
      return 0;
    }
    return Math.round((this.completedTaskCount() / total) * 100);
  }

  // ─────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      order: this.order,
      title: this.title,
      description: this.description,
      modules: this.modules.map((m) => m.toJSON()),
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): Phase {
    const phase = new Phase(
      data.id as string,
      data.order as number,
      data.title as string,
      data.description as string
    );

    phase.modules = (data.modules as Record<string, unknown>[]).map(
      (m) => Module.fromJSON(m)
    );
    phase.status = data.status as PhaseStatus;
    phase.createdAt = new Date(data.createdAt as string);
    phase.updatedAt = new Date(data.updatedAt as string);

    return phase;
  }
}