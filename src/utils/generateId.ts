export function generateId(): string {
  // crypto is a built-in Node module — no install needed
  const { randomUUID } = require("crypto") as typeof import("crypto");
  return randomUUID();
}