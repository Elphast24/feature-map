// src/lifecycle/ExtensionLifecycle.ts

import * as vscode from "vscode";
import { WorkspaceStorage } from "../services/storage/workspaceStorage";
import { ProjectService } from "../services/project/projectService";
import { ValidationService } from "../services/validation/validationService";
import { SidebarProvider } from "../views/sidebar/sidebarProvider";
import { SBAtlasStatusBarItem } from "../views/statusbar/statusBarItem";
import { registerCommands } from "../commands/index";
import { readAIConfig } from "../services/analysis/readAIConfig";
import { AnalysisService } from "../services/analysis/analysisService";

export class ExtensionLifecycle {
  // Services
  private storage!: WorkspaceStorage;
  private validator!: ValidationService;
  private service!: ProjectService;
  private analysisService!: AnalysisService; 

  // Views
  private sidebar!: SidebarProvider;
  private statusBar!: SBAtlasStatusBarItem;

  // VS Code tree view handle
  private treeView!: vscode.TreeView<vscode.TreeItem>;

  async activate(context: vscode.ExtensionContext): Promise<void> {
    console.log("[SBAtlas] Activating...");

    try {
      this.buildServices(context);
      await this.loadInitialData();
      this.buildViews(context);
      this.wireEvents(context);
      this.registerCommandsAndDisposables(context);

      console.log("[SBAtlas] Activated successfully.");
    } catch (error) {
      console.error("[SBAtlas] Activation failed:", error);

      vscode.window.showErrorMessage(
        `SBAtlas failed to activate: ${
          error instanceof Error ? error.message : String(error)
        }. Please reload the window.`
      );
    }
  }

  deactivate(): void {
    console.log("[SBAtlas] Deactivated.");
  }

  // ─────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────

  getService(): ProjectService {
    return this.service;
  }

  getAnalysisService(): AnalysisService {   // ← added
    return this.analysisService;
  }

  getSidebar(): SidebarProvider {
    return this.sidebar;
  }

  // ─────────────────────────────────────────
  // Private build steps
  // ─────────────────────────────────────────

  private buildServices(context: vscode.ExtensionContext): void {
    this.storage = new WorkspaceStorage(context.workspaceState);
    this.validator = new ValidationService();
    this.service = new ProjectService(this.storage, this.validator);

    // AnalysisService receives readAIConfig so it never imports vscode itself
    this.analysisService = new AnalysisService(
      undefined,
      undefined,
      undefined,
      readAIConfig
    );

    console.log("[SBAtlas] Services built.");
  }

  private async loadInitialData(): Promise<void> {
    const result = await this.service.loadProject();

    if (result.ok && result.data) {
      console.log(
        `[SBAtlas] Loaded project: "${result.data.name}" ` +
          `(${result.data.requirementCount()} requirements)`
      );
    } else {
      console.log("[SBAtlas] No existing project in this workspace.");
    }
  }

  private buildViews(context: vscode.ExtensionContext): void {
    this.sidebar = new SidebarProvider(this.service);

    this.treeView = vscode.window.createTreeView("sbatlasProjectView", {
      treeDataProvider: this.sidebar,
      showCollapseAll: true,
    });

    context.subscriptions.push(this.treeView);

    this.statusBar = new SBAtlasStatusBarItem();
    this.statusBar.update(this.service.getProject());

    console.log("[SBAtlas] Views built.");
  }

  private wireEvents(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      this.service.onDidChangeProject(() => {
        this.sidebar.refresh();
      })
    );

    context.subscriptions.push(
      this.service.onDidChangeProject((project) => {
        this.statusBar.update(project);
      })
    );

    context.subscriptions.push({
      dispose: () => this.service.dispose(),
    });

    context.subscriptions.push({
      dispose: () => this.statusBar.dispose(),
    });

    console.log("[SBAtlas] Events wired.");
  }

  private registerCommandsAndDisposables(
    context: vscode.ExtensionContext
  ): void {
    // Pass analysisService to registerCommands so the generate
    // roadmap command can use it in Milestone 4
    registerCommands(context, this.service, this.analysisService);
    console.log("[SBAtlas] Commands registered.");
  }
}