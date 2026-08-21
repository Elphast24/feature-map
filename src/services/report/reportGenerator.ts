import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { ProgressSummary } from "../progress/progressTypes";
import { CoverageReport } from "../coverage/coverageTypes";
import { RequirementCoverageStatus } from "../coverage/coverageTypes";
import { TaskStatus } from "../../models/task";


export class ReportGenerator {
  generate(
    project: Project,
    roadmap: Roadmap | null,
    progress: ProgressSummary,
    coverage: CoverageReport,
    executiveSummary: string
  ): string {
    const sections: string[] = [];

    sections.push(this.buildHeader(project));
    sections.push(this.buildExecutiveSummarySection(executiveSummary));
    sections.push(this.buildMetricsSnapshot(progress, coverage));
    sections.push(this.buildRequirementsSection(project, coverage));

    if (roadmap && roadmap.phaseCount() > 0) {
      sections.push(this.buildProgressSection(progress));
      sections.push(this.buildRoadmapSection(roadmap));
      sections.push(this.buildCoverageSection(coverage));
    }

    sections.push(this.buildFooter());

    return sections.join("\n\n");
  }

  
  // Section Builders
  private buildHeader(project: Project): string {
    const formattedDate = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return [
      `# ${project.name} — Status & Execution Report`,
      "",
      `> **Report Date:** ${formattedDate}  |  **Author:** ${project.metadata.author ?? "Unknown"}  |  **Project Status:** \`${project.status.toUpperCase()}\``,
    ].join("\n");
  }

  private buildExecutiveSummarySection(summary: string): string {
    return [
      "## 📌 Executive Summary",
      "",
      summary.trim(),
    ].join("\n");
  }

  private buildMetricsSnapshot(
    progress: ProgressSummary,
    coverage: CoverageReport
  ): string {
    const pBar = this.renderProgressBar(progress.completionPercentage);
    const cBar = this.renderProgressBar(coverage.coveragePercentage);

    return [
      "## 📊 Key Metrics Snapshot",
      "",
      `| Metric | Status / Value | Visualization |`,
      `| :--- | :--- | :--- |`,
      `| **Task Completion** | **${progress.completionPercentage}%** (${progress.completedTasks}/${progress.totalTasks} Tasks) | ${pBar} |`,
      `| **Requirement Coverage** | **${coverage.coveragePercentage}%** (${coverage.coveredCount}/${coverage.totalRequirements} Covered) | ${cBar} |`,
      `| **Scope Readiness** | **${coverage.addressablePercentage}%** Addressable | ${coverage.uncoveredCount === 0 ? "✅ 100% Scope Mapped" : `⚠️ ${coverage.uncoveredCount} Unmapped`} |`,
      `| **In-Progress Tasks** | **${progress.inProgressTasks}** active items | — |`,
      `| **Estimated Remaining Effort** | **${progress.remainingEffort}** points | — |`,
    ].join("\n");
  }

  private buildRequirementsSection(
    project: Project,
    coverage: CoverageReport
  ): string {
    const lines: string[] = [
      "## 📋 Requirements & Traceability",
      "",
      `Total Requirements: **${project.requirementCount()}**`,
      "",
      "| # | Requirement | Priority | Tags | Coverage Status | Tasks |",
      "| :--- | :--- | :---: | :--- | :---: | :---: |",
    ];

    if (project.requirements.length === 0) {
      lines.push("| — | _No requirements recorded._ | — | — | — | — |");
      return lines.join("\n");
    }

    for (const [index, req] of project.requirements.entries()) {
      const cov = coverage.requirements.find((c) => c.requirement.id === req.id);
      const covStatus = cov ? this.formatCoverageStatus(cov.status) : "Unmapped";
      const taskCount = cov ? cov.tasks.length : 0;
      const pIcon = this.formatPriority(req.priority);
      const tags = req.tags.length > 0 ? req.tags.map((t) => `\`${t}\``).join(" ") : "—";
      const cleanContent = req.content.replace(/\|/g, "\\|");

      lines.push(
        `| ${index + 1} | ${cleanContent} | ${pIcon} | ${tags} | ${covStatus} | ${taskCount} |`
      );
    }

    return lines.join("\n");
  }

  private buildProgressSection(progress: ProgressSummary): string {
    const lines: string[] = [
      "## 📈 Execution & Phase Progress",
      "",
    ];

    for (const phase of progress.phases) {
      const icon = phase.completionPercentage === 100 ? "✅" : "📦";
      lines.push(
        `### ${icon} Phase ${phase.phaseOrder}: ${phase.phaseTitle} — ${phase.completionPercentage}%`,
        "",
        `Tasks: ${phase.completedTasks}/${phase.totalTasks} complete.`,
        ""
      );

      if (phase.modules.length > 0) {
        lines.push("| Module | Completed | Total | Progress |");
        lines.push("| :--- | :---: | :---: | :--- |");
        for (const mod of phase.modules) {
          const modBar = this.renderProgressBar(mod.completionPercentage);
          lines.push(
            `| **${mod.moduleTitle}** | ${mod.completedTasks} | ${mod.totalTasks} | ${modBar} |`
          );
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  private buildRoadmapSection(roadmap: Roadmap): string {
    const lines: string[] = [
      "## 🗺️ Detailed Roadmap Breakdown",
      "",
    ];

    for (const phase of roadmap.phases) {
      lines.push(`### Phase ${phase.order}: ${phase.title}`);
      if (phase.description) {
        lines.push(`> _${phase.description}_`, "");
      }

      for (const module of phase.modules) {
        lines.push(`#### 🔧 ${module.title}`);
        if (module.description) {
          lines.push(`${module.description}`, "");
        }

        for (const task of module.tasks) {
          const sIcon = this.formatTaskStatus(task.status);
          const effort = task.estimatedEffort ? ` \`[${task.estimatedEffort} pts]\`` : "";
          const blocked = task.blockedBy.length > 0 ? " ⛔ _(Blocked)_" : "";

          lines.push(`- ${sIcon} **${task.title}** (\`${task.type}\`)${effort}${blocked}`);

          if (task.description) {
            lines.push(`  - ${task.description}`);
          }
          if (task.notes) {
            lines.push(`  - 📝 **Notes:** _${task.notes.replace(/\n/g, " ") }_`);
          }
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  private buildCoverageSection(coverage: CoverageReport): string {
    const lines: string[] = [
      "## 🛡️ Scope & Risk Analysis",
      "",
    ];

    if (coverage.uncoveredCount > 0) {
      lines.push(
        `### ⚠️ Uncovered Requirements (${coverage.uncoveredCount})`,
        "The following requirements currently have no tasks assigned in the roadmap:",
        ""
      );
      const uncovered = coverage.requirements.filter(
        (r) => r.status === RequirementCoverageStatus.Uncovered
      );
      for (const item of uncovered) {
        lines.push(`- ❌ **[${item.requirement.id}]** ${item.requirement.content}`);
      }
      lines.push("");
    } else {
      lines.push("### ✅ Complete Scope Coverage", "All registered requirements have planned execution tasks.", "");
    }

    if (coverage.orphanTasks.length > 0) {
      lines.push(
        `### ⚠️ Orphan Tasks (${coverage.orphanTasks.length})`,
        "The following tasks are not linked to any source requirement:",
        ""
      );
      for (const item of coverage.orphanTasks) {
        lines.push(`- ⚠️ **${item.task.title}** _(${item.phaseName} → ${item.moduleName})_`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  private buildFooter(): string {
    return [
      "---",
      `*Report produced automatically by [SBAtlas](https://github.com/sbatlas) — AI Project Intelligence for VS Code.*`,
    ].join("\n");
  }

  
  // Helper Formatters
  private renderProgressBar(pct: number): string {
    const totalBars = 10;
    const filled = Math.round((pct / 100) * totalBars);
    const empty = totalBars - filled;
    return `\`${"█".repeat(filled)}${"░".repeat(empty)}\` ${pct}%`;
  }

  private formatPriority(priority: string): string {
    switch (priority) {
      case "high":
        return "🔴 High";
      case "low":
        return "🟢 Low";
      default:
        return "🟡 Med";
    }
  }

  private formatCoverageStatus(status: RequirementCoverageStatus): string {
    switch (status) {
      case RequirementCoverageStatus.Covered:
        return "✅ Covered";
      case RequirementCoverageStatus.Partial:
        return "🔶 In Progress";
      case RequirementCoverageStatus.Uncovered:
        return "❌ Unmapped";
    }
  }

  private formatTaskStatus(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.Done:
        return "✅";
      case TaskStatus.InProgress:
        return "🔄";
      case TaskStatus.Skipped:
        return "⏭️";
      case TaskStatus.Pending:
      default:
        return "⬜";
    }
  }
}