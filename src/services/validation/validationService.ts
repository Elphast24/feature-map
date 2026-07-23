import { Project } from "../../models/project";
import { ValidationResult } from "./validationResult";

const Limits = {
  name: {
    min: 1,
    max: 100,
  },
  description: {
    max: 500,
  },
  requirement: {
    min: 1,
    max: 2000,
  },
  author: {
    max: 100,
  },
} as const;

export class ValidationService {
 
  validateProjectName(name: string): ValidationResult {
    const trimmed = name?.trim() ?? "";

    if (trimmed.length < Limits.name.min) {
      return ValidationResult.invalid(
        "Project name is required.",
        "name"
      );
    }

    if (trimmed.length > Limits.name.max) {
      return ValidationResult.invalid(
        `Project name cannot exceed ${Limits.name.max} characters.`,
        "name"
      );
    }

    return ValidationResult.valid();
  }

  validateProjectDescription(description: string): ValidationResult {
    if (description.length > Limits.description.max) {
      return ValidationResult.invalid(
        `Description cannot exceed ${Limits.description.max} characters.`,
        "description"
      );
    }

    return ValidationResult.valid();
  }

  validateAuthor(author: string): ValidationResult {
    if (author.trim().length > Limits.author.max) {
      return ValidationResult.invalid(
        `Author name cannot exceed ${Limits.author.max} characters.`,
        "author"
      );
    }

    return ValidationResult.valid();
  }

  validateRename(newName: string, currentName: string): ValidationResult {
    // First apply the standard name rules
    const nameResult = this.validateProjectName(newName);
    if (!nameResult.isValid) {
      return nameResult;
    }

    // Then apply the rename-specific rule
    if (newName.trim() === currentName) {
      return ValidationResult.invalid(
        "The new name is the same as the current name.",
        "name"
      );
    }

    return ValidationResult.valid();
  }

  validateCreateProject(input: {
    name: string;
    description?: string;
    author?: string;
  }): ValidationResult {
    const result = new ValidationResult();

    // Name
    const nameResult = this.validateProjectName(input.name);
    if (!nameResult.isValid) {
      nameResult.errors.forEach((e) =>
        result.addFailure(e.message, e.field)
      );
    }

    // Description (only validate if provided)
    if (input.description !== undefined) {
      const descResult = this.validateProjectDescription(input.description);
      if (!descResult.isValid) {
        descResult.errors.forEach((e) =>
          result.addFailure(e.message, e.field)
        );
      }
    }

    // Author (only validate if provided)
    if (input.author !== undefined) {
      const authorResult = this.validateAuthor(input.author);
      if (!authorResult.isValid) {
        authorResult.errors.forEach((e) =>
          result.addFailure(e.message, e.field)
        );
      }
    }

    return result;
  }

  validateRequirementContent(content: string): ValidationResult {
    const trimmed = content?.trim() ?? "";

    if (trimmed.length < Limits.requirement.min) {
      return ValidationResult.invalid(
        "Requirement content cannot be empty.",
        "content"
      );
    }

    if (trimmed.length > Limits.requirement.max) {
      return ValidationResult.invalid(
        `Requirement content cannot exceed ${Limits.requirement.max} characters.`,
        "content"
      );
    }

    return ValidationResult.valid();
  }


  validateNoDuplicateRequirement(
    content: string,
    existingContents: string[]
  ): ValidationResult {
    const trimmedLower = content.trim().toLowerCase();

    const isDuplicate = existingContents.some(
      (existing) => existing.trim().toLowerCase() === trimmedLower
    );

    if (isDuplicate) {
      return ValidationResult.invalid(
        "A requirement with identical content already exists.",
        "content"
      );
    }

    return ValidationResult.valid();
  }


  validateAddRequirement(
    content: string,
    existingContents: string[]
  ): ValidationResult {
    const result = new ValidationResult();

    // Content rules
    const contentResult = this.validateRequirementContent(content);
    if (!contentResult.isValid) {
      contentResult.errors.forEach((e) =>
        result.addFailure(e.message, e.field)
      );
      // If content itself is invalid, skip duplicate check —
      // an empty string would always appear to be a duplicate of nothing.
      return result;
    }

    // Duplicate check
    const duplicateResult = this.validateNoDuplicateRequirement(
      content,
      existingContents
    );
    if (!duplicateResult.isValid) {
      duplicateResult.errors.forEach((e) =>
        result.addFailure(e.message, e.field)
      );
    }

    return result;
  }

  /**
   * @param requirementId   - ID of the requirement being edited
   * @param newContent      - The proposed new content
   * @param existingRequirements - All current requirements as {id, content} pairs
   */

validateEditRequirement(
    requirementId: string,
    newContent: string,
    existingRequirements: { id: string; content: string }[]
  ): ValidationResult {
    const result = new ValidationResult();

    // Content rules
    const contentResult = this.validateRequirementContent(newContent);
    if (!contentResult.isValid) {
      contentResult.errors.forEach((e) =>
        result.addFailure(e.message, e.field)
      );
      return result;
    }

    // Duplicate check — exclude the requirement being edited
    const otherContents = existingRequirements
      .filter((r) => r.id !== requirementId)
      .map((r) => r.content);

    const duplicateResult = this.validateNoDuplicateRequirement(
      newContent,
      otherContents
    );
    if (!duplicateResult.isValid) {
      duplicateResult.errors.forEach((e) =>
        result.addFailure(e.message, e.field)
      );
    }

    return result;
  }

  validateId(id: string, entityName: string = "entity"): ValidationResult {
    if (!id || id.trim().length === 0) {
      return ValidationResult.invalid(
        `${entityName} ID cannot be empty.`,
        "id"
      );
    }

    return ValidationResult.valid();
  }
}