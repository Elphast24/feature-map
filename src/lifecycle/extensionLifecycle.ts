// src/lifecycle/ExtensionLifecycle.ts

import * as vscode from "vscode";
import { WorkspaceStorage } from "../services/storage/workspaceStorage";
import { ProjectService } from "../services/project/projectService";
import { ValidationService } from "../services/validation/validationService";
import { SidebarProvider } from "../views/sidebar/sidebarProvider";
import { SBAtlasStatusBarItem } from "../views/statusbar/statusBarItem";
import { registerCommands } from "../commands/index";

/**
 * ExtensionLifecycle owns the complete startup and teardown of SBAtlas.
 *
 * Responsibility:
 *   - Build every service and view in the correct order
 *   - Wire events so changes propagate automatically
 *   - Register all disposables so VS Code cleans up on deactivation
 *   - Handle activation errors gracefully without crashing VS Code
 *
 * Build order matters:
 *   1. Storage     — no dependencies
 *   2. Validator   — no dependencies
 *   3. Service     — depends on storage and validator
 *   4. Load data   — project must be in memory before views render
 *   5. Sidebar     — depends on service (reads getProject())
 *   6. Status bar  — depends on service (reads getProject())
 *   7. Wire events — sidebar and status bar subscribe to service events
 *   8. Commands    — depend on service (all mutations go through it)
 *
 * Design note (why a class?):
 * Unlike commands (stateless, one-shot), the lifecycle holds references
 * to every service and view so it can wire them together and dispose
 * them cleanly. A class is the right tool for stateful coordination.
 */
export class ExtensionLifecycle {
  // Services
  private storage!: WorkspaceStorage;
  private validator!: ValidationService;
  private service!: ProjectService;

  // Views
  private sidebar!: SidebarProvider;
  private statusBar!: SBAtlasStatusBarItem;

  // VS Code tree view handle (needed for dispose)
  private treeView!: vscode.TreeView<vscode.TreeItem>;

  /**
   * Activates SBAtlas.
   *
   * Called once by extension.ts when VS Code loads the extension.
   * All disposables are pushed to context.subscriptions so VS Code
   * automatically cleans them up when the workspace closes.
   */
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
      // If activation fails, we show an error but do not crash VS Code.
      // The extension will be in a degraded state — commands won't work,
      // but the user's editor still functions normally.
      console.error("[SBAtlas] Activation failed:", error);

      vscode.window.showErrorMessage(
        `SBAtlas failed to activate: ${
          error instanceof Error ? error.message : String(error)
        }. Please reload the window.`
      );
    }
  }

  /**
   * Deactivates SBAtlas.
   *
   * context.subscriptions handles most disposal automatically.
   * This method handles anything that needs explicit cleanup beyond that.
   */
  deactivate(): void {
    console.log("[SBAtlas] Deactivated.");
  }

  // ─────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────
  // Exposed so extension.ts can export them for use in tests
  // or future internal tooling. Not needed by commands.

  getService(): ProjectService {
    return this.service;
  }

  getSidebar(): SidebarProvider {
    return this.sidebar;
  }

  // ─────────────────────────────────────────
  // Private build steps
  // ─────────────────────────────────────────

  /**
   * Step 1 — Build services.
   * Services have no VS Code UI dependencies and never fail here
   * (failure happens at the storage layer, which is lazy).
   */
  private buildServices(context: vscode.ExtensionContext): void {
    this.storage = new WorkspaceStorage(context.workspaceState);
    this.validator = new ValidationService();
    this.service = new ProjectService(this.storage, this.validator);

    console.log("[SBAtlas] Services built.");
  }

  /**
   * Step 2 — Load any existing project into memory.
   *
   * We load before building views so the first render is correct.
   * Without this, the sidebar would flash the empty state and
   * then switch to the project — a visible layout jump.
   *
   * loadProject() fires onDidChangeProject internally, but no
   * subscribers exist yet at this point, so the event is harmless.
   * Views are wired in step 4 after loading is complete.
   */
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

  /**
   * Step 3 — Build views.
   *
   * Views read from service.getProject() synchronously when created.
   * Because loadInitialData() has already run, this returns the correct
   * data on the first render — no flash, no empty state blip.
   */
  private buildViews(context: vscode.ExtensionContext): void {
    // Sidebar
    this.sidebar = new SidebarProvider(this.service);

    this.treeView = vscode.window.createTreeView("sbatlasProjectView", {
      treeDataProvider: this.sidebar,
      showCollapseAll: true,
    });

    context.subscriptions.push(this.treeView);

    // Status bar
    this.statusBar = new SBAtlasStatusBarItem();
    this.statusBar.update(this.service.getProject());

    console.log("[SBAtlas] Views built.");
  }

  /**
   * Step 4 — Wire events.
   *
   * This is where automatic sidebar and status bar updates are connected.
   *
   * onDidChangeProject fires every time the service mutates project data.
   * Every subscriber registered here will run automatically — commands
   * never need to manually trigger a refresh.
   *
   * All subscriptions are pushed to context.subscriptions so VS Code
   * disposes them when the extension deactivates. This prevents the
   * subscriber callbacks from running after the views are destroyed.
   */
  private wireEvents(context: vscode.ExtensionContext): void {
    // Sidebar refresh
    context.subscriptions.push(
      this.service.onDidChangeProject(() => {
        this.sidebar.refresh();
      })
    );

    // Status bar refresh
    context.subscriptions.push(
      this.service.onDidChangeProject((project) => {
        this.statusBar.update(project);
      })
    );

    // Service emitter disposal
    context.subscriptions.push({
      dispose: () => this.service.dispose(),
    });

    // Status bar disposal
    context.subscriptions.push({
      dispose: () => this.statusBar.dispose(),
    });

    console.log("[SBAtlas] Events wired.");
  }

  /**
   * Step 5 — Register commands.
   *
   * Commands are registered last because they depend on the service
   * being fully initialised. A command firing before the service is
   * ready would hit undefined references.
   */
  private registerCommandsAndDisposables(
    context: vscode.ExtensionContext
  ): void {
    registerCommands(context, this.service);
    console.log("[SBAtlas] Commands registered.");
  }
}