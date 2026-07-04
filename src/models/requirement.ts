export type RequirementSource = "manual" | "pasted" | "imported";

export interface IRequirement {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;

  source: RequirementSource;
}

export class Requirement implements IRequirement {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  source: RequirementSource;

  constructor(
    id: string,
    content: string,
    source: RequirementSource = "manual"
  ) {
    this.id = id;
    this.content = content;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.source = source;
  }

  updateContent(newContent: string): void {
    this.content = newContent;
    this.updatedAt = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      content: this.content,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      source: this.source,
    };
  }

  static fromJSON(data: Record<string, unknown>): Requirement {
    const req = new Requirement(
      data.id as string,
      data.content as string,
      data.source as RequirementSource
    );

    // Restore the original timestamps rather than using new Date()
    req.createdAt = new Date(data.createdAt as string);
    req.updatedAt = new Date(data.updatedAt as string);

    return req;
  }
}