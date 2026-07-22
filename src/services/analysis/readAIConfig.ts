import * as vscode from "vscode";

export function readAIConfig(): {
  apiKey: string | null;
  model: string;
  maxTokens: number;
} {
  const config = vscode.workspace.getConfiguration("sbatlas");

  const apiKey = config.get<string>("openaiApiKey") ?? "";
  const model = config.get<string>("openaiModel") ?? "gpt-4o-mini";
  const maxTokens = config.get<number>("maxTokens") ?? 4096;

  return {
    apiKey: apiKey.trim().length > 0 ? apiKey.trim() : null,
    model,
    maxTokens,
  };
}