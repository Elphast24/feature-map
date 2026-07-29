import * as vscode from "vscode";
import { FileStorage } from "../services/storage/fileStorage";
import { WorkspaceStorage } from "../services/storage/workspaceStorage";
import { StorageMigration } from "../services/storage/storageMigration";
import { ProjectService } from "../services/project/projectService";
import { ValidationService } from "../services/validation/validationService";
import { SidebarProvider } from "../views/sidebar/sidebarProvider";
import { SBAtlasStatusBarItem } from "../views/statusbar/statusBarItem";
import { registerCommands } from "../commands/index";
import { readAIConfig } from "../services/analysis/readAIConfig";
import { AnalysisService } from "../services/analysis/analysisService";
import { RoadmapService } from "../services/roadmap/roadmapService";

export class ExtensionLifecycle {
  private storage!: FileStorage;
  private validator!: ValidationService;
  private service!: ProjectService;
  private analysisService!: AnalysisService;
  private roadmapService!: RoadmapService;
  private sidebar!: SidebarProvider;
  private statusBar!: SBAtlasStatusBarItem;
  private treeView!: vscode.TreeView<vscode.TreeItem>;

  async activate(context: vscode.ExtensionContext): Promise<void> {
    console.log("[SBAtlas] Activating...");

    try {
      await this.buildServices(context);
      await this.runMigration(context);
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

  getService(): ProjectService {
    return this.service;
  }

  getAnalysisService(): AnalysisService {
    return this.analysisService;
  }

  getRoadmapService(): RoadmapService {
    return this.roadmapService;
  }

  getSidebar(): SidebarProvider {
    return this.sidebar;
  }

  // Private build steps
  private async buildServices(
    context: vscode.ExtensionContext
  ): Promise<void> {
    // Resolve the workspace root
    const workspaceRoot = this.getWorkspaceRoot();

    if (!workspaceRoot) {
      throw new Error(
        "SBAtlas requires an open workspace folder. " +
          "Open a folder (File → Open Folder) and try again."
      );
    }

    // File storage is the primary storage backend
    this.storage = new FileStorage(workspaceRoot);
    this.validator = new ValidationService();
    this.service = new ProjectService(this.storage, this.validator);

    this.analysisService = new AnalysisService(
      undefined,
      undefined,
      undefined,
      readAIConfig
    );

    this.roadmapService = new RoadmapService(
      this.storage,
      this.analysisService,
      this.service
    );

    console.log("[SBAtlas] Services built.");
    console.log(
      `[SBAtlas] Storage location: ${this.storage.getStorageDir().fsPath}`
    );
  }

  /**
   * Runs the one-time Memento → file migration.
   * Shows a notification if data was migrated.
   * Shows a warning if migration encountered problems.
   */
    private async runMigration(
    context: vscode.ExtensionContext
  ): Promise<void> {
    const mementoStorage = new WorkspaceStorage(context.workspaceState);
    const workspaceRoot = this.getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    const migration = new StorageMigration(
      this.storage,
      mementoStorage,
      workspaceRoot
    );

    const result = await migration.migrate();

    if (result.migrated) {
      vscode.window.showInformationMessage(
        `SBAtlas: Data migrated to .vscode/sbatlas/. ` +
          `Migrated: ${result.migratedItems.join(", ")}.`
      );
    }

    if (result.warnings.length > 0) {
      vscode.window.showWarningMessage(
        `SBAtlas: Migration warnings: ${result.warnings.join(" | ")}`
      );
    }
  }

  private async loadInitialData(): Promise<void> {
    const fileStorage = this.storage;

    // Load the index to find the active project
    const index = await fileStorage.loadIndex();

    if (index.activeProjectId) {
      fileStorage.setActiveProject(index.activeProjectId);

      const projectResult = await this.service.loadProject();

      if (projectResult.ok && projectResult.data) {
        console.log(
          `[SBAtlas] Loaded active project: "${projectResult.data.name}" ` +
            `(${projectResult.data.requirementCount()} requirements)`
        );
      }

      const roadmapResult = await this.roadmapService.loadRoadmap();

      if (roadmapResult.ok && roadmapResult.data) {
        console.log(
          `[SBAtlas] Loaded roadmap: ` +
            `${roadmapResult.data.phaseCount()} phases, ` +
            `${roadmapResult.data.totalTaskCount()} tasks`
        );
      }
    } else {
      console.log("[SBAtlas] No active project in this workspace.");
    }

    console.log(
      `[SBAtlas] ${index.projectCount()} project(s) in workspace.`
    );
  }

  private buildViews(context: vscode.ExtensionContext): void {
    this.sidebar = new SidebarProvider(
      this.service,
      this.roadmapService
    );

    this.treeView = vscode.window.createTreeView("sbatlasProjectView", {
      treeDataProvider: this.sidebar,
      showCollapseAll: true,
    });

    context.subscriptions.push(this.treeView);

    this.statusBar = new SBAtlasStatusBarItem();
    this.statusBar.update(
      this.service.getProject(),
      this.roadmapService.getRoadmap()
    );

    console.log("[SBAtlas] Views built.");
  }

  private wireEvents(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      this.service.onDidChangeProject(() => {
        this.sidebar.refresh();
      })
    );

    context.subscriptions.push(
      this.roadmapService.onDidChangeRoadmap(() => {
        this.sidebar.refresh();
      })
    );

    context.subscriptions.push(
      this.service.onDidChangeProject((project) => {
        this.statusBar.update(
          project,
          this.roadmapService.getRoadmap()
        );
      })
    );

    context.subscriptions.push(
      this.roadmapService.onDidChangeRoadmap((roadmap) => {
        this.statusBar.update(this.service.getProject(), roadmap);
      })
    );

    context.subscriptions.push({
      dispose: () => this.service.dispose(),
    });

    context.subscriptions.push({
      dispose: () => this.roadmapService.dispose(),
    });

    context.subscriptions.push({
      dispose: () => this.statusBar.dispose(),
    });

    console.log("[SBAtlas] Events wired.");
  }

  private registerCommandsAndDisposables(
    context: vscode.ExtensionContext
  ): void {
    registerCommands(context, this.service, this.roadmapService);
    console.log("[SBAtlas] Commands registered.");
  }

  // Helpers
  private getWorkspaceRoot(): vscode.Uri | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }
    return folders[0].uri;
  }
}