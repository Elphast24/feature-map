import * as vscode from "vscode";
import { WorkspaceStorage } from "../services/storage/workspaceStorage";
import { ProjectService } from "../services/project/projectService";
import { ValidationService } from "../services/validation/validationService";
import { SidebarProvider } from "../views/sidebar/sidebarProvider";
import { SBAtlasStatusBarItem } from "../views/statusbar/statusBarItem";
import { registerCommands } from "../commands/index";
import { readAIConfig } from "../services/analysis/readAIConfig";
import { AnalysisService } from "../services/analysis/analysisService";
import { RoadmapService } from "../services/roadmap/roadmapService";

export class ExtensionLifecycle {
  // Services
  private storage!: WorkspaceStorage;
  private validator!: ValidationService;
  private service!: ProjectService;
  private analysisService!: AnalysisService;
  private roadmapService!: RoadmapService;

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

  getAnalysisService(): AnalysisService {
    return this.analysisService;
  }

  getRoadmapService(): RoadmapService {
    return this.roadmapService;
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

    this.analysisService = new AnalysisService(
      undefined,
      undefined,
      undefined,
      readAIConfig
    );

    // RoadmapService depends on storage, analysis, and project
    this.roadmapService = new RoadmapService(
      this.storage,
      this.analysisService,
      this.service
    );

    console.log("[SBAtlas] Services built.");
  }

  private async loadInitialData(): Promise<void> {
    // Load project first
    const projectResult = await this.service.loadProject();

    if (projectResult.ok && projectResult.data) {
      console.log(
        `[SBAtlas] Loaded project: "${projectResult.data.name}" ` +
          `(${projectResult.data.requirementCount()} requirements)`
      );
    } else {
      console.log("[SBAtlas] No existing project in this workspace.");
    }

    // Then load roadmap
    const roadmapResult = await this.roadmapService.loadRoadmap();

    if (roadmapResult.ok && roadmapResult.data) {
      console.log(
        `[SBAtlas] Loaded roadmap: ` +
          `${roadmapResult.data.phaseCount()} phases, ` +
          `${roadmapResult.data.totalTaskCount()} tasks, ` +
          `${roadmapResult.data.completionPercentage()}% complete`
      );
    } else {
      console.log("[SBAtlas] No existing roadmap in this workspace.");
    }
  }

  private buildViews(context: vscode.ExtensionContext): void {
    // Sidebar now receives roadmapService too
    this.sidebar = new SidebarProvider(this.service, this.roadmapService);

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
    // Sidebar refresh on project change
    context.subscriptions.push(
      this.service.onDidChangeProject(() => {
        this.sidebar.refresh();
      })
    );

    // Sidebar refresh on roadmap change
    context.subscriptions.push(
      this.roadmapService.onDidChangeRoadmap(() => {
        this.sidebar.refresh();
      })
    );

    // Status bar refresh on project change
    context.subscriptions.push(
      this.service.onDidChangeProject((project) => {
        this.statusBar.update(project, this.roadmapService.getRoadmap());
      })
    );

    // Status bar refresh on roadmap change
    context.subscriptions.push(
      this.roadmapService.onDidChangeRoadmap((roadmap) => {
        this.statusBar.update(this.service.getProject(), roadmap);
      })
    );

    // Disposal
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
}