import { Project } from "../../models/project";


export interface BuiltPrompt {
  systemMessage: string;
  userMessage: string;
}

export class PromptBuilder {
  /**
   * Builds the prompt for full roadmap generation from a project.
   */
  buildRoadmapPrompt(project: Project): BuiltPrompt {
    const systemMessage = this.buildSystemMessage();
    const userMessage = this.buildUserMessage(project);

    return { systemMessage, userMessage };
  }

  // ─────────────────────────────────────────
  // Private builders
  // ─────────────────────────────────────────

  private buildSystemMessage(): string {
    return `
You are SBAtlas, an expert software project planner.

Your job is to analyse software project requirements and generate a
structured development roadmap that a developer can execute against.

RULES:
1. Group requirements into logical development phases
   (e.g. Foundation, Core Features, Enhancements).
2. Within each phase, group related requirements into modules
   (e.g. Authentication, Payments, Reporting).
3. For each module, generate specific, actionable development tasks.
4. Every task must reference the requirement IDs it addresses.
5. Tasks must be specific enough to complete in one session.
6. Include testing tasks for every module.
7. Do not generate code — only planning artifacts.
8. Phases should be ordered by dependency: foundational work first.

TASK TYPES (use exactly these values):
  "feature"  — new functionality
  "test"     — writing or updating tests
  "refactor" — improving structure without changing behaviour
  "docs"     — documentation
  "config"   — environment or infrastructure setup
  "research" — investigation before implementation
  "security" — security-specific implementation

COMPLEXITY GUIDANCE:
  Simple requirements   → 2-3 tasks
  Moderate requirements → 3-5 tasks
  Complex requirements  → 5-8 tasks

You MUST respond with valid JSON matching EXACTLY this schema:

{
  "phases": [
    {
      "order": 1,
      "title": "string",
      "description": "string",
      "modules": [
        {
          "title": "string",
          "description": "string",
          "tasks": [
            {
              "title": "string",
              "description": "string",
              "type": "feature | test | refactor | docs | config | research | security",
              "requirementIds": ["req-id-1", "req-id-2"],
              "estimatedEffort": 1
            }
          ]
        }
      ]
    }
  ],
  "warnings": ["optional warnings about ambiguous requirements"]
}

estimatedEffort scale: 1 (trivial) → 5 (very large).
warnings is optional and may be an empty array.
`.trim();
  }

  private buildUserMessage(project: Project): string {
    const requirementsList = project.requirements
      .map((r, i) => `[${r.id}] (${i + 1}) ${r.content}`)
      .join("\n");

    return `
PROJECT NAME: ${project.name}

PROJECT DESCRIPTION:
${project.description || "No description provided."}

REQUIREMENTS (${project.requirements.length} total):
${requirementsList}

Generate a complete development roadmap for this project.
Every requirement must be addressed by at least one task.
`.trim();
  }
}