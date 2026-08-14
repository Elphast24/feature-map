// src/services/search/SearchService.ts

import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { Requirement } from "../../models/requirement";
import { Task, TaskStatus, TaskType } from "../../models/task";
import { RequirementPriority } from "../../models/requirement";
import { SearchResult, SidebarFilters } from "./searchTypes";

export class SearchService {
  // Full-text search
  search(
    query: string,
    project: Project | null,
    roadmap: Roadmap | null
  ): SearchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const q = query.trim().toLowerCase();
    const results: SearchResult[] = [];

    // Search requirements
    if (project) {
      for (const req of project.requirements) {
        const matches = this.matchRequirement(req, q);
        results.push(...matches);
      }
    }

    // Search tasks
    if (roadmap) {
      for (const phase of roadmap.phases) {
        for (const module of phase.modules) {
          for (const task of module.tasks) {
            const location = `${phase.title} → ${module.title}`;
            const matches = this.matchTask(task, q, location);
            results.push(...matches);
          }
        }
      }
    }

    // Sort by relevance: title > content > description > notes > tags
    const fieldOrder: Record<string, number> = {
      title: 0,
      content: 1,
      description: 2,
      notes: 3,
      tag: 4,
    };

    results.sort(
      (a, b) =>
        (fieldOrder[a.matchedField] ?? 5) -
        (fieldOrder[b.matchedField] ?? 5)
    );

    return results;
  }

  // Task filtering

  /**
   * Filters tasks based on the active sidebar filters.
   * Returns only tasks that match ALL active filters.
   */
  filterTasks(
    tasks: Task[],
    filters: SidebarFilters
  ): Task[] {
    return tasks.filter((task) => {
      // Status filter
      if (
        filters.taskStatus !== null &&
        task.status !== filters.taskStatus
      ) {
        return false;
      }

      // Type filter
      if (
        filters.taskType !== null &&
        task.type !== filters.taskType
      ) {
        return false;
      }

      // Text search
      if (filters.searchQuery.trim().length > 0) {
        const q = filters.searchQuery.trim().toLowerCase();
        const searchable = [
          task.title,
          task.description,
          task.notes,
          task.type,
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Filters requirements based on the active sidebar filters.
   */
  filterRequirements(
    requirements: Requirement[],
    filters: SidebarFilters
  ): Requirement[] {
    return requirements.filter((req) => {
      // Priority filter
      if (
        filters.requirementPriority !== null &&
        req.priority !== filters.requirementPriority
      ) {
        return false;
      }

      // Tag filter
      if (
        filters.requirementTag !== null &&
        !req.tags.includes(filters.requirementTag)
      ) {
        return false;
      }

      // Text search
      if (filters.searchQuery.trim().length > 0) {
        const q = filters.searchQuery.trim().toLowerCase();
        const searchable = [
          req.content,
          ...req.tags,
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Checks whether a phase should be shown based on filters.
   * A phase is shown if it matches the phaseId filter (or no filter)
   * AND at least one of its tasks passes the task filters.
   */
  shouldShowPhase(
    phaseId: string,
    phaseTasks: Task[],
    filters: SidebarFilters
  ): boolean {
    // Phase filter
    if (
      filters.phaseId !== null &&
      phaseId !== filters.phaseId
    ) {
      return false;
    }

    // If no task-level filters, show the phase
    if (
      filters.taskStatus === null &&
      filters.taskType === null &&
      filters.searchQuery.trim().length === 0
    ) {
      return true;
    }

    // Show the phase only if it has matching tasks
    return this.filterTasks(phaseTasks, filters).length > 0;
  }

  // Filter summary

  /**
   * Returns a human-readable description of active filters.
   * Used in the sidebar header to show what is currently filtered.
   */
  describeFilters(filters: SidebarFilters): string {
    const parts: string[] = [];

    if (filters.taskStatus !== null) {
      parts.push(`status: ${filters.taskStatus}`);
    }

    if (filters.taskType !== null) {
      parts.push(`type: ${filters.taskType}`);
    }

    if (filters.phaseId !== null) {
      parts.push(`phase filtered`);
    }

    if (filters.requirementPriority !== null) {
      parts.push(`priority: ${filters.requirementPriority}`);
    }

    if (filters.requirementTag !== null) {
      parts.push(`tag: ${filters.requirementTag}`);
    }

    if (filters.searchQuery.trim().length > 0) {
      parts.push(`"${filters.searchQuery.trim()}"`);
    }

    if (parts.length === 0) {
      return "";
    }

    return `Filter: ${parts.join(", ")}`;
  }

  // Private matching helpers

  private matchRequirement(
    req: Requirement,
    query: string
  ): SearchResult[] {
    const results: SearchResult[] = [];

    if (req.content.toLowerCase().includes(query)) {
      results.push({
        type: "requirement",
        title: req.content,
        location: "Requirements",
        id: req.id,
        requirement: req,
        matchedField: "content",
      });
    }

    for (const tag of req.tags) {
      if (tag.toLowerCase().includes(query) && results.length === 0) {
        results.push({
          type: "requirement",
          title: req.content,
          location: `Tag: ${tag}`,
          id: req.id,
          requirement: req,
          matchedField: "tag",
        });
      }
    }

    return results;
  }

  private matchTask(
    task: Task,
    query: string,
    location: string
  ): SearchResult[] {
    const results: SearchResult[] = [];

    if (task.title.toLowerCase().includes(query)) {
      results.push({
        type: "task",
        title: task.title,
        location,
        id: task.id,
        task,
        matchedField: "title",
      });
      return results; // Title match is sufficient
    }

    if (task.description.toLowerCase().includes(query)) {
      results.push({
        type: "task",
        title: task.title,
        location,
        id: task.id,
        task,
        matchedField: "description",
      });
      return results;
    }

    if (task.notes.toLowerCase().includes(query)) {
      results.push({
        type: "task",
        title: task.title,
        location,
        id: task.id,
        task,
        matchedField: "notes",
      });
    }

    return results;
  }
}