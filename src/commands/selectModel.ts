import * as vscode from "vscode";
import { AIClient, AIClientError, AIModelInfo } from "../services/analysis/AIClient";

export async function selectModelCommand(): Promise<void> {
  // ── Read API key ───────────────────────────────────────────────
  const config = vscode.workspace.getConfiguration("sbatlas");
  const apiKey = config.get<string>("googleApiKey") ?? "";

  if (!apiKey.trim()) {
    vscode.window.showErrorMessage(
      "SBAtlas: No Google AI API key configured. " +
        "Go to Settings → SBAtlas → Google API Key and add your key."
    );
    return;
  }

  // ── Fetch models ───────────────────────────────────────────────
  let models: AIModelInfo[];

  try {
    const client = new AIClient();
    models = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "SBAtlas: Fetching available models...",
        cancellable: false,
      },
      async () => {
        return client.listModels(apiKey.trim());
      }
    );
  } catch (error) {
    if (error instanceof AIClientError) {
      vscode.window.showErrorMessage(`SBAtlas: ${error.message}`);
    } else {
      vscode.window.showErrorMessage(
        `SBAtlas: Failed to fetch models. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return;
  }

  if (models.length === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: No models supporting content generation were found."
    );
    return;
  }

  // ── Show QuickPick ─────────────────────────────────────────────
  const currentModel =
    config.get<string>("googleModel") ?? "gemini-2.0-flash";

  interface ModelQuickPickItem extends vscode.QuickPickItem {
    modelId: string;
  }

  const items: ModelQuickPickItem[] = models.map((m) => ({
    label:
      m.id === currentModel
        ? `$(check)  ${m.displayName}`
        : `       ${m.displayName}`,
    description: m.id,
    detail: m.description.length > 120
      ? m.description.slice(0, 120).trimEnd() + "…"
      : m.description,
    modelId: m.id,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: "SBAtlas — Select AI Model",
    placeHolder: `Current: ${currentModel}  |  ${models.length} models available`,
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!selected) {
    return;
  }

  // ── Save to settings ───────────────────────────────────────────
  await config.update(
    "googleModel",
    selected.modelId,
    vscode.ConfigurationTarget.Global
  );

  vscode.window.showInformationMessage(
    `SBAtlas: Model changed to "${selected.modelId}".`
  );
}