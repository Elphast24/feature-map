import * as vscode from "vscode";
import { WorkspaceSettings } from "../../models/workspaceSetting";
import { FileStorage } from "../storage/fileStorage";
import { ServiceResult } from "../project/projectService";

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(error: string): ServiceResult<T> => ({
  ok: false,
  error,
});


export class SettingsService {
  private readonly storage: FileStorage;
  private currentSettings: WorkspaceSettings;

  private readonly _onDidChangeSettings =
    new vscode.EventEmitter<WorkspaceSettings>();

  readonly onDidChangeSettings = this._onDidChangeSettings.event;

  constructor(storage: FileStorage) {
    this.storage = storage;
    this.currentSettings = new WorkspaceSettings();
  }

  dispose(): void {
    this._onDidChangeSettings.dispose();
  }

  // Load and save
  async loadSettings(): Promise<ServiceResult<WorkspaceSettings>> {
    const settings = await this.storage.loadSettings();
    this.currentSettings = settings;
    return ok(settings);
  }

  getSettings(): WorkspaceSettings {
    return this.currentSettings;
  }

  async saveSettings(): Promise<ServiceResult<void>> {
    await this.storage.saveSettings(this.currentSettings);
    return ok(undefined);
  }

  // Individual setting updates
  async updateSetting<K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K]
  ): Promise<ServiceResult<WorkspaceSettings>> {
    const validation = this.validateSetting(key, value);
    if (!validation.ok) {
      return fail(validation.error);
    }

    (this.currentSettings as any)[key] = value;

    await this.storage.saveSettings(this.currentSettings);

    this._onDidChangeSettings.fire(this.currentSettings);

    return ok(this.currentSettings);
  }

  async resetSettings(): Promise<ServiceResult<WorkspaceSettings>> {
    this.currentSettings = new WorkspaceSettings();

    await this.storage.saveSettings(this.currentSettings);

    this._onDidChangeSettings.fire(this.currentSettings);

    return ok(this.currentSettings);
  }

  // Validation
  private validateSetting<K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K]
  ): ServiceResult<true> {
    switch (key) {
      case "defaultAuthor":
        if (typeof value === "string" && value.length > 100) {
          return fail("Default author cannot exceed 100 characters.");
        }
        break;

      case "maxTokens":
        if (typeof value === "number") {
          if (value < 0) {
            return fail("Max tokens cannot be negative.");
          }
          if (value > 32000) {
            return fail("Max tokens cannot exceed 32,000.");
          }
        }
        break;

      case "preferredModel":
        if (typeof value === "string" && value.length > 100) {
          return fail("Model name cannot exceed 100 characters.");
        }
        break;
    }

    return ok(true as any);
  }

  // Effective values
  getEffectiveModel(): string {
    if (this.currentSettings.preferredModel.trim().length > 0) {
      return this.currentSettings.preferredModel.trim();
    }

    const vsCodeConfig =
      vscode.workspace.getConfiguration("sbatlas");
    return vsCodeConfig.get<string>("googleModel") ?? "gemini-2.0-flash";
  }

  getEffectiveMaxTokens(): number {
    if (this.currentSettings.maxTokens > 0) {
      return this.currentSettings.maxTokens;
    }

    const vsCodeConfig =
      vscode.workspace.getConfiguration("sbatlas");
    return vsCodeConfig.get<number>("maxTokens") ?? 4096;
  }
}