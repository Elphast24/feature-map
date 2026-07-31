export interface ParsedRequirementLine {
  content: string;
  lineNumber: number;
}

/**
 * Parses a block of text into individual requirement lines.
 *
 * Splitting rules:
 *   1. Split on newlines
 *   2. Strip markdown list markers (-, *, •, numbered lists)
 *   3. Strip checkbox markers ([ ], [x])
 *   4. Strip leading/trailing whitespace
 *   5. Skip empty lines
 *   6. Skip lines that look like headings (# Heading)
 *   7. Skip lines that look like comments (// or <!-- -->)
 *   8. Merge lines that are continuations (don't start with a marker)
 *
 * Supported formats:
 *   - Plain text (one requirement per line)
 *   - Markdown lists (- item, * item, 1. item)
 *   - Checkbox lists (- [ ] item, - [x] item)
 *   - Numbered lists (1. item, 2) item)
 */
export function parseRequirementBlock(
  text: string
): ParsedRequirementLine[] {
  const lines = text.split(/\r?\n/);
  const results: ParsedRequirementLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip empty lines
    if (line.trim().length === 0) {
      continue;
    }

    // Skip headings
    if (/^\s*#{1,6}\s/.test(line)) {
      continue;
    }

    // Skip HTML comments
    if (/^\s*<!--/.test(line)) {
      continue;
    }

    // Skip code fences
    if (/^\s*```/.test(line)) {
      continue;
    }

    // Skip lines that are just separators
    if (/^\s*[-=_]{3,}\s*$/.test(line)) {
      continue;
    }

    // Strip markdown list markers
    //   - item, * item, • item
    //   1. item, 1) item, 1- item
    //   - [ ] item, - [x] item
    line = line
      .replace(/^\s*[-*•]\s*\[[ xX]\]\s*/, "")   // checkbox
      .replace(/^\s*[-*•]\s+/, "")                  // bullet
      .replace(/^\s*\d+[.):-]\s+/, "")              // numbered
      .trim();

    // Skip if nothing left after stripping
    if (line.length === 0) {
      continue;
    }

    // Skip very short lines (likely not requirements)
    if (line.length < 5) {
      continue;
    }

    results.push({
      content: line,
      lineNumber: i + 1,
    });
  }

  return results;
}

export function deduplicateRequirements(
  parsed: ParsedRequirementLine[],
  existingContents: string[]
): ParsedRequirementLine[] {
  const existingLower = existingContents.map((c) =>
    c.trim().toLowerCase()
  );

  return parsed.filter(
    (line) =>
      !existingLower.includes(line.content.trim().toLowerCase())
  );
}