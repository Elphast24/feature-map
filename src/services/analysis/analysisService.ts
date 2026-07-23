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

export type AIConfigReader = () => {
  apiKey: string | null;
  model: string;
  maxTokens: number;
};

export class AnalysisService {
  private readonly client: AIClient;
  private readonly promptBuilder: PromptBuilder;
  private readonly responseParser: ResponseParser;
  private readonly getConfig: AIConfigReader;

  constructor(
    client?: AIClient,
    promptBuilder?: PromptBuilder,
    responseParser?: ResponseParser,
    configReader?: AIConfigReader
  ) {
    this.client = client ?? new AIClient();
    this.promptBuilder = promptBuilder ?? new PromptBuilder();
    this.responseParser = responseParser ?? new ResponseParser();

    // No default here — configReader MUST be provided in production.
    // ExtensionLifecycle passes readAIConfig.
    // If omitted, calls to analyse() will fail with a clear error
    // at the "no API key" guard rather than crashing at import time.
    this.getConfig = configReader ?? (() => ({
      apiKey: null,
      model: "gpt-4o-mini",
      maxTokens: 4096,
    }));
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

    // ── Step 2: Read config ───────────────────────────────────────
    const { apiKey, model, maxTokens } = this.getConfig();

    if (!apiKey) {
      return {
        ok: false,
        error:
          "No Google AI API key configured. " +
          "Go to Settings → SBAtlas → Google API Key and add your key. " +
          "Get a free key at https://aistudio.google.com/apikey",
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
        model,
        maxTokens,
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
    let parsedResponse: { roadmap: Roadmap; warnings: string[] };

    try {
      parsedResponse = this.responseParser.parse(
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
        roadmap: parsedResponse.roadmap,
        warnings: parsedResponse.warnings,
        tokensUsed: aiResponse.tokensUsed,
      },
    };
  }
}