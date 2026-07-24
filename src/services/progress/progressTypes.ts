import { Task, TaskStatus, TaskType } from "../../models/task";

export interface ProgressSummary {
  /** Total tasks in the roadmap */
  totalTasks: number;

  /** Tasks marked as done or skipped */
  completedTasks: number;

  /** Tasks currently being worked on */
  inProgressTasks: number;

  /** Tasks not yet started */
  pendingTasks: number;

  /** Tasks deliberately skipped */
  skippedTasks: number;

  /** Overall completion as 0–100 integer */
  completionPercentage: number;

  /** Per-phase breakdown */
  phases: PhaseProgress[];

  /** Tasks grouped by type (feature, test, docs, etc.) */
  tasksByType: TaskTypeBreakdown[];

  /** The next task the developer should work on */
  nextTask: Task | null;

  /** Tasks completed in the last 24 hours */
  recentlyCompleted: Task[];

  /** Estimated remaining effort (sum of estimatedEffort on pending tasks) */
  remainingEffort: number;

  /** Human-readable text summary */
  description: string;
}

export interface PhaseProgress {
  phaseId: string;
  phaseTitle: string;
  phaseOrder: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  completionPercentage: number;
  modules: ModuleProgress[];
}

export interface ModuleProgress {
  moduleId: string;
  moduleTitle: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  completionPercentage: number;
}

export interface TaskTypeBreakdown {
  type: TaskType;
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
}

/**
 * Progress over a specific time window.
 * Used for velocity tracking and "what did I do today" queries.
 */
export interface VelocitySnapshot {
  windowLabel: string;

  windowStart: Date;

  windowEnd: Date;

  tasksCompleted: number;

  tasksStarted: number;

  completedTasks: Task[];

  startedTasks: Task[];
}