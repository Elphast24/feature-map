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
    if (task.order === 0 && this.tasks.length > 0) {
      task.order = this.tasks.length;
    }
    this.tasks.push(task);
    this.tasks.sort((a, b) => a.order - b.order);
    this.recalculateStatus();
    this.updatedAt = new Date();
  }

  removeTask(taskId: string): boolean {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    const removed = this.tasks.length < before;

    if (removed) {
      this.reassignOrders();
      this.recalculateStatus();
      this.updatedAt = new Date();
    }

    return removed;
  }

  findTask(taskId: string): Task | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  /**
   * Moves a task up one position (lower order value).
   * Returns false if the task is already first.
   */
  moveTaskUp(taskId: string): boolean {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index <= 0) {
      return false;
    }

    // Swap with the task above
    const temp = this.tasks[index].order;
    this.tasks[index].order = this.tasks[index - 1].order;
    this.tasks[index - 1].order = temp;

    this.tasks.sort((a, b) => a.order - b.order);
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Moves a task down one position (higher order value).
   * Returns false if the task is already last.
   */
  moveTaskDown(taskId: string): boolean {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index === -1 || index >= this.tasks.length - 1) {
      return false;
    }

    const temp = this.tasks[index].order;
    this.tasks[index].order = this.tasks[index + 1].order;
    this.tasks[index + 1].order = temp;

    this.tasks.sort((a, b) => a.order - b.order);
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Reassigns order values to be contiguous (0, 1, 2...).
   * Called after task removal to avoid gaps.
   */
  private reassignOrders(): void {
    this.tasks.forEach((task, index) => {
      task.order = index;
    });
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