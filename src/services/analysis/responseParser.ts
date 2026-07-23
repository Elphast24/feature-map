import { Roadmap } from "../../models/roadMap";
import { Phase } from "../../models/phase";
import { Module } from "../../models/module";
import { Task, TaskType } from "../../models/task";
import { generateId } from "../../utils/generateId";

/**
 * The raw JSON shape we expect from the AI.
 * Named with "Raw" prefix to distinguish from our domain models.
 */
interface RawRoadmap {
  phases: RawPhase[];
  warnings?: string[];
}

interface RawPhase {
  order: number;
  title: string;
  description: string;
  modules: RawModule[];
}

interface RawModule {
  title: string;
  description: string;
  tasks: RawTask[];
}

interface RawTask {
  title: string;
  description: string;
  type: string;
  requirementIds: string[];
  estimatedEffort?: number;
}

/**
 * The result of parsing the AI response.
 */
export interface ParsedResponse {
  roadmap: Roadmap;
  warnings: string[];
}

/**
 * ResponseParser converts the AI's JSON response into a
 * structured Roadmap with full domain model instances.
 *
 * Design note (defensive parsing):
 * The AI is prompted to return a specific JSON schema, and JSON mode
 * ensures valid JSON. However, field names can be wrong, types can
 * be unexpected, and required arrays can be missing. ResponseParser
 * validates every field and provides safe fallbacks rather than
 * crashing on unexpected input.
 *
 * Design note (separation from AIClient):
 * AIClient knows how to talk to OpenAI.
 * ResponseParser knows what the response means.
 * AnalysisService orchestrates both.
 * Each can be tested and changed independently.
 */
export class ResponseParser {
  /**
   * Parses the AI response string into a Roadmap.
   *
   * @param content    The raw string content from AIClient.complete()
   * @param projectId  The project this roadmap belongs to
   *
   * Throws ResponseParseError if the content cannot be converted
   * into a valid Roadmap (missing phases, empty tasks, etc.)
   */
  parse(content: string, projectId: string): ParsedResponse {
    // ── Step 1: Parse JSON ────────────────────────────────────────
    let raw: RawRoadmap;

    try {
      raw = JSON.parse(content) as RawRoadmap;
    } catch {
      throw new ResponseParseError(
        "The AI response was not valid JSON. " +
          "This is unexpected with JSON mode enabled. Please try again."
      );
    }

    // ── Step 2: Validate top-level structure ──────────────────────
    if (!raw.phases || !Array.isArray(raw.phases)) {
      throw new ResponseParseError(
        "The AI response did not contain a 'phases' array. " +
          "The response may be malformed. Please try again."
      );
    }

    if (raw.phases.length === 0) {
      throw new ResponseParseError(
        "The AI generated zero phases. " +
          "Try adding more specific requirements and regenerating."
      );
    }

    // ── Step 3: Build the Roadmap ─────────────────────────────────
    const roadmap = new Roadmap(generateId(), projectId);
    const parseWarnings: string[] = [];

    for (const rawPhase of raw.phases) {
      const phase = this.parsePhase(rawPhase, parseWarnings);
      if (phase) {
        roadmap.addPhase(phase);
      }
    }

    if (roadmap.phaseCount() === 0) {
      throw new ResponseParseError(
        "No valid phases could be parsed from the AI response. " +
          "Please try again."
      );
    }

    // Combine AI-provided warnings with parse warnings
    const allWarnings = [
      ...(raw.warnings ?? []),
      ...parseWarnings,
    ];

    return { roadmap, warnings: allWarnings };
  }

  // ─────────────────────────────────────────
  // Private parsers
  // ─────────────────────────────────────────

  private parsePhase(
    raw: RawPhase,
    warnings: string[]
  ): Phase | null {
    if (!raw.title || typeof raw.title !== "string") {
      warnings.push("A phase was skipped because it had no title.");
      return null;
    }

    if (!Array.isArray(raw.modules) || raw.modules.length === 0) {
      warnings.push(
        `Phase "${raw.title}" was skipped because it had no modules.`
      );
      return null;
    }

    const phase = new Phase(
      generateId(),
      typeof raw.order === "number" ? raw.order : 1,
      raw.title.trim(),
      typeof raw.description === "string"
        ? raw.description.trim()
        : ""
    );

    for (const rawModule of raw.modules) {
      const module = this.parseModule(rawModule, raw.title, warnings);
      if (module) {
        phase.addModule(module);
      }
    }

    if (phase.moduleCount() === 0) {
      warnings.push(
        `Phase "${raw.title}" was skipped because all its modules were invalid.`
      );
      return null;
    }

    return phase;
  }

  private parseModule(
    raw: RawModule,
    phaseName: string,
    warnings: string[]
  ): Module | null {
    if (!raw.title || typeof raw.title !== "string") {
      warnings.push(
        `A module in phase "${phaseName}" was skipped because it had no title.`
      );
      return null;
    }

    if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
      warnings.push(
        `Module "${raw.title}" was skipped because it had no tasks.`
      );
      return null;
    }

    const module = new Module(
      generateId(),
      raw.title.trim(),
      typeof raw.description === "string"
        ? raw.description.trim()
        : ""
    );

    for (const rawTask of raw.tasks) {
      const task = this.parseTask(rawTask, raw.title, warnings);
      if (task) {
        module.addTask(task);
      }
    }

    if (module.taskCount() === 0) {
      warnings.push(
        `Module "${raw.title}" was skipped because all its tasks were invalid.`
      );
      return null;
    }

    return module;
  }

  private parseTask(
    raw: RawTask,
    moduleName: string,
    warnings: string[]
  ): Task | null {
    if (!raw.title || typeof raw.title !== "string") {
      warnings.push(
        `A task in module "${moduleName}" was skipped because it had no title.`
      );
      return null;
    }

    const task = new Task(
      generateId(),
      raw.title.trim(),
      typeof raw.description === "string"
        ? raw.description.trim()
        : "",
      this.parseTaskType(raw.type),
      Array.isArray(raw.requirementIds)
        ? raw.requirementIds.filter(
            (id) => typeof id === "string" && id.length > 0
          )
        : []
    );

    if (
      typeof raw.estimatedEffort === "number" &&
      raw.estimatedEffort >= 1 &&
      raw.estimatedEffort <= 5
    ) {
      task.estimatedEffort = Math.round(raw.estimatedEffort);
    }

    return task;
  }

  /**
   * Converts the AI's task type string to a valid TaskType.
   * Falls back to "feature" if the value is unrecognised.
   */
  private parseTaskType(raw: unknown): TaskType {
    const valid: TaskType[] = [
      "feature", "test", "refactor", "docs",
      "config", "research", "security"
    ];

    if (typeof raw === "string" && valid.includes(raw as TaskType)) {
      return raw as TaskType;
    }

    return "feature";
  }
}

// ─────────────────────────────────────────────────────────────────
// Error type
// ─────────────────────────────────────────────────────────────────

export class ResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResponseParseError";
    Object.setPrototypeOf(this, ResponseParseError.prototype);
  }
}