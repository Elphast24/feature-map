export type SBAtlasTheme = "system" | "light" | "dark";

export type AIProvider = "openai" | "anthropic";

export interface IProjectSettings {
  analysisEnabled: boolean;
  autoSave: boolean;
  theme: SBAtlasTheme;
  aiProvider: AIProvider;
  aiModel: string;
  aiMaxTokens: number;
}

export class ProjectSettings implements IProjectSettings {
  analysisEnabled: boolean;
  autoSave: boolean;
  theme: SBAtlasTheme;
  aiProvider: AIProvider;
  aiModel: string;
  aiMaxTokens: number;

  constructor(partial: Partial<IProjectSettings> = {}) {
    this.analysisEnabled = partial.analysisEnabled ?? true;
    this.autoSave = partial.autoSave ?? true;
    this.theme = partial.theme ?? "system";
    this.aiProvider = partial.aiProvider ?? "openai";
    this.aiModel = partial.aiModel ?? "gpt-4o-mini";
    this.aiMaxTokens = partial.aiMaxTokens ?? 4096;
  }

  toJSON(): Record<string, unknown> {
    return {
      analysisEnabled: this.analysisEnabled,
      autoSave: this.autoSave,
      theme: this.theme,
      aiProvider: this.aiProvider,
      aiModel: this.aiModel,
      aiMaxTokens: this.aiMaxTokens,
    };
  }

  static fromJSON(data: Record<string, unknown>): ProjectSettings {
    return new ProjectSettings({
      analysisEnabled: data.analysisEnabled as boolean,
      autoSave: data.autoSave as boolean,
      theme: data.theme as SBAtlasTheme,
      aiProvider: (data.aiProvider as AIProvider) ?? "openai",
      aiModel: (data.aiModel as string) ?? "gpt-4o-mini",
      aiMaxTokens: (data.aiMaxTokens as number) ?? 4096,
    });
  }
}