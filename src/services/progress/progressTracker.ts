import { Roadmap } from "../../models/roadMap";
import { Phase } from "../../models/phase";
import { Module } from "../../models/module";
import { Task, TaskStatus, TaskType } from "../../models/task";
import {
  ProgressSummary,
  PhaseProgress,
  ModuleProgress,
  TaskTypeBreakdown,
  VelocitySnapshot,
} from "./progressTypes";

export class ProgressTracker {

  getSummary(roadmap: Roadmap | null): ProgressSummary {
    if (!roadmap || roadmap.phaseCount() === 0) {
      return this.emptySummary();
    }

    const allTasks = this.getAllTasks(roadmap);

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.isComplete).length;
    const inProgressTasks = allTasks.filter(
      (t) => t.status === TaskStatus.InProgress
    ).length;
    const skippedTasks = allTasks.filter(
      (t) => t.status === TaskStatus.Skipped
    ).length;
    const pendingTasks = allTasks.filter(
      (t) => t.status === TaskStatus.Pending
    ).length;

    const completionPercentage =
      totalTasks === 0
        ? 0
        : Math.round((completedTasks / totalTasks) * 100);

    const phases = roadmap.phases.map((p) =>
      this.getPhaseProgress(p)
    );

    const tasksByType = this.getTasksByType(allTasks);
    const nextTask = this.getNextTask(roadmap);
    const recentlyCompleted = this.getRecentlyCompleted(allTasks, 24);
    const remainingEffort = this.getRemainingEffort(allTasks);

    const description = this.buildDescription(
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      completionPercentage,
      phases
    );

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      skippedTasks,
      completionPercentage,
      phases,
      tasksByType,
      nextTask,
      recentlyCompleted,
      remainingEffort,
      description,
    };
  }

  // ─────────────────────────────────────────
  // Phase-level progress
  // ─────────────────────────────────────────

  getPhaseProgress(phase: Phase): PhaseProgress {
    const allTasks = phase.modules.flatMap((m) => m.tasks);

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.isComplete).length;
    const inProgressTasks = allTasks.filter(
      (t) => t.status === TaskStatus.InProgress
    ).length;
    const pendingTasks = allTasks.filter(
      (t) => t.status === TaskStatus.Pending
    ).length;

    return {
      phaseId: phase.id,
      phaseTitle: phase.title,
      phaseOrder: phase.order,
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      completionPercentage:
        totalTasks === 0
          ? 0
          : Math.round((completedTasks / totalTasks) * 100),
      modules: phase.modules.map((m) => this.getModuleProgress(m)),
    };
  }

  // ─────────────────────────────────────────
  // Module-level progress
  // ─────────────────────────────────────────

  getModuleProgress(module: Module): ModuleProgress {
    const totalTasks = module.tasks.length;
    const completedTasks = module.tasks.filter(
      (t) => t.isComplete
    ).length;
    const inProgressTasks = module.tasks.filter(
      (t) => t.status === TaskStatus.InProgress
    ).length;
    const pendingTasks = module.tasks.filter(
      (t) => t.status === TaskStatus.Pending
    ).length;

    return {
      moduleId: module.id,
      moduleTitle: module.title,
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      completionPercentage:
        totalTasks === 0
          ? 0
          : Math.round((completedTasks / totalTasks) * 100),
    };
  }

  // ─────────────────────────────────────────
  // Task type breakdown
  // ─────────────────────────────────────────
  getTasksByType(tasks: Task[]): TaskTypeBreakdown[] {
    const typeMap = new Map<TaskType, { total: number; completed: number }>();

    for (const task of tasks) {
      const entry = typeMap.get(task.type) ?? {
        total: 0,
        completed: 0,
      };

      entry.total++;
      if (task.isComplete) {
        entry.completed++;
      }

      typeMap.set(task.type, entry);
    }

    return Array.from(typeMap.entries())
      .map(([type, counts]) => ({
        type,
        totalTasks: counts.total,
        completedTasks: counts.completed,
        completionPercentage:
          counts.total === 0
            ? 0
            : Math.round((counts.completed / counts.total) * 100),
      }))
      .sort((a, b) => b.totalTasks - a.totalTasks);
  }

  // ─────────────────────────────────────────
  // Next task recommendation
  // ─────────────────────────────────────────
  getNextTask(roadmap: Roadmap | null): Task | null {
    if (!roadmap) {
      return null;
    }

    // Priority 1: finish what you started
    for (const phase of roadmap.phases) {
      for (const module of phase.modules) {
        const inProgress = module.tasks.find(
          (t) => t.status === TaskStatus.InProgress
        );
        if (inProgress) {
          return inProgress;
        }
      }
    }

    // Priority 2: first pending task in first incomplete phase
    for (const phase of roadmap.phases) {
      for (const module of phase.modules) {
        const pending = module.tasks.find(
          (t) => t.status === TaskStatus.Pending
        );
        if (pending) {
          return pending;
        }
      }
    }

    return null;
  }

  // ─────────────────────────────────────────
  // Recently completed
  // ─────────────────────────────────────────
  getRecentlyCompleted(tasks: Task[], withinHours: number): Task[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - withinHours);

    return tasks
      .filter(
        (t) =>
          t.status === TaskStatus.Done && t.updatedAt >= cutoff
      )
      .sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
  }

  // ─────────────────────────────────────────
  // Velocity
  // ─────────────────────────────────────────
  getVelocity(
    tasks: Task[],
    hours: number,
    label: string
  ): VelocitySnapshot {
    const now = new Date();
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - hours);

    const completedInWindow = tasks.filter(
      (t) =>
        t.status === TaskStatus.Done &&
        t.updatedAt >= windowStart &&
        t.updatedAt <= now
    );

    const startedInWindow = tasks.filter(
      (t) =>
        t.status === TaskStatus.InProgress &&
        t.updatedAt >= windowStart &&
        t.updatedAt <= now
    );

    return {
      windowLabel: label,
      windowStart,
      windowEnd: now,
      tasksCompleted: completedInWindow.length,
      tasksStarted: startedInWindow.length,
      completedTasks: completedInWindow,
      startedTasks: startedInWindow,
    };
  }

  getVelocitySnapshots(tasks: Task[]): VelocitySnapshot[] {
    return [
      this.getVelocity(tasks, 24, "Last 24 hours"),
      this.getVelocity(tasks, 168, "Last 7 days"),
      this.getVelocity(tasks, 720, "Last 30 days"),
    ];
  }

  // ─────────────────────────────────────────
  // Effort
  // ─────────────────────────────────────────
  getRemainingEffort(tasks: Task[]): number {
    return tasks
      .filter((t) => !t.isComplete)
      .reduce(
        (sum, t) => sum + (t.estimatedEffort ?? 0),
        0
      );
  }
  getCompletedEffort(tasks: Task[]): number {
    return tasks
      .filter((t) => t.isComplete)
      .reduce(
        (sum, t) => sum + (t.estimatedEffort ?? 0),
        0
      );
  }

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────

  getAllTasks(roadmap: Roadmap): Task[] {
    return roadmap.phases.flatMap((p) =>
      p.modules.flatMap((m) => m.tasks)
    );
  }

  private emptySummary(): ProgressSummary {
    return {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      skippedTasks: 0,
      completionPercentage: 0,
      phases: [],
      tasksByType: [],
      nextTask: null,
      recentlyCompleted: [],
      remainingEffort: 0,
      description: "No roadmap generated yet.",
    };
  }

  private buildDescription(
    totalTasks: number,
    completedTasks: number,
    inProgressTasks: number,
    pendingTasks: number,
    completionPercentage: number,
    phases: PhaseProgress[]
  ): string {
    if (totalTasks === 0) {
      return "No tasks in the roadmap.";
    }

    const parts: string[] = [];

    parts.push(
      `${completionPercentage}% complete (${completedTasks}/${totalTasks} tasks)`
    );

    if (inProgressTasks > 0) {
      parts.push(
        `${inProgressTasks} task${inProgressTasks === 1 ? "" : "s"} in progress`
      );
    }

    if (pendingTasks > 0) {
      parts.push(
        `${pendingTasks} task${pendingTasks === 1 ? "" : "s"} remaining`
      );
    }

    // Add phase-level summary
    const activePhases = phases.filter(
      (p) => p.completionPercentage < 100
    );

    if (activePhases.length > 0) {
      const currentPhase = activePhases[0];
      parts.push(
        `Currently in Phase ${currentPhase.phaseOrder}: ${currentPhase.phaseTitle} ` +
          `(${currentPhase.completionPercentage}%)`
      );
    }

    return parts.join("  |  ");
  }
}