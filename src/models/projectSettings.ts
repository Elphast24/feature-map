export type SBAtlasTheme = "system" | "light" | "dark";

export interface IProjectSettings {
  analysisEnabled: boolean;
  autoSave: boolean;
  theme: SBAtlasTheme;
}

export class ProjectSettings implements IProjectSettings {
  analysisEnabled: boolean;
  autoSave: boolean;
  theme: SBAtlasTheme;

  constructor(partial: Partial<IProjectSettings> = {}) {
    // Apply safe defaults. Every project starts with these unless overridden.
    this.analysisEnabled = partial.analysisEnabled ?? true;
    this.autoSave = partial.autoSave ?? true;
    this.theme = partial.theme ?? "system";
  }

  toJSON(): Record<string, unknown> {
    return {
      analysisEnabled: this.analysisEnabled,
      autoSave: this.autoSave,
      theme: this.theme,
    };
  }

  static fromJSON(data: Record<string, unknown>): ProjectSettings {
    return new ProjectSettings({
      analysisEnabled: data.analysisEnabled as boolean,
      autoSave: data.autoSave as boolean,
      theme: data.theme as SBAtlasTheme,
    });
  }
}