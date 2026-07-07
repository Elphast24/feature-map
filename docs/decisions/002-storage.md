<!-- docs/decisions/0002-storage.md -->

# ADR 0002 — Storage Backend Selection

## Status
Accepted

## Context
SBAtlas needs to persist projects across VS Code restarts. Options:

1. VS Code workspaceState (Memento)
2. VS Code globalState (Memento)
3. JSON file in the workspace .vscode/ folder
4. SQLite via a native Node module
5. External API / cloud storage

## Decision
Use workspaceState (Memento) for Phase 1.

## Reasons
- Zero setup: no file paths, no I/O code, no permissions
- Automatically scoped to the workspace
- VS Code manages persistence and cleanup
- Survives restarts without any extra work
- Can be fully mocked with a simple object for testing

## Consequences
- Data is opaque (not human-readable as a file would be)
- No easy way to share a project between machines in Phase 1
- Memento has undocumented size limits (generally safe up to ~1MB)

## Alternatives Deferred
- JSON file: better for portability and git-tracking. Revisit in Phase 3.
- globalState: needed later for "recent projects" across workspaces.
- Cloud: out of scope until multi-device sync is a stated requirement.

## Interface Design
StorageService is an interface. WorkspaceStorage is one implementation.
This means swapping to a file backend in Phase 3 requires zero changes
to ProjectService or any commands.