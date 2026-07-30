import * as vscode from "vscode";
import { SettingsService } from "../services/settings/settingsService";
import { WorkspaceSettings } from "../models/workspaceSetting";

/**
 * Handles the "SBAtlas: Open Settings" command.
 *
 * Shows a categorized QuickPick of all settings.
 * The user picks a setting, then enters or toggles its value.
 */
export async function openSettingsCommand(
  settingsService: SettingsService
): Promise<void> {
  const settings = settingsService.getSettings();

  type SettingDef = {
    key: keyof WorkspaceSettings;
    label: string;
    description: string;
    type: "string" | "boolean" | "number";
    category: string;
  };

  const settingDefs: SettingDef[] = [
    // General
    {
      key: "defaultAuthor",
      label: "Default Author",
      description: `Current: "${settings.defaultAuthor || "(none)"}"`,
      type: "string",
      category: "General",
    },
    {
      key: "confirmOnDelete",
      label: "Confirm on Delete",
      description: `Current: ${settings.confirmOnDelete ? "Yes" : "No"}`,
      type: "boolean",
      category: "General",
    },
    {
      key: "showWelcomeOnEmpty",
      label: "Show Welcome on Empty Workspace",
      description: `Current: ${settings.showWelcomeOnEmpty ? "Yes" : "No"}`,
      type: "boolean",
      category: "General",
    },

    // AI
    {
      key: "preferredModel",
      label: "Preferred AI Model",
      description: `Current: "${settings.preferredModel || "(use VS Code setting)"}"`,
      type: "string",
      category: "AI",
    },
    {
      key: "maxTokens",
      label: "Max Tokens",
      description: `Current: ${settings.maxTokens === 0 ? "(use VS Code setting)" : settings.maxTokens}`,
      type: "number",
      category: "AI",
    },

    // Storage
    {
      key: "autoSave",
      label: "Auto Save",
      description: `Current: ${settings.autoSave ? "Enabled" : "Disabled"}`,
      type: "boolean",
      category: "Storage",
    },

    // Sidebar
    {
      key: "autoExpandActivePhase",
      label: "Auto-Expand Active Phase",
      description: `Current: ${settings.autoExpandActivePhase ? "Yes" : "No"}`,
      type: "boolean",
      category: "Sidebar",
    },
    {
      key: "showTaskTypeLabels",
      label: "Show Task Type Labels",
      description: `Current: ${settings.showTaskTypeLabels ? "Yes" : "No"}`,
      type: "boolean",
      category: "Sidebar",
    },
    {
      key: "showModulePercentage",
      label: "Show Module Percentage",
      description: `Current: ${settings.showModulePercentage ? "Yes" : "No"}`,
      type: "boolean",
      category: "Sidebar",
    },
  ];

  // Group settings by category for display
  interface SettingQuickPickItem extends vscode.QuickPickItem {
    def?: SettingDef;
    isSeparator?: boolean;
  }

  const items: SettingQuickPickItem[] = [];
  let currentCategory = "";

  for (const def of settingDefs) {
    if (def.category !== currentCategory) {
      if (currentCategory !== "") {
        items.push({ label: "", kind: vscode.QuickPickItemKind.Separator } as any);
      }
      items.push({
        label: def.category,
        kind: vscode.QuickPickItemKind.Separator,
      } as any);
      currentCategory = def.category;
    }

    items.push({
      label: def.label,
      description: def.description,
      def,
    });
  }

  // Add reset option at the bottom
  items.push({ label: "", kind: vscode.QuickPickItemKind.Separator } as any);
  items.push({
    label: "$(discard)  Reset All Settings to Defaults",
    description: "Restore all settings to their default values",
  });

  const selected = await vscode.window.showQuickPick(items, {
    title: "SBAtlas — Settings",
    placeHolder: "Select a setting to change",
    matchOnDescription: true,
  });

  if (!selected) {
    return;
  }

  // Handle reset
  if (!selected.def) {
    if ((selected as any).label?.includes("Reset")) {
      await handleReset(settingsService);
    }
    return;
  }

  const def = selected.def;

  // Handle each type
  if (def.type === "boolean") {
    await handleBoolean(settingsService, def.key, settings);
  } else if (def.type === "string") {
    await handleString(settingsService, def.key, settings, def.label);
  } else if (def.type === "number") {
    await handleNumber(settingsService, def.key, settings, def.label);
  }
}

// Setting type handlers

async function handleBoolean(
  service: SettingsService,
  key: keyof WorkspaceSettings,
  settings: WorkspaceSettings
): Promise<void> {
  const current = settings[key] as boolean;

  const options = [
    {
      label: `$(check)  ${current ? "Yes (current)" : "Yes"}`,
      value: true,
    },
    {
      label: `${!current ? "$(check)  " : "       "}No${!current ? " (current)" : ""}`,
      value: false,
    },
  ];

  const selected = await vscode.window.showQuickPick(
    options.map((o) => ({ label: o.label, value: o.value })),
    { title: `SBAtlas Settings — ${key}` }
  );

  if (!selected) {
    return;
  }

  const result = await service.updateSetting(
    key,
    (selected as any).value as any
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: ${key} set to ${(selected as any).value}.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

async function handleString(
  service: SettingsService,
  key: keyof WorkspaceSettings,
  settings: WorkspaceSettings,
  label: string
): Promise<void> {
  const current = settings[key] as string;

  const value = await vscode.window.showInputBox({
    title: `SBAtlas Settings — ${label}`,
    prompt: `Enter a value (leave empty to clear)`,
    value: current,
    ignoreFocusOut: true,
  });

  if (value === undefined) {
    return;
  }

  const result = await service.updateSetting(key, value as any);

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: ${label} updated.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

async function handleNumber(
  service: SettingsService,
  key: keyof WorkspaceSettings,
  settings: WorkspaceSettings,
  label: string
): Promise<void> {
  const current = settings[key] as number;

  const value = await vscode.window.showInputBox({
    title: `SBAtlas Settings — ${label}`,
    prompt: `Enter a number (0 to use VS Code global setting)`,
    value: String(current),
    ignoreFocusOut: true,
    validateInput: (v) => {
      const n = Number(v);
      if (isNaN(n)) {
        return "Please enter a valid number.";
      }
      if (n < 0) {
        return "Value cannot be negative.";
      }
      return null;
    },
  });

  if (value === undefined) {
    return;
  }

  const result = await service.updateSetting(
    key,
    Number(value) as any
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: ${label} set to ${value}.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

async function handleReset(
  service: SettingsService
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    "Reset all SBAtlas settings to defaults? This cannot be undone.",
    { modal: true },
    "Reset Settings"
  );

  if (confirm !== "Reset Settings") {
    return;
  }

  const result = await service.resetSettings();

  if (result.ok) {
    vscode.window.showInformationMessage(
      "SBAtlas: All settings reset to defaults."
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}