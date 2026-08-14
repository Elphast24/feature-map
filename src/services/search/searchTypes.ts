import { Requirement } from "../../models/requirement";
import { Task } from "../../models/task";

export interface SearchResult {
  type: "requirement" | "task";
  title: string;
  location: string;
  id: string;
  requirement?: Requirement;
  task?: Task;
  matchedField: "title" | "content" | "description" | "notes" | "tag";
}

export interface SidebarFilters {
  taskStatus: import("../../models/task").TaskStatus | null;
  taskType: import("../../models/task").TaskType | null;
  phaseId: string | null;

  requirementPriority:
    | import("../../models/requirement").RequirementPriority
    | null;
  requirementTag: string | null;
  searchQuery: string;
}

/**
 * Creates a default (no filter) state.
 */
export function emptyFilters(): SidebarFilters {
  return {
    taskStatus: null,
    taskType: null,
    phaseId: null,
    requirementPriority: null,
    requirementTag: null,
    searchQuery: "",
  };
}

export function isFiltersEmpty(filters: SidebarFilters): boolean {
  return (
    filters.taskStatus === null &&
    filters.taskType === null &&
    filters.phaseId === null &&
    filters.requirementPriority === null &&
    filters.requirementTag === null &&
    filters.searchQuery.trim().length === 0
  );
}