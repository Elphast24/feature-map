import * as vscode from "vscode";
import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { ProgressTracker } from "../progress/progressTracker";
import { CoverageTracker } from "../coverage/coverageTracker";
import { ReportPromptBuilder } from "./reportPromptBuilder";
import { ReportGenerator } from "./reportGenerator";
import { AIClient, AIClientError } from "../analysis/AIClient";
import { AIConfigReader } from "../analysis/analysisService";
import { ServiceResult } from "../project/projectService";

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(error: string): ServiceResult<T> => ({ ok: false, error });

export interface GeneratedReport {
  content: string;
  isAiGeneratedSummary: boolean;
  warnings: string[];
}

/**
 * ReportService orchestrates the creation of comprehensive reports,
 * combining entity tracking, deterministic metrics, and optional AI synthesis.
 */
export class ReportService {
  private readonly progressTracker: ProgressTracker;
  private readonly coverageTracker: CoverageTracker;
  private readonly promptBuilder: ReportPromptBuilder;
  private readonly reportGenerator: ReportGenerator;
  private readonly aiClient: AIClient;
  private readonly configReader: AIConfigReader;

  constructor(configReader: AIConfigReader, aiClient?: AIClient) {
    this.progressTracker = new ProgressTracker();
    this.coverageTracker = new CoverageTracker();
    this.promptBuilder = new ReportPromptBuilder();
    this.reportGenerator = new ReportGenerator();
    this.aiClient = aiClient ?? new AIClient();
    this.configReader = configReader;
  }

  /**
   * Generates a full markdown report, attempting AI executive summary first
   * with automatic fallback to deterministic summary.
   */
  async generateReport(
    project: Project,
    roadmap: Roadmap | null
  ): Promise<ServiceResult<GeneratedReport>> {
    const progress = this.progressTracker.getSummary(roadmap);
    const coverage = this.coverageTracker.getReport(project, roadmap);
    const warnings: string[] = [];

    // Attempt AI synthesis
    let executiveSummary = "";
    let isAiGeneratedSummary = false;

    const { apiKey, model, maxTokens } = this.configReader();

    if (apiKey) {
      try {
        const prompt = this.promptBuilder.buildSummaryPrompt(
          project,
          progress,
          coverage
        );

        const response = await this.aiClient.complete({
          apiKey,
          model,
          maxTokens: Math.min(maxTokens, 1500),
          systemMessage: prompt.systemMessage,
          userMessage: prompt.userMessage,
        });

        if (response.content && response.content.trim().length > 0) {
          executiveSummary = response.content.trim();
          isAiGeneratedSummary = true;
        }
      } catch (error) {
        const msg = error instanceof AIClientError ? error.message : String(error);
        warnings.push(`AI summary skipped: ${msg}. Generated rule-based summary instead.`);
      }
    } else {
      warnings.push("No Google AI API Key found. Used rule-based executive summary.");
    }

    // Deterministic fallback if AI did not generate
    if (!executiveSummary) {
      executiveSummary = this.buildDeterministicSummary(project, progress, coverage);
    }

    const content = this.reportGenerator.generate(
      project,
      roadmap,
      progress,
      coverage,
      executiveSummary
    );

    return ok({
      content,
      isAiGeneratedSummary,
      warnings,
    });
  }

  /**
   * Saves the generated report to disk in the workspace or chosen path.
   */
  async saveReport(
    workspaceRoot: vscode.Uri,
    project: Project,
    content: string
  ): Promise<ServiceResult<vscode.Uri>> {
    try {
      const reportsDir = vscode.Uri.joinPath(workspaceRoot, "reports");
      await vscode.workspace.fs.createDirectory(reportsDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const safeProjectName = project.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      const filename = `${safeProjectName}_report_${timestamp}.md`;
      const fileUri = vscode.Uri.joinPath(reportsDir, filename);

      const bytes = Buffer.from(content, "utf8");
      await vscode.workspace.fs.writeFile(fileUri, bytes);

      return ok(fileUri);
    } catch (error) {
      return fail(`Failed to save report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  
  // Deterministic Fallback Builder
  

  private buildDeterministicSummary(
    project: Project,
    progress: ProgressSummary,
    coverage: CoverageReport
  ): string {
    const paragraphs: string[] = [];

    // Paragraph 1: General Status
    paragraphs.push(
      `Project **${project.name}** is currently marked as **${project.status.toUpperCase()}** with an overall execution completion rate of **${progress.completionPercentage}%** (${progress.completedTasks} of ${progress.totalTasks} planned tasks finished).`
    );

    // Paragraph 2: Risks & Coverage
    const riskNotes: string[] = [];
    if (coverage.uncoveredCount > 0) {
      riskNotes.push(`**${coverage.uncoveredCount}** requirements lack planned execution tasks`);
    }
    if (coverage.orphanTasks.length > 0) {
      riskNotes.push(`**${coverage.orphanTasks.length}** orphan tasks lack requirement traceability`);
    }
    if (progress.inProgressTasks > 0) {
      riskNotes.push(`**${progress.inProgressTasks}** tasks are actively in progress`);
    }

    if (riskNotes.length > 0) {
      paragraphs.push(`Identified focus areas: ${riskNotes.join(", ")}.`);
    } else {
      paragraphs.push(
        `All requirements are fully mapped to roadmap tasks with no orphan tasks detected.`
      );
    }

    // Paragraph 3: Actionable Next Step
    if (progress.nextTask) {
      paragraphs.push(
        `Immediate recommended action is to advance task **${progress.nextTask.title}**.`
      );
    } else {
      paragraphs.push(`All roadmap objectives have been completed.`);
    }

    return paragraphs.join("\n\n");
  }
}