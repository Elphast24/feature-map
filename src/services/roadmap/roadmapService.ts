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