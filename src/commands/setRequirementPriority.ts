import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { Requirement, RequirementPriority } from "../models/requirement";

export async function setRequirementPriorityCommand(
  service: ProjectService,
  requirementId?: string
): Promise<void> {
  const project = service.getProject();

  if (!project) {
    vscode.window.showWarningMessage(
      "SBAtlas: No project found."
    );
    return;
  }

  if (project.requirementCount() === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: No requirements to set priority on."
    );
    return;
  }

  //  Resolve target requirement
  let target: Requirement | undefined;

  if (requirementId) {
    target = project.findRequirement(requirementId);
    if (!target) {
      vscode.window.showErrorMessage("SBAtlas: Requirement not found.");
      return;
    }
  } else {
    interface ReqItem extends vscode.QuickPickItem {
      requirement: Requirement;
    }

    const items: ReqItem[] = project.requirements.map(
      (req, i) => ({
        label: `${priorityIcon(req.priority)}  ${i + 1}. ${truncate(req.content, 55)}`,
        description: req.priority,
        detail: req.tags.length > 0 ? `Tags: ${req.tags.join(", ")}` : undefined,
        requirement: req,
      })
    );

    const selected = await vscode.window.showQuickPick(items, {
      title: "SBAtlas — Set Requirement Priority",
      placeHolder: "Select a requirement",
      matchOnDescription: true,
    });

    if (!selected) {
      return;
    }

    target = selected.requirement;
  }

  //  Pick priority
  interface PriorityItem extends vscode.QuickPickItem {
    priority: RequirementPriority;
  }

  const priorities: PriorityItem[] = [
    {
      label: `🔴  High${target.priority === "high" ? " (current)" : ""}`,
      description: "Critical functionality, must be addressed first",
      priority: "high",
    },
    {
      label: `🟡  Medium${target.priority === "medium" ? " (current)" : ""}`,
      description: "Important but not blocking other work",
      priority: "medium",
    },
    {
      label: `🟢  Low${target.priority === "low" ? " (current)" : ""}`,
      description: "Nice to have, can be deferred",
      priority: "low",
    },
  ];

  const selectedPriority = await vscode.window.showQuickPick(
    priorities,
    {
      title: `SBAtlas — Priority for "${truncate(target.content, 40)}"`,
      placeHolder: `Current: ${target.priority}`,
    }
  );

  if (!selectedPriority) {
    return;
  }

  const result = await service.updateRequirementPriority(
    target.id,
    selectedPriority.priority
  );

  if (result.ok) {
    vscode.window.showInformationMessage(
      `SBAtlas: Priority set to ${selectedPriority.priority}.`
    );
  } else {
    vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
  }
}

function priorityIcon(priority: RequirementPriority): string {
  const icons: Record<RequirementPriority, string> = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };
  return icons[priority];
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}