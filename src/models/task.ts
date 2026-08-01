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
  | "research"
  | "security";

export interface ITask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;
  requirementIds: string[];
  estimatedEffort?: number;
  notes: string;
  blockedBy: string[];
  order: number;
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
  blockedBy: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    title: string,
    description: string = "",
    type: TaskType = "feature",
    requirementIds: string[] = [],
    order: number = 0
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.status = TaskStatus.Pending;
    this.type = type;
    this.requirementIds = requirementIds;
    this.notes = "";
    this.blockedBy = [];
    this.order = order;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  updateStatus(status: TaskStatus): void {
    this.status = status;
    this.updatedAt = new Date();
  }

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

   // Adds a dependency — this task is blocked by blockingTaskId.
  addBlocker(blockingTaskId: string): void {
    if (!this.blockedBy.includes(blockingTaskId)) {
      this.blockedBy.push(blockingTaskId);
      this.updatedAt = new Date();
    }
  }

//   Removes a dependency.
  removeBlocker(blockingTaskId: string): void {
    const before = this.blockedBy.length;
    this.blockedBy = this.blockedBy.filter(
      (id) => id !== blockingTaskId
    );
    if (this.blockedBy.length < before) {
      this.updatedAt = new Date();
    }
  }

  isUnblocked(allTasks: Map<string, Task>): boolean {
    if (this.blockedBy.length === 0) {
      return true;
    }

    return this.blockedBy.every((blockerId) => {
      const blocker = allTasks.get(blockerId);
      return blocker ? blocker.isComplete : true;
    });
  }

  get isComplete(): boolean {
    return (
      this.status === TaskStatus.Done ||
      this.status === TaskStatus.Skipped
    );
  }

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
      blockedBy: this.blockedBy,
      order: this.order,
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
      data.requirementIds as string[],
      (data.order as number) ?? 0
    );

    task.status = data.status as TaskStatus;
    task.estimatedEffort = data.estimatedEffort as
      | number
      | undefined;
    task.notes = (data.notes as string) ?? "";
    task.blockedBy = (data.blockedBy as string[]) ?? [];
    task.createdAt = new Date(data.createdAt as string);
    task.updatedAt = new Date(data.updatedAt as string);

    return task;
  }
}