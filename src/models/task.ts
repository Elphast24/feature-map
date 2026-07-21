export enum TaskStatus {
  Pending = "pending",
  InProgress = "inProgress",
  Done = "done",
  Skipped = "skipped",
}


export type TaskType =
  | "feature"
  | "bugfix"
  | "refactor"
  | "test"
  | "docs"
  | "config"
  | "research";

export interface ITask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;

  /**
   * IDs of the requirements this task addresses.
   * One task can address multiple requirements.
   * One requirement can generate multiple tasks.
   */
  requirementIds: string[];

  /**
   * Estimated effort in abstract points.
   * Not hours — relative complexity (1 = trivial, 5 = large).
   * Optional: not every team uses estimates.
   */
  estimatedEffort?: number;

  /**
   * Notes added by the developer during execution.
   * Free-form text capturing decisions, blockers, or context.
   */
  notes: string;

  createdAt: Date;
  updatedAt: Date;
}

export class Task implements ITask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;
  requirementIds: string[];
  estimatedEffort?: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    title: string,
    description: string = "",
    type: TaskType = "feature",
    requirementIds: string[] = []
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.status = TaskStatus.Pending;
    this.type = type;
    this.requirementIds = requirementIds;
    this.notes = "";
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // ─────────────────────────────────────────
  // Status transitions
  // ─────────────────────────────────────────

  /**
   * Advances the task to a new status and records the timestamp.
   */
  updateStatus(status: TaskStatus): void {
    this.status = status;
    this.updatedAt = new Date();
  }

  /**
   * Appends a note to this task.
   * Prepends a timestamp so notes beomes readable.
   */
  addNote(note: string): void {
    const timestamp = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const entry = `[${timestamp}] ${note.trim()}`;

    this.notes = this.notes
      ? `${this.notes}\n${entry}`
      : entry;

    this.updatedAt = new Date();
  }

  // ─────────────────────────────────────────
  // Computed properties
  // ─────────────────────────────────────────

  get isComplete(): boolean {
    return (
      this.status === TaskStatus.Done ||
      this.status === TaskStatus.Skipped
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
      status: this.status,
      type: this.type,
      requirementIds: this.requirementIds,
      estimatedEffort: this.estimatedEffort,
      notes: this.notes,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): Task {
    const task = new Task(
      data.id as string,
      data.title as string,
      data.description as string,
      data.type as TaskType,
      data.requirementIds as string[]
    );

    task.status = data.status as TaskStatus;
    task.estimatedEffort = data.estimatedEffort as number | undefined;
    task.notes = data.notes as string;
    task.createdAt = new Date(data.createdAt as string);
    task.updatedAt = new Date(data.updatedAt as string);

    return task;
  }
}