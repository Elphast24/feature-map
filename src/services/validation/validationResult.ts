export interface ValidationFailure {
  field?: string;
  message: string;
}

export class ValidationResult {
  private failures: ValidationFailure[] = [];

  addFailure(message: string, field?: string): this {
    this.failures.push({ field, message });
    return this;
  }


  get isValid(): boolean {
    return this.failures.length === 0;
  }


  get errors(): ValidationFailure[] {
    return [...this.failures];
  }


  get firstError(): string | undefined {
    return this.failures[0]?.message;
  }


  get summary(): string {
    return this.failures.map((f) => f.message).join(" | ");
  }


  static valid(): ValidationResult {
    return new ValidationResult();
  }

  static invalid(message: string, field?: string): ValidationResult {
    return new ValidationResult().addFailure(message, field);
  }
}