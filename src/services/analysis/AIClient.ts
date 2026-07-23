import * as https from "https";

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

/**
 * A model available on Google AI Studio.
 */
export interface AIModelInfo {
  id: string;
  displayName: string;
  description: string;
  supportedMethods: string[];
}

export class AIClient {
  private static readonly BASE_URL =
    "generativelanguage.googleapis.com";

  // Model listing
  async listModels(apiKey: string): Promise<AIModelInfo[]> {
    const path = `/v1beta/models?key=${apiKey}`;
    const raw = await this.get(path);

    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AIClientError(
        "Could not parse model list from Google AI.",
        "PARSE_ERROR"
      );
    }

    const models = parsed.models as
      | Array<{
          name: string;
          displayName: string;
          description: string;
          supportedGenerationMethods?: string[];
        }>
      | undefined;

    if (!models || !Array.isArray(models)) {
      throw new AIClientError(
        "Google AI returned an unexpected model list format.",
        "PARSE_ERROR"
      );
    }

    // Filter to only models that support generateContent
    // and extract a clean model ID (strip "models/" prefix)
    return models
      .filter((m) =>
        m.supportedGenerationMethods?.includes("generateContent")
      )
      .map((m) => ({
        id: m.name.replace("models/", ""),
        displayName: m.displayName,
        description: m.description ?? "",
        supportedMethods: m.supportedGenerationMethods ?? [],
      }));
  }

  // ─────────────────────────────────────────
  // Content generation
  // ─────────────────────────────────────────

  async complete(config: AIRequestConfig): Promise<AIResponse> {
    const body = JSON.stringify({
      systemInstruction: {
        parts: [{ text: config.systemMessage }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: config.userMessage }],
        },
      ],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const path =
      `/v1beta/models/${config.model}:generateContent` +
      `?key=${config.apiKey}`;

    const rawResponse = await this.post(body, path);
    return this.parseAPIResponse(rawResponse);
  }

  // ─────────────────────────────────────────
  // Private HTTP layer
  // ─────────────────────────────────────────

  /**
   * HTTPS GET request.
   */
  private get(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: AIClient.BASE_URL,
        path,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });

        res.on("end", () => {
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(
              new AIClientError(
                "Invalid or unauthorised Google AI API key. " +
                  "Check your key at aistudio.google.com/apikey.",
                "AUTH_ERROR"
              )
            );
            return;
          }

          if (!res.statusCode || res.statusCode >= 400) {
            reject(
              new AIClientError(
                `Google AI API returned status ${res.statusCode}. ` +
                  `Response: ${data}`,
                "API_ERROR"
              )
            );
            return;
          }

          resolve(data);
        });
      });

      req.on("error", (error: Error) => {
        reject(
          new AIClientError(
            `Network error while contacting Google AI: ${error.message}`,
            "NETWORK_ERROR"
          )
        );
      });

      req.setTimeout(15000, () => {
        req.destroy();
        reject(
          new AIClientError(
            "Request to Google AI timed out.",
            "TIMEOUT"
          )
        );
      });

      req.end();
    });
  }

  /**
   * HTTPS POST request.
   */
  private post(body: string, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: AIClient.BASE_URL,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });

        res.on("end", () => {
          if (res.statusCode === 400) {
            reject(
              new AIClientError(
                "Bad request to Google AI. The prompt may be too long " +
                  "or contain unsupported content.",
                "API_ERROR"
              )
            );
            return;
          }

          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(
              new AIClientError(
                "Invalid or unauthorised Google AI API key. " +
                  "Check your key at aistudio.google.com/apikey " +
                  "and update it in SBAtlas settings.",
                "AUTH_ERROR"
              )
            );
            return;
          }

          if (res.statusCode === 404) {
            reject(
              new AIClientError(
                `Model "${path.split("/models/")[1]?.split(":")[0]}" not found. ` +
                  `Run "SBAtlas: Select AI Model" to pick a valid model.`,
                "API_ERROR"
              )
            );
            return;
          }

          if (res.statusCode === 429) {
            reject(
              new AIClientError(
                "Google AI rate limit reached. " +
                  "Please wait a moment and try again.",
                "RATE_LIMIT"
              )
            );
            return;
          }

          if (!res.statusCode || res.statusCode >= 400) {
            reject(
              new AIClientError(
                `Google AI API returned status ${res.statusCode}. ` +
                  `Response: ${data}`,
                "API_ERROR"
              )
            );
            return;
          }

          resolve(data);
        });
      });

      req.on("error", (error: Error) => {
        reject(
          new AIClientError(
            `Network error while contacting Google AI: ${error.message}`,
            "NETWORK_ERROR"
          )
        );
      });

      req.setTimeout(60000, () => {
        req.destroy();
        reject(
          new AIClientError(
            "Request to Google AI timed out after 60 seconds. Try again.",
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
        "Could not parse Google AI response as JSON.",
        "PARSE_ERROR"
      );
    }

    const candidates = parsed.candidates as
      | Array<{
          content: { parts: Array<{ text: string }> };
          finishReason?: string;
        }>
      | undefined;

    if (
      !candidates ||
      candidates.length === 0 ||
      !candidates[0].content?.parts?.[0]?.text
    ) {
      const promptFeedback = parsed.promptFeedback as
        | { blockReason?: string }
        | undefined;

      if (promptFeedback?.blockReason) {
        throw new AIClientError(
          `Google AI blocked the request: ${promptFeedback.blockReason}. ` +
            "Try rephrasing your requirements.",
          "API_ERROR"
        );
      }

      throw new AIClientError(
        "Google AI response did not contain expected content. " +
          "Please try again.",
        "EMPTY_RESPONSE"
      );
    }

    const usageMetadata = parsed.usageMetadata as
      | { totalTokenCount?: number }
      | undefined;

    return {
      content: candidates[0].content.parts[0].text,
      tokensUsed: usageMetadata?.totalTokenCount ?? 0,
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