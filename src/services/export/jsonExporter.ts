import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { ProgressTracker } from "../progress/progressTracker";
import { CoverageTracker } from "../coverage/coverageTracker";

//  Here, we exports the complete project state as a structured JSON string.
 
//  The JSON includes project, roadmap, progress metrics, and
//  coverage data — everything an external tool would need to
//  consume the SBAtlas project.
export class JsonExporter {
  private readonly progressTracker: ProgressTracker;
  private readonly coverageTracker: CoverageTracker;

  constructor() {
    this.progressTracker = new ProgressTracker();
    this.coverageTracker = new CoverageTracker();
  }

  export(project: Project, roadmap: Roadmap | null): string {
    const progressSummary = roadmap
      ? this.progressTracker.getSummary(roadmap)
      : null;

    const coverageReport = roadmap
      ? this.coverageTracker.getReport(project, roadmap)
      : null;

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0.0",
      generator: "SBAtlas",

      project: project.toJSON(),
      roadmap: roadmap ? roadmap.toJSON() : null,

      progress: progressSummary
        ? {
            completionPercentage: progressSummary.completionPercentage,
            totalTasks: progressSummary.totalTasks,
            completedTasks: progressSummary.completedTasks,
            inProgressTasks: progressSummary.inProgressTasks,
            pendingTasks: progressSummary.pendingTasks,
            skippedTasks: progressSummary.skippedTasks,
            remainingEffort: progressSummary.remainingEffort,
            phases: progressSummary.phases.map((p) => ({
              title: p.phaseTitle,
              order: p.phaseOrder,
              completionPercentage: p.completionPercentage,
              totalTasks: p.totalTasks,
              completedTasks: p.completedTasks,
            })),
            tasksByType: progressSummary.tasksByType,
          }
        : null,

      coverage: coverageReport
        ? {
            coveragePercentage: coverageReport.coveragePercentage,
            addressablePercentage: coverageReport.addressablePercentage,
            coveredCount: coverageReport.coveredCount,
            partialCount: coverageReport.partialCount,
            uncoveredCount: coverageReport.uncoveredCount,
            orphanTaskCount: coverageReport.orphanTasks.length,
            requirements: coverageReport.requirements.map((rc) => ({
              id: rc.requirement.id,
              content: rc.requirement.content,
              status: rc.status,
              taskCount: rc.tasks.length,
              completedTaskCount: rc.completedTaskCount,
            })),
          }
        : null,
    };

    return JSON.stringify(exportData, null, 2);
  }
}