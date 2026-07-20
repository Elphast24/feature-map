import * as vscode from "vscode";
import { ExtensionLifecycle } from "./lifecycle/extensionLifecycle";

/**
 * The lifecycle instance is module-level so deactivate() can call it.
 * It is also exported so tests can access services directly if needed.
 */
export const lifecycle = new ExtensionLifecycle();

export function activate(context: vscode.ExtensionContext): Promise<void> {
  return lifecycle.activate(context);
}

export function deactivate(): void {
  lifecycle.deactivate();
}