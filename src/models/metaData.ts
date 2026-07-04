export interface IMetadata {
  createdAt: Date;
  updatedAt: Date;
  version: string;
  author?: string;
}

export class Metadata implements IMetadata {
  createdAt: Date;
  updatedAt: Date;
  version: string;
  author?: string;

  static readonly CURRENT_VERSION = "1.0.0";

  constructor(author?: string) {
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.version = Metadata.CURRENT_VERSION;
    this.author = author;
  }

  touch(): void {
    this.updatedAt = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      version: this.version,
      author: this.author,
    };
  }

  static fromJSON(data: Record<string, unknown>): Metadata {
    const meta = new Metadata(data.author as string | undefined);

    meta.createdAt = new Date(data.createdAt as string);
    meta.updatedAt = new Date(data.updatedAt as string);
    meta.version = data.version as string;

    return meta;
  }
}