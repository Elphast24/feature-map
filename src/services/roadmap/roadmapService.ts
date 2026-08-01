import * as vscode from "vscode";
import { Roadmap } from "../../models/roadMap";
import { Phase } from "../../models/phase";
import { Module } from "../../models/module";
import { Task, TaskStatus } from "../../models/task";
import { StorageService } from "../storage/storageService";
import { AnalysisService, AnalysisResult } from "../analysis/analysisService";
import { ProjectService, ServiceResult } from "../project/projectService";
import { generateId } from "../../utils/generateId";

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(error: string): ServiceResult<T> => ({ ok: false, error });

export class RoadmapService {
  private readonly storage: StorageService;
  private readonly analysisService: AnalysisService;
  private readonly projectService: ProjectService;

  private currentRoadmap: Roadmap | null = null;

  // ── Event system ───────────────────────────────────────────────

  private readonly _onDidChangeRoadmap =
    new vscode.EventEmitter<Roadmap | null>();

  readonly onDidChangeRoadmap = this._onDidChangeRoadmap.event;

  constructor(
    storage: StorageService,
    analysisService: AnalysisService,
    projectService: ProjectService
  ) {
    this.storage = storage;
    this.analysisService = analysisService;
    this.projectService = projectService;
  }

  dispose(): void {
    this._onDidChangeRoadmap.dispose();
  }

  // Roadmap lifecycle

  async generateRoadmap(): Promise<ServiceResult<AnalysisResult>> {
    const project = this.projectService.getProject();

    if (!project) {
      return fail("No project is loaded. Create a project first.");
    }

    if (project.requirements.length === 0) {
      return fail(
        "This project has no requirements. " +
          "Add at least one requirement before generating a roadmap."
      );
    }

    // Call the AI
    const result = await this.analysisService.analyse(project);

    if (!result.ok) {
      return fail(result.error);
    }

    // Persist and cache
    const roadmap = result.data.roadmap;
    await this.storage.saveRoadmap(roadmap);
    this.currentRoadmap = roadmap;

    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(result.data);
  }

  async loadRoadmap(): Promise<ServiceResult<Roadmap | null>> {
    const roadmap = await this.storage.loadRoadmap();
    this.currentRoadmap = roadmap;

    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(roadmap);
  }


  async deleteRoadmap(): Promise<ServiceResult<void>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap to delete.");
    }

    await this.storage.deleteRoadmap();
    this.currentRoadmap = null;

    this._onDidChangeRoadmap.fire(null);

    return ok(undefined);
  }

  getRoadmap(): Roadmap | null {
    return this.currentRoadmap;
  }

  // Task status transitions

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus
  ): Promise<ServiceResult<Task>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    const found = this.currentRoadmap.findTask(taskId);

    if (!found) {
      return fail(`Task "${taskId}" not found.`);
    }

    const { task, module, phase } = found;

    task.updateStatus(status);
    module.recalculateStatus();
    phase.recalculateStatus();

    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(task);
  }


  async completeTask(taskId: string): Promise<ServiceResult<Task>> {
    return this.updateTaskStatus(taskId, TaskStatus.Done);
  }


  async startTask(taskId: string): Promise<ServiceResult<Task>> {
    return this.updateTaskStatus(taskId, TaskStatus.InProgress);
  }


  async skipTask(taskId: string): Promise<ServiceResult<Task>> {
    return this.updateTaskStatus(taskId, TaskStatus.Skipped);
  }

  async resetTask(taskId: string): Promise<ServiceResult<Task>> {
    return this.updateTaskStatus(taskId, TaskStatus.Pending);
  }

  // Task notes

  async addTaskNote(
    taskId: string,
    note: string
  ): Promise<ServiceResult<Task>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    if (!note || note.trim().length === 0) {
      return fail("Note cannot be empty.");
    }

    const found = this.currentRoadmap.findTask(taskId);

    if (!found) {
      return fail(`Task "${taskId}" not found.`);
    }

    found.task.addNote(note.trim());

    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(found.task);
  }

  // Manual task management

  async addTask(
    moduleId: string,
    title: string,
    description: string = "",
    requirementIds: string[] = []
  ): Promise<ServiceResult<Task>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    if (!title || title.trim().length === 0) {
      return fail("Task title is required.");
    }

    if (title.trim().length > 200) {
      return fail("Task title cannot exceed 200 characters.");
    }

    const found = this.currentRoadmap.findModule(moduleId);

    if (!found) {
      return fail(`Module "${moduleId}" not found.`);
    }

    const task = new Task(
      generateId(),
      title.trim(),
      description.trim(),
      "feature",
      requirementIds
    );

    found.module.addTask(task);
    found.phase.recalculateStatus();

    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(task);
  }


  async removeTask(taskId: string): Promise<ServiceResult<void>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    const found = this.currentRoadmap.findTask(taskId);

    if (!found) {
      return fail(`Task "${taskId}" not found.`);
    }

    const { module, phase } = found;

    const removed = module.removeTask(taskId);

    if (!removed) {
      return fail(`Failed to remove task "${taskId}".`);
    }

    phase.recalculateStatus();

    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(undefined);
  }

  async moveTaskUp(taskId: string): Promise<ServiceResult<void>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    const found = this.currentRoadmap.findTask(taskId);
    if (!found) {
      return fail(`Task "${taskId}" not found.`);
    }

    const moved = found.module.moveTaskUp(taskId);
    if (!moved) {
      return fail("Task is already at the top of this module.");
    }

    found.phase.updatedAt = new Date();
    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(undefined);
  }

  /**
   * Moves a task down one position within its module.
   */
  async moveTaskDown(
    taskId: string
  ): Promise<ServiceResult<void>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    const found = this.currentRoadmap.findTask(taskId);
    if (!found) {
      return fail(`Task "${taskId}" not found.`);
    }

    const moved = found.module.moveTaskDown(taskId);
    if (!moved) {
      return fail("Task is already at the bottom of this module.");
    }

    found.phase.updatedAt = new Date();
    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(undefined);
  }

  // ─────────────────────────────────────────
  // Move task between modules
  // ─────────────────────────────────────────

  /**
   * Moves a task from its current module to a different module.
   *
   * The task keeps its status, notes, and requirement links.
   * Its order is reset to the end of the target module.
   */
  async moveTaskToModule(
    taskId: string,
    targetModuleId: string
  ): Promise<ServiceResult<void>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    const sourceFound = this.currentRoadmap.findTask(taskId);
    if (!sourceFound) {
      return fail(`Task "${taskId}" not found.`);
    }

    const targetFound =
      this.currentRoadmap.findModule(targetModuleId);
    if (!targetFound) {
      return fail(`Module "${targetModuleId}" not found.`);
    }

    if (sourceFound.module.id === targetModuleId) {
      return fail("Task is already in that module.");
    }

    // Remove from source
    const task = sourceFound.task;
    sourceFound.module.removeTask(taskId);
    sourceFound.phase.recalculateStatus();

    // Reset order for the target module
    task.order = targetFound.module.taskCount();
    task.updatedAt = new Date();

    // Add to target
    targetFound.module.addTask(task);
    targetFound.phase.recalculateStatus();

    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(undefined);
  }

  // ─────────────────────────────────────────
  // Batch status update
  // ─────────────────────────────────────────

  /**
   * Updates the status of multiple tasks at once.
   *
   * Returns a summary of how many were updated and how many
   * failed. Partial success is possible.
   */
  async batchUpdateTaskStatus(
    taskIds: string[],
    status: TaskStatus
  ): Promise<ServiceResult<{
    updated: number;
    failed: number;
    errors: string[];
  }>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    if (taskIds.length === 0) {
      return fail("No tasks selected.");
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const taskId of taskIds) {
      const found = this.currentRoadmap.findTask(taskId);

      if (!found) {
        failed++;
        errors.push(`Task "${taskId}" not found.`);
        continue;
      }

      found.task.updateStatus(status);
      found.module.recalculateStatus();
      found.phase.recalculateStatus();
      updated++;
    }

    if (updated > 0) {
      await this.persistRoadmap();
      this._onDidChangeRoadmap.fire(this.currentRoadmap);
    }

    return ok({ updated, failed, errors });
  }

  // ─────────────────────────────────────────
  // Task dependencies
  // ─────────────────────────────────────────

  /**
   * Adds a dependency: taskId is blocked by blockingTaskId.
   *
   * Validates that:
   * - Both tasks exist
   * - Not adding a self-dependency
   * - Not creating a circular dependency
   */
  async addTaskDependency(
    taskId: string,
    blockingTaskId: string
  ): Promise<ServiceResult<void>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    if (taskId === blockingTaskId) {
      return fail("A task cannot block itself.");
    }

    const taskFound = this.currentRoadmap.findTask(taskId);
    if (!taskFound) {
      return fail(`Task "${taskId}" not found.`);
    }

    const blockerFound =
      this.currentRoadmap.findTask(blockingTaskId);
    if (!blockerFound) {
      return fail(`Blocking task "${blockingTaskId}" not found.`);
    }

    // Check for circular dependency
    const allTasks = this.buildTaskMap();
    if (
      this.wouldCreateCircle(
        taskId,
        blockingTaskId,
        allTasks
      )
    ) {
      return fail(
        "Adding this dependency would create a circular dependency."
      );
    }

    taskFound.task.addBlocker(blockingTaskId);

    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(undefined);
  }

  /**
   * Removes a dependency.
   */
  async removeTaskDependency(
    taskId: string,
    blockingTaskId: string
  ): Promise<ServiceResult<void>> {
    if (!this.currentRoadmap) {
      return fail("No roadmap is loaded.");
    }

    const taskFound = this.currentRoadmap.findTask(taskId);
    if (!taskFound) {
      return fail(`Task "${taskId}" not found.`);
    }

    taskFound.task.removeBlocker(blockingTaskId);

    await this.persistRoadmap();
    this._onDidChangeRoadmap.fire(this.currentRoadmap);

    return ok(undefined);
  }

  /**
   * Returns all tasks that are currently blocked
   * (have incomplete blockers).
   */
  getBlockedTasks(): Task[] {
    if (!this.currentRoadmap) {
      return [];
    }

    const allTasksMap = this.buildTaskMap();

    return this.currentRoadmap.phases.flatMap((p) =>
      p.modules.flatMap((m) =>
        m.tasks.filter(
          (t) =>
            t.blockedBy.length > 0 &&
            !t.isUnblocked(allTasksMap)
        )
      )
    );
  }

  // ─────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────

  private buildTaskMap(): Map<string, Task> {
    if (!this.currentRoadmap) {
      return new Map();
    }

    const map = new Map<string, Task>();

    this.currentRoadmap.phases.forEach((p) =>
      p.modules.forEach((m) =>
        m.tasks.forEach((t) => map.set(t.id, t))
      )
    );

    return map;
  }

  /**
   * Checks whether adding blockingTaskId as a blocker for taskId
   * would create a circular dependency using DFS.
   */
  private wouldCreateCircle(
    taskId: string,
    blockingTaskId: string,
    allTasks: Map<string, Task>
  ): boolean {
    // If the proposed blocker is already blocked by taskId
    // (directly or transitively), adding this dependency
    // would create a circle.
    const visited = new Set<string>();

    const dfs = (currentId: string): boolean => {
      if (currentId === taskId) {
        return true; // Found a cycle
      }

      if (visited.has(currentId)) {
        return false;
      }

      visited.add(currentId);

      const task = allTasks.get(currentId);
      if (!task) {
        return false;
      }

      return task.blockedBy.some((blockerId) =>
        dfs(blockerId)
      );
    };

    return dfs(blockingTaskId);
  }

  // Queries
  getNextPhase(): Phase | undefined {
    return this.currentRoadmap?.nextPhase();
  }

  getPendingTasks(): Task[] {
    return this.currentRoadmap?.pendingTasks() ?? [];
  }

  getTasksForRequirement(requirementId: string): Task[] {
    return this.currentRoadmap?.tasksForRequirement(requirementId) ?? [];
  }


  getCompletionPercentage(): number {
    return this.currentRoadmap?.completionPercentage() ?? 0;
  }

  // Private helpers
  private async persistRoadmap(): Promise<void> {
    if (this.currentRoadmap) {
      await this.storage.saveRoadmap(this.currentRoadmap);
    }
  }
}