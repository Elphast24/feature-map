import { Task, TaskStatus, ITask } from "./task";

/**
 * The completion status of a module.
 * Derived from a task thst belongs to it
 */
export enum ModuleStatus {
  NotStarted = "notStarted",
  InProgress = "inProgress",
  Completed = "completed",
}

export interface IModule {
  id: string;
  title: string;
  description: string;
  tasks: ITask[];
  status: ModuleStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Module implements IModule {
  id: string;
  title: string;
  description: string;
  tasks: Task[];
  status: ModuleStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    title: string,
    description: string = ""
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.tasks = [];
    this.status = ModuleStatus.NotStarted;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // ─────────────────────────────────────────
  // Task management
  // ─────────────────────────────────────────

  addTask(task: Task): void {
    this.tasks.push(task);
    this.recalculateStatus();
    this.updatedAt = new Date();
  }

  removeTask(taskId: string): boolean {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    const removed = this.tasks.length < before;

    if (removed) {
      this.recalculateStatus();
      this.updatedAt = new Date();
    }

    return removed;
  }

  findTask(taskId: string): Task | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  // ─────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────

  /**
   * Recomputes module status from current task statuses.
   *
   * Here is how we'll be doing it:
   *   - No tasks, or all pending  → NotStarted
   *   - All tasks complete        → Completed
   *   - Anything in between       → InProgress
   */
  recalculateStatus(): void {
    if (this.tasks.length === 0) {
      this.status = ModuleStatus.NotStarted;
      return;
    }

    const allComplete = this.tasks.every((t) => t.isComplete);
    const anyStarted = this.tasks.some(
      (t) =>
        t.status === TaskStatus.InProgress ||
        t.status === TaskStatus.Done ||
        t.status === TaskStatus.Skipped
    );

    if (allComplete) {
      this.status = ModuleStatus.Completed;
    } else if (anyStarted) {
      this.status = ModuleStatus.InProgress;
    } else {
      this.status = ModuleStatus.NotStarted;
    }
  }

  // ─────────────────────────────────────────
  // Computed properties
  // ─────────────────────────────────────────

  taskCount(): number {
    return this.tasks.length;
  }

  completedTaskCount(): number {
    return this.tasks.filter((t) => t.isComplete).length;
  }

  /**
   * Completion percentage as a 0–100 integer.
   * Returns 0 when there are no tasks.
   */
  completionPercentage(): number {
    if (this.tasks.length === 0) {
      return 0;
    }
    return Math.round(
      (this.completedTaskCount() / this.tasks.length) * 100
    );
  }

  // ─────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      tasks: this.tasks.map((t) => t.toJSON()),
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): Module {
    const mod = new Module(
      data.id as string,
      data.title as string,
      data.description as string
    );

    mod.tasks = (data.tasks as Record<string, unknown>[]).map(
      (t) => Task.fromJSON(t)
    );
    mod.status = data.status as ModuleStatus;
    mod.createdAt = new Date(data.createdAt as string);
    mod.updatedAt = new Date(data.updatedAt as string);

    return mod;
  }
}