export interface IWorkspaceSettings {
  // General
  defaultAuthor: string;
  confirmOnDelete: boolean;
  showWelcomeOnEmpty: boolean;
  preferredModel: string;
  maxTokens: number;
  autoSave: boolean;
  enableBackups: boolean;
  autoExpandActivePhase: boolean;
  showTaskTypeLabels: boolean;
  showModulePercentage: boolean;
  version: string;
}


export class WorkspaceSettings implements IWorkspaceSettings {
  defaultAuthor: string;
  confirmOnDelete: boolean;
  showWelcomeOnEmpty: boolean;
  preferredModel: string;
  maxTokens: number;
  autoSave: boolean;
  enableBackups: boolean;
  autoExpandActivePhase: boolean;
  showTaskTypeLabels: boolean;
  showModulePercentage: boolean;
  version: string;

  static readonly CURRENT_VERSION = "1.0.0";

  constructor(partial: Partial<IWorkspaceSettings> = {}) {
    this.defaultAuthor = partial.defaultAuthor ?? "";
    this.confirmOnDelete = partial.confirmOnDelete ?? true;
    this.showWelcomeOnEmpty = partial.showWelcomeOnEmpty ?? true;
    this.preferredModel = partial.preferredModel ?? "";
    this.maxTokens = partial.maxTokens ?? 0;
    this.autoSave = partial.autoSave ?? true;
    this.enableBackups = partial.enableBackups ?? false;
    this.autoExpandActivePhase = partial.autoExpandActivePhase ?? true;
    this.showTaskTypeLabels = partial.showTaskTypeLabels ?? true;
    this.showModulePercentage = partial.showModulePercentage ?? true;
    this.version = partial.version ?? WorkspaceSettings.CURRENT_VERSION;
  }

  toJSON(): Record<string, unknown> {
    return {
      defaultAuthor: this.defaultAuthor,
      confirmOnDelete: this.confirmOnDelete,
      showWelcomeOnEmpty: this.showWelcomeOnEmpty,
      preferredModel: this.preferredModel,
      maxTokens: this.maxTokens,
      autoSave: this.autoSave,
      enableBackups: this.enableBackups,
      autoExpandActivePhase: this.autoExpandActivePhase,
      showTaskTypeLabels: this.showTaskTypeLabels,
      showModulePercentage: this.showModulePercentage,
      version: this.version,
    };
  }

  static fromJSON(
    data: Record<string, unknown>
  ): WorkspaceSettings {
    return new WorkspaceSettings({
      defaultAuthor: (data.defaultAuthor as string) ?? "",
      confirmOnDelete: (data.confirmOnDelete as boolean) ?? true,
      showWelcomeOnEmpty:
        (data.showWelcomeOnEmpty as boolean) ?? true,
      preferredModel: (data.preferredModel as string) ?? "",
      maxTokens: (data.maxTokens as number) ?? 0,
      autoSave: (data.autoSave as boolean) ?? true,
      enableBackups: (data.enableBackups as boolean) ?? false,
      autoExpandActivePhase:
        (data.autoExpandActivePhase as boolean) ?? true,
      showTaskTypeLabels:
        (data.showTaskTypeLabels as boolean) ?? true,
      showModulePercentage:
        (data.showModulePercentage as boolean) ?? true,
      version:
        (data.version as string) ?? WorkspaceSettings.CURRENT_VERSION,
    });
  }
}