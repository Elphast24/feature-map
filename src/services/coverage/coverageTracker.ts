import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { Requirement } from "../../models/requirement";
import { Task } from "../../models/task";
import {
  CoverageReport,
  RequirementCoverage,
  RequirementCoverageStatus,
  OrphanTask,
} from "./coverageTypes";

export class CoverageTracker {
  // ─────────────────────────────────────────
  // Full report
  // ─────────────────────────────────────────

  /**
   * Generates a complete coverage report for a project and its roadmap.
   *
   * @param project   The project containing requirements
   * @param roadmap   The roadmap containing tasks
   */
  getReport(
    project: Project | null,
    roadmap: Roadmap | null
  ): CoverageReport {
    if (!project || project.requirements.length === 0) {
      return this.emptyReport("No requirements to track coverage for.");
    }

    if (!roadmap || roadmap.totalTaskCount() === 0) {
      return this.noRoadmapReport(project);
    }

    const requirements = project.requirements.map((req) =>
      this.getRequirementCoverage(req, roadmap)
    );

    // Find orphan tasks
    const orphanTasks = this.findOrphanTasks(roadmap);

    // Compute counts
    const coveredCount = requirements.filter(
      (r) => r.status === RequirementCoverageStatus.Covered
    ).length;

    const partialCount = requirements.filter(
      (r) => r.status === RequirementCoverageStatus.Partial
    ).length;

    const uncoveredCount = requirements.filter(
      (r) => r.status === RequirementCoverageStatus.Uncovered
    ).length;

    const totalRequirements = requirements.length;

    // Covered = requirements where at least one task is done
    const coveragePercentage =
      totalRequirements === 0
        ? 0
        : Math.round((coveredCount / totalRequirements) * 100);

    // Addressable = requirements where at least one task exists
    const addressedCount = requirements.filter(
      (r) => r.tasks.length > 0
    ).length;

    const addressablePercentage =
      totalRequirements === 0
        ? 0
        : Math.round((addressedCount / totalRequirements) * 100);

    // Build warnings
    const warnings = this.buildWarnings(
      requirements,
      orphanTasks,
      uncoveredCount,
      addressablePercentage
    );

    // Build description
    const description = this.buildDescription(
      totalRequirements,
      coveredCount,
      partialCount,
      uncoveredCount,
      coveragePercentage,
      addressablePercentage,
      orphanTasks.length
    );

    return {
      totalRequirements,
      coveredCount,
      partialCount,
      uncoveredCount,
      coveragePercentage,
      addressablePercentage,
      requirements,
      orphanTasks,
      description,
      warnings,
    };
  }

  // Per-requirement coverage
  getRequirementCoverage(
    requirement: Requirement,
    roadmap: Roadmap
  ): RequirementCoverage {
    const tasks = roadmap.tasksForRequirement(requirement.id);
    const completedTaskCount = tasks.filter((t) => t.isComplete).length;

    let status: RequirementCoverageStatus;

    if (tasks.length === 0) {
      status = RequirementCoverageStatus.Uncovered;
    } else if (completedTaskCount > 0) {
      status = RequirementCoverageStatus.Covered;
    } else {
      status = RequirementCoverageStatus.Partial;
    }

    return {
      requirement,
      tasks,
      completedTaskCount,
      status,
    };
  }

  // Orphan tasks
  findOrphanTasks(roadmap: Roadmap): OrphanTask[] {
    const orphans: OrphanTask[] = [];

    for (const phase of roadmap.phases) {
      for (const module of phase.modules) {
        for (const task of module.tasks) {
          if (
            !task.requirementIds ||
            task.requirementIds.length === 0
          ) {
            orphans.push({
              task,
              moduleName: module.title,
              phaseName: phase.title,
            });
          }
        }
      }
    }

    return orphans;
  }

  // Filtered queries
  getUncoveredRequirements(
    project: Project,
    roadmap: Roadmap
  ): RequirementCoverage[] {
    return project.requirements
      .map((req) => this.getRequirementCoverage(req, roadmap))
      .filter(
        (rc) => rc.status === RequirementCoverageStatus.Uncovered
      );
  }


  getPartiallyAddressed(
    project: Project,
    roadmap: Roadmap
  ): RequirementCoverage[] {
    return project.requirements
      .map((req) => this.getRequirementCoverage(req, roadmap))
      .filter(
        (rc) => rc.status === RequirementCoverageStatus.Partial
      );
  }


  getFullyCovered(
    project: Project,
    roadmap: Roadmap
  ): RequirementCoverage[] {
    return project.requirements
      .map((req) => this.getRequirementCoverage(req, roadmap))
      .filter(
        (rc) => rc.status === RequirementCoverageStatus.Covered
      );
  }

  // Private helpers
  private emptyReport(description: string): CoverageReport {
    return {
      totalRequirements: 0,
      coveredCount: 0,
      partialCount: 0,
      uncoveredCount: 0,
      coveragePercentage: 0,
      addressablePercentage: 0,
      requirements: [],
      orphanTasks: [],
      description,
      warnings: [],
    };
  }

  private noRoadmapReport(project: Project): CoverageReport {
    const requirements = project.requirements.map((req) => ({
      requirement: req,
      tasks: [] as Task[],
      completedTaskCount: 0,
      status: RequirementCoverageStatus.Uncovered,
    }));

    return {
      totalRequirements: project.requirements.length,
      coveredCount: 0,
      partialCount: 0,
      uncoveredCount: project.requirements.length,
      coveragePercentage: 0,
      addressablePercentage: 0,
      requirements,
      orphanTasks: [],
      description:
        `No roadmap generated. All ${project.requirements.length} ` +
        `requirements are uncovered.`,
      warnings: [
        "Generate a roadmap to create tasks that address your requirements.",
      ],
    };
  }

  private buildWarnings(
    requirements: RequirementCoverage[],
    orphanTasks: OrphanTask[],
    uncoveredCount: number,
    addressablePercentage: number
  ): string[] {
    const warnings: string[] = [];

    if (uncoveredCount > 0) {
      const uncovered = requirements.filter(
        (r) => r.status === RequirementCoverageStatus.Uncovered
      );

      warnings.push(
        `${uncoveredCount} requirement${uncoveredCount === 1 ? "" : "s"} ` +
          `ha${uncoveredCount === 1 ? "s" : "ve"} no tasks addressing ` +
          `${uncoveredCount === 1 ? "it" : "them"}. Consider regenerating ` +
          `the roadmap or adding tasks manually.`
      );

      // List uncovered requirements (max 5 to avoid overwhelming)
      const listed = uncovered.slice(0, 5);
      for (const rc of listed) {
        const preview =
          rc.requirement.content.length > 80
            ? rc.requirement.content.slice(0, 80).trimEnd() + "…"
            : rc.requirement.content;
        warnings.push(`  ⚠ Uncovered: "${preview}"`);
      }

      if (uncovered.length > 5) {
        warnings.push(
          `  ... and ${uncovered.length - 5} more uncovered requirements.`
        );
      }
    }

    if (orphanTasks.length > 0) {
      warnings.push(
        `${orphanTasks.length} task${orphanTasks.length === 1 ? "" : "s"} ` +
          `ha${orphanTasks.length === 1 ? "s" : "ve"} no requirement ` +
          `link${orphanTasks.length === 1 ? "" : "s"}. These tasks cannot ` +
          `be traced back to a user requirement.`
      );
    }

    if (addressablePercentage < 100 && addressablePercentage > 0) {
      warnings.push(
        `Roadmap addressable coverage is ${addressablePercentage}%. ` +
          `${100 - addressablePercentage}% of requirements have no ` +
          `tasks in the roadmap at all.`
      );
    }

    return warnings;
  }

  private buildDescription(
    totalRequirements: number,
    coveredCount: number,
    partialCount: number,
    uncoveredCount: number,
    coveragePercentage: number,
    addressablePercentage: number,
    orphanCount: number
  ): string {
    const parts: string[] = [];

    parts.push(
      `Coverage: ${coveragePercentage}% ` +
        `(${coveredCount}/${totalRequirements} requirements fully covered)`
    );

    parts.push(
      `Addressable: ${addressablePercentage}% ` +
        `(${totalRequirements - uncoveredCount}/${totalRequirements} ` +
        `requirements have tasks)`
    );

    if (partialCount > 0) {
      parts.push(
        `${partialCount} requirement${partialCount === 1 ? "" : "s"} ` +
          `partially addressed`
      );
    }

    if (uncoveredCount > 0) {
      parts.push(
        `${uncoveredCount} requirement${uncoveredCount === 1 ? "" : "s"} uncovered`
      );
    }

    if (orphanCount > 0) {
      parts.push(
        `${orphanCount} orphan task${orphanCount === 1 ? "" : "s"}`
      );
    }

    return parts.join("  |  ");
  }
}