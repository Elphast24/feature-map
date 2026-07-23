import * as vscode from "vscode";

export function readAIConfig(): {
  apiKey: string | null;
  model: string;
  maxTokens: number;
} {
  const config = vscode.workspace.getConfiguration("sbatlas");

  const apiKey = config.get<string>("googleApiKey") ?? "";
  const model =
    config.get<string>("googleModel") ?? "gemini-2.0-flash";
  const maxTokens = config.get<number>("maxTokens") ?? 4096;

  return {
    apiKey: apiKey.trim().length > 0 ? apiKey.trim() : null,
    model,
    maxTokens,
  };
}