import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { Requirement } from "../models/requirement";

export async function tagRequirementCommand(
  service: ProjectService,
  requirementId?: string
): Promise<void> {
  const project = service.getProject();

  if (!project || project.requirementCount() === 0) {
    vscode.window.showWarningMessage(
      "SBAtlas: No requirements to tag."
    );
    return;
  }

  //  Resolve target 
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
        label: `${i + 1}. ${truncate(req.content, 55)}`,
        description:
          req.tags.length > 0 ? req.tags.join(", ") : "no tags",
        requirement: req,
      })
    );

    const selected = await vscode.window.showQuickPick(items, {
      title: "SBAtlas — Tag Requirement",
      placeHolder: "Select a requirement to tag",
    });

    if (!selected) {
      return;
    }

    target = selected.requirement;
  }

  //  Choose action
  const actions = ["Add Tag"];

  if (target.tags.length > 0) {
    actions.push("Remove Tag");
  }

  const action = await vscode.window.showQuickPick(actions, {
    title: `SBAtlas — Tags for "${truncate(target.content, 40)}"`,
    placeHolder:
      target.tags.length > 0
        ? `Current tags: ${target.tags.join(", ")}`
        : "No tags yet",
  });

  if (!action) {
    return;
  }

  if (action === "Add Tag") {
    const tag = await vscode.window.showInputBox({
      title: "SBAtlas — Add Tag",
      prompt: "Enter a tag",
      placeHolder: "e.g. auth, backend, mvp, sprint-1",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Tag cannot be empty.";
        }
        if (value.trim().length > 30) {
          return "Tag cannot exceed 30 characters.";
        }
        if (target!.tags.includes(value.trim().toLowerCase())) {
          return "This tag already exists on this requirement.";
        }
        return null;
      },
    });

    if (tag === undefined) {
      return;
    }

    const result = await service.addRequirementTag(target.id, tag);

    if (result.ok) {
      vscode.window.showInformationMessage(
        `SBAtlas: Tag "${tag.trim()}" added.`
      );
    } else {
      vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
    }
  } else {
    // Remove tag
    const tagToRemove = await vscode.window.showQuickPick(
      target.tags.map((t) => ({ label: t })),
      {
        title: "SBAtlas — Remove Tag",
        placeHolder: "Select a tag to remove",
      }
    );

    if (!tagToRemove) {
      return;
    }

    const result = await service.removeRequirementTag(
      target.id,
      tagToRemove.label
    );

    if (result.ok) {
      vscode.window.showInformationMessage(
        `SBAtlas: Tag "${tagToRemove.label}" removed.`
      );
    } else {
      vscode.window.showErrorMessage(`SBAtlas: ${result.error}`);
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}