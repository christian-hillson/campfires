# ADR-0004: Monorepo with npm Workspaces

## Status

Accepted

## Context

Campfires has multiple packages (shared types, server, web app, plugin) that share types and need coordinated development. Options were: separate repos, a monorepo with Nx/Turborepo, or a monorepo with npm workspaces.

## Decision

Use a single repository with npm workspaces. The `shared` package exports types consumed by `server` and `campfire-stories`. Build order is managed by explicit scripts (`build:shared` first, then dependents). No additional build orchestration tools.

## Consequences

- **Easier:** Single repo means atomic commits across packages, shared config (TypeScript, ESLint, Prettier), and simple dependency management. No versioning or publishing of internal packages. npm workspaces are built into npm with no additional dependencies.
- **Harder:** Build order must be managed manually (`build:shared` before others). No incremental build caching. As the repo grows, a build orchestrator like Turborepo may become worthwhile.
