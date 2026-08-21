import { Project } from "../../models/project";
import { ProgressSummary } from "../progress/progressTypes";
import { CoverageReport } from "../coverage/coverageTypes";

export interface ReportPrompt {
  systemMessage: string;
  userMessage: string;
}


export class ReportPromptBuilder {
  buildSummaryPrompt(
    project: Project,
    progress: ProgressSummary,
    coverage: CoverageReport
  ): ReportPrompt {
    const systemMessage = `
You are SBAtlas, a senior technical project manager and software architect.
Your task is to write a concise, professional Executive Summary for a project status report.

GUIDELINES:
1. Keep it to 2-3 structured paragraphs.
2. Paragraph 1: High-level status, current phase, and overall completion velocity.
3. Paragraph 2: Critical risks, bottlenecks, blocked tasks, or uncovered requirements.
4. Paragraph 3: Recommended immediate priorities and next strategic actions.
5. Tone: Objective, analytical, concise, and professional.
6. Do NOT include markdown headings (# or ##) inside your response. Use bullet points or bold text if necessary.
7. Focus strictly on actionable insight—do not repeat raw data tables.
`.trim();

    const blockedTasksSummary = progress.phases
      .flatMap((p) => p.modules.flatMap((m) => m))
      .filter((m) => m.inProgressTasks > 0)
      .map((m) => `${m.moduleTitle} has ${m.inProgressTasks} tasks in progress`)
      .join("; ") || "No active bottlenecks flagged";

    const userMessage = `
PROJECT: ${project.name}
DESCRIPTION: ${project.description || "None provided"}
STATUS: ${project.status}

PROGRESS METRICS:
- Overall Completion: ${progress.completionPercentage}% (${progress.completedTasks}/${progress.totalTasks} tasks)
- In-Progress Tasks: ${progress.inProgressTasks}
- Remaining Effort Estimate: ${progress.remainingEffort} points
- Active Modules: ${blockedTasksSummary}

COVERAGE METRICS:
- Requirement Coverage: ${coverage.coveragePercentage}% (${coverage.coveredCount}/${coverage.totalRequirements} requirements covered)
- Addressable Scope: ${coverage.addressablePercentage}% (${coverage.uncoveredCount} requirements currently lack tasks)
- Orphan Tasks: ${coverage.orphanTasks.length}

NEXT RECOMMENDED TASK: ${progress.nextTask ? progress.nextTask.title : "All tasks complete"}

Write an executive briefing based on these metrics.
`.trim();

    return { systemMessage, userMessage };
  }
}