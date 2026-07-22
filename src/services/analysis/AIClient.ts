import * as https from "https";
import * as vscode from "vscode";

export interface AIRequestConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  systemMessage: string;
  userMessage: string;
}


export interface AIResponse {
  content: string;
  tokensUsed: number;
}

export class AIClient {
  private static readonly OPENAI_API_URL =
    "https://api.openai.com/v1/chat/completions";

  async complete(config: AIRequestConfig): Promise<AIResponse> {
    const body = JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemMessage },
        { role: "user", content: config.userMessage },
      ],
      max_tokens: config.maxTokens,
      // JSON mode: OpenAI guarantees the response is valid JSON.
      // The prompt must explicitly ask for JSON for this to work correctly.
      response_format: { type: "json_object" },
      temperature: 0.2, // Low temperature for consistent, structured output
    });

    const rawResponse = await this.post(body, config.apiKey);
    return this.parseAPIResponse(rawResponse);
  }


  static getApiKey(): string | null {
    const config = vscode.workspace.getConfiguration("sbatlas");
    const key = config.get<string>("openaiApiKey");

    if (!key || key.trim().length === 0) {
      return null;
    }

    return key.trim();
  }

  static getModel(): string {
    const config = vscode.workspace.getConfiguration("sbatlas");
    return (
      config.get<string>("openaiModel") ?? "gpt-4o-mini"
    );
  }


  static getMaxTokens(): number {
    const config = vscode.workspace.getConfiguration("sbatlas");
    return config.get<number>("maxTokens") ?? 4096;
  }

  // ─────────────────────────────────────────
  // Private HTTP layer
  // ─────────────────────────────────────────

  private post(body: string, apiKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(AIClient.OPENAI_API_URL);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });

        res.on("end", () => {
          // HTTP error codes from the API
          if (res.statusCode === 401) {
            reject(
              new AIClientError(
                "Invalid API key. Check your OpenAI API key in SBAtlas settings.",
                "AUTH_ERROR"
              )
            );
            return;
          }

          if (res.statusCode === 429) {
            reject(
              new AIClientError(
                "OpenAI rate limit reached. Please wait a moment and try again.",
                "RATE_LIMIT"
              )
            );
            return;
          }

          if (res.statusCode === 402) {
            reject(
              new AIClientError(
                "OpenAI quota exceeded. Check your billing at platform.openai.com.",
                "QUOTA_EXCEEDED"
              )
            );
            return;
          }

          if (!res.statusCode || res.statusCode >= 400) {
            reject(
              new AIClientError(
                `OpenAI API returned status ${res.statusCode}. Response: ${data}`,
                "API_ERROR"
              )
            );
            return;
          }

          resolve(data);
        });
      });

      req.on("error", (error: Error) => {
        // Network-level failures (DNS, timeout, connection refused)
        reject(
          new AIClientError(
            `Network error while contacting OpenAI: ${error.message}`,
            "NETWORK_ERROR"
          )
        );
      });

      // Set a 60-second timeout — AI responses can take time
      req.setTimeout(60000, () => {
        req.destroy();
        reject(
          new AIClientError(
            "Request to OpenAI timed out after 60 seconds. Try again.",
            "TIMEOUT"
          )
        );
      });

      req.write(body);
      req.end();
    });
  }


  private parseAPIResponse(raw: string): AIResponse {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AIClientError(
        "Could not parse OpenAI response as JSON. The API may be experiencing issues.",
        "PARSE_ERROR"
      );
    }

    const choices = parsed.choices as Array<{
      message: { content: string };
    }> | undefined;

    if (!choices || choices.length === 0 || !choices[0].message?.content) {
      throw new AIClientError(
        "OpenAI response did not contain expected content. Please try again.",
        "EMPTY_RESPONSE"
      );
    }

    const usage = parsed.usage as
      | { total_tokens: number }
      | undefined;

    return {
      content: choices[0].message.content,
      tokensUsed: usage?.total_tokens ?? 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Error type
// ─────────────────────────────────────────────────────────────────

export type AIErrorCode =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "QUOTA_EXCEEDED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "EMPTY_RESPONSE";

export class AIClientError extends Error {
  public readonly code: AIErrorCode;

  constructor(message: string, code: AIErrorCode) {
    super(message);
    this.name = "AIClientError";
    this.code = code;
    Object.setPrototypeOf(this, AIClientError.prototype);
  }
}