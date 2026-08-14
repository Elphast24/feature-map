// src/commands/searchCommand.ts

import * as vscode from "vscode";
import { ProjectService } from "../services/project/projectService";
import { RoadmapService } from "../services/roadmap/roadmapService";
import { SearchService } from "../services/search/searchService";
import { SearchResult } from "../services/search/searchTypes";


export async function searchCommand(
  projectService: ProjectService,
  roadmapService: RoadmapService,
  searchService: SearchService
): Promise<void> {
  const query = await vscode.window.showInputBox({
    title: "SBAtlas — Search",
    prompt: "Search across requirements, tasks, notes, and tags",
    placeHolder: "e.g. authentication, login, csv export",
    ignoreFocusOut: true,
  });

  if (query === undefined || query.trim().length === 0) {
    return;
  }

  const project = projectService.getProject();
  const roadmap = roadmapService.getRoadmap();

  const results = searchService.search(query, project, roadmap);

  if (results.length === 0) {
    vscode.window.showInformationMessage(
      `SBAtlas: No results found for "${query}".`
    );
    return;
  }

  // Show results in QuickPick
  interface ResultItem extends vscode.QuickPickItem {
    result: SearchResult;
  }

  const items: ResultItem[] = results.map((result) => ({
    label: `${result.type === "requirement" ? "$(list-unordered)" : "$(tasklist)"}  ${truncate(result.title, 60)}`,
    description: result.location,
    detail: `Matched in: ${result.matchedField}${
      result.task ? ` | Status: ${result.task.status}` : ""
    }${
      result.requirement
        ? ` | Priority: ${result.requirement.priority}`
        : ""
    }`,
    result,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: `SBAtlas — Search Results for "${query}"`,
    placeHolder: `${results.length} result${results.length === 1 ? "" : "s"} found`,
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!selected) {
    return;
  }

  // Navigate to the selected result
  if (selected.result.type === "requirement") {
    await vscode.commands.executeCommand(
      "sbatlas.editRequirement",
      selected.result.id
    );
  } else if (selected.result.type === "task") {
    await vscode.commands.executeCommand(
      "sbatlas.updateTaskStatus",
      selected.result.id
    );
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}