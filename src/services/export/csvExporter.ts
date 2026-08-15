import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { CoverageTracker } from "../coverage/coverageTracker";

//  Exports coverage data as CSV.
//  CSV is useful for importing into spreadsheets for reporting
//  to stakeholders who prefer Excel/Google Sheets.
export class CsvExporter {
  private readonly coverageTracker: CoverageTracker;

  constructor() {
    this.coverageTracker = new CoverageTracker();
  }

//    Exports coverage as CSV.
  exportCoverage(
    project: Project,
    roadmap: Roadmap | null
  ): string {
    const report = this.coverageTracker.getReport(project, roadmap);

    const lines: string[] = [];

    // Header
    lines.push(
      "Requirement ID,Content,Priority,Status,Task Count,Completed Tasks"
    );

    // Data rows
    for (const rc of report.requirements) {
      lines.push(
        [
          escapeCSV(rc.requirement.id),
          escapeCSV(rc.requirement.content),
          escapeCSV(rc.requirement.priority),
          escapeCSV(rc.status),
          String(rc.tasks.length),
          String(rc.completedTaskCount),
        ].join(",")
      );
    }

    return lines.join("\n");
  }

  /**
   * Exports all tasks as CSV.
   */
  exportTasks(roadmap: Roadmap | null): string {
    if (!roadmap) {
      return "Phase,Module,Task,Status,Type,Effort,Blocked By,Requirement IDs";
    }

    const lines: string[] = [];

    // Header
    lines.push(
      "Phase,Module,Task,Description,Status,Type,Effort,Blocked By,Requirement IDs"
    );

    // Data rows
    for (const phase of roadmap.phases) {
      for (const module of phase.modules) {
        for (const task of module.tasks) {
          lines.push(
            [
              escapeCSV(`Phase ${phase.order}: ${phase.title}`),
              escapeCSV(module.title),
              escapeCSV(task.title),
              escapeCSV(task.description),
              escapeCSV(task.status),
              escapeCSV(task.type),
              String(task.estimatedEffort ?? ""),
              escapeCSV(task.blockedBy.join("; ")),
              escapeCSV(task.requirementIds.join("; ")),
            ].join(",")
          );
        }
      }
    }

    return lines.join("\n");
  }
}

/**
 * Escapes a value for CSV.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCSV(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}