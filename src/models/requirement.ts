export type RequirementSource =
  | "manual"
  | "pasted"
  | "imported"
  | "bulk";

export type RequirementPriority = "high" | "medium" | "low";

export interface IRequirement {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  source: RequirementSource;
  priority: RequirementPriority;
  tags: string[];
}

export class Requirement implements IRequirement {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  source: RequirementSource;
  priority: RequirementPriority;
  tags: string[];

  constructor(
    id: string,
    content: string,
    source: RequirementSource = "manual",
    priority: RequirementPriority = "medium",
    tags: string[] = []
  ) {
    this.id = id;
    this.content = content;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.source = source;
    this.priority = priority;
    this.tags = tags;
  }

  updateContent(newContent: string): void {
    this.content = newContent;
    this.updatedAt = new Date();
  }

  updatePriority(priority: RequirementPriority): void {
    this.priority = priority;
    this.updatedAt = new Date();
  }

  addTag(tag: string): void {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length > 0 && !this.tags.includes(normalized)) {
      this.tags.push(normalized);
      this.updatedAt = new Date();
    }
  }

  removeTag(tag: string): void {
    const normalized = tag.trim().toLowerCase();
    const before = this.tags.length;
    this.tags = this.tags.filter((t) => t !== normalized);
    if (this.tags.length < before) {
      this.updatedAt = new Date();
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      content: this.content,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      source: this.source,
      priority: this.priority,
      tags: this.tags,
    };
  }

  static fromJSON(data: Record<string, unknown>): Requirement {
    const req = new Requirement(
      data.id as string,
      data.content as string,
      data.source as RequirementSource,
      (data.priority as RequirementPriority) ?? "medium",
      (data.tags as string[]) ?? []
    );

    req.createdAt = new Date(data.createdAt as string);
    req.updatedAt = new Date(data.updatedAt as string);

    return req;
  }
}