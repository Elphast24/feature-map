import { Project } from "../../models/project";
import { Roadmap } from "../../models/roadMap";
import { AIClient, AIClientError } from "./AIClient";
import { PromptBuilder } from "./promptBuilder";
import { ResponseParser } from "./responseParser";
import { ServiceResult } from "../project/projectService";

export interface AnalysisResult {
  roadmap: Roadmap;
  warnings: string[];
  tokensUsed: number;
}

export class AnalysisService {
  private readonly client: AIClient;
  private readonly promptBuilder: PromptBuilder;
  private readonly responseParser: ResponseParser;

  constructor(
    client?: AIClient,
    promptBuilder?: PromptBuilder,
    responseParser?: ResponseParser
  ) {
    this.client = client ?? new AIClient();
    this.promptBuilder = promptBuilder ?? new PromptBuilder();
    this.responseParser = responseParser ?? new ResponseParser();
  }

  async analyse(
    project: Project
  ): Promise<ServiceResult<AnalysisResult>> {
    // ── Step 1: Validate ──────────────────────────────────────────
    if (project.requirements.length === 0) {
      return {
        ok: false,
        error:
          "Cannot generate a roadmap for a project with no requirements. " +
          "Add at least one requirement first.",
      };
    }

    // ── Step 2: Read API key ──────────────────────────────────────
    const apiKey = AIClient.getApiKey();

    if (!apiKey) {
      return {
        ok: false,
        error:
          "No OpenAI API key configured. " +
          "Go to Settings → SBAtlas → OpenAI API Key and add your key.",
      };
    }

    // ── Step 3: Build the prompt ──────────────────────────────────
    const { systemMessage, userMessage } =
      this.promptBuilder.buildRoadmapPrompt(project);

    // ── Step 4: Call the AI ───────────────────────────────────────
    let aiResponse: { content: string; tokensUsed: number };

    try {
      aiResponse = await this.client.complete({
        apiKey,
        model: AIClient.getModel(),
        maxTokens: AIClient.getMaxTokens(),
        systemMessage,
        userMessage,
      });
    } catch (error) {
      if (error instanceof AIClientError) {
        return { ok: false, error: error.message };
      }

      return {
        ok: false,
        error:
          "An unexpected error occurred while contacting the AI. " +
          (error instanceof Error ? error.message : String(error)),
      };
    }

    // ── Step 5: Parse the response ────────────────────────────────
    let parsed: { roadmap: Roadmap; warnings: string[] };

    try {
      parsed = this.responseParser.parse(
        aiResponse.content,
        project.id
      );
    } catch (error) {
      return {
        ok: false,
        error:
          "The AI returned a response that could not be converted " +
          "into a roadmap. " +
          (error instanceof Error ? error.message : String(error)),
      };
    }

    // ── Step 6: Return ────────────────────────────────────────────
    return {
      ok: true,
      data: {
        roadmap: parsed.roadmap,
        warnings: parsed.warnings,
        tokensUsed: aiResponse.tokensUsed,
      },
    };
  }
}