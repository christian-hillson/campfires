# Proposal: Repository Restructure

**Author:** Natasha Najdovski
**Date:** 2026-02-17
**Status:** Proposed

---

## Summary

As Campfires grows, the repo needs a clearer separation between source code, active product work, stable documentation, business context, and archived material. This proposal lays out a new directory structure, a file-by-file migration plan, and the rationale behind each change.

No documents are deleted. Everything is relocated. Binary assets (`.mov`, `.pdf`) are the only items proposed for externalization, and even those are preserved — just hosted outside git.

---

## Problems With the Current Structure

### 1. `active-product-development-context/` is a catch-all

This single folder contains fundamentally different types of content with no way to distinguish them:

| What's in there                                                 | Type                                |
| --------------------------------------------------------------- | ----------------------------------- |
| `campfires-build-spec-v3.md`                                    | Technical architecture spec         |
| `sprint-12-sparks.md`, `sprint-13-campfire-lifecycle-prompt.md` | Sprint-scoped task context          |
| `app-future-state-sketch-2026-02-08.md`                         | Product vision                      |
| `campfire-watch-vision.html`                                    | Deprecated product vision (CLI era) |
| `infrastructure-diagrams-2026-02-08.md`                         | Architecture reference              |
| `map-enhancement-pass1.md`, `map-enhancement-pass2.md`          | Active feature specs                |
| `campfires-map-mockup.html`                                     | UI prototype/mockup                 |
| `.png`, `.mov` files                                            | Demo screenshots and video          |
| `.pdf`                                                          | Saved external article              |

There's no way to tell what's current vs. stale, what's a spec vs. a brainstorm, or what's for devs vs. stakeholders.

### 2. Archived code sits alongside active packages

`extension/` and `cli/` are described as archived in CLAUDE.md and CONTRIBUTING.md, but they live at the same directory level as `server/` and `shared/`. Someone cloning the repo can't tell they're dead code without reading docs.

### 3. Binary assets bloat the repo

A `.mov` video, `.png` screenshots, and a `.pdf` are committed directly to git. Git stores every version of every binary forever, so these permanently increase clone size. This will get worse over time.

### 4. Business docs at root level

`pitchdeck.md` sits at the repo root. As more business/product docs are added, the root will get cluttered with files that have nothing to do with building and running the software.

### 5. `ROADMAP.md` does too many jobs

At 34KB, it tracks the full sprint-by-sprint history from Sprint 1 through the current sprint, plus feature ownership and future plans. This only grows and makes it harder to find what's current.

### 6. No Architecture Decision Records

Key decisions — why SQLite? why a plugin instead of an extension? why pixel-art? why append-only logs? — aren't captured in a structured way. This context is invaluable as the team grows and new contributors need to understand the "why" behind things.

---

## Proposed Structure

```
campfires/
│
│  # ── Source Code (what gets built) ──────────────────
├── shared/                        # Types & protocol
├── server/                        # API server
├── campfire-stories/              # Web app
├── campfires-plugin/              # Claude Code plugin
│
│  # ── Documentation (stable, reference) ─────────────
├── docs/
│   ├── architecture/              # System architecture, infra diagrams
│   │   ├── overview.md
│   │   └── infrastructure.md
│   ├── adr/                       # Architecture Decision Records
│   │   ├── README.md
│   │   ├── 0001-plugin-over-extension.md
│   │   ├── 0002-sqlite-for-persistence.md
│   │   ├── 0003-pixel-art-map-visualization.md
│   │   ├── 0004-monorepo-with-npm-workspaces.md
│   │   ├── 0005-append-only-activity-log.md
│   │   └── _template.md
│   ├── guides/                    # Getting started, setup guides
│   │   └── plugin-setup.md
│   ├── images/                    # Screenshots, diagrams
│   └── proposals/                 # Proposals like this one
│       └── repo-restructure.md
│
│  # ── Active Product Work (living, in-flight) ───────
├── specs/
│   ├── _templates/                # Templates for new feature specs
│   │   ├── design.md
│   │   ├── implementation.md
│   │   └── decisions.md
│   ├── campfire-lifecycle/        # Active feature: campfire lifecycle
│   │   ├── design.md
│   │   └── implementation.md
│   ├── sparks/                    # Active feature: sparks (cross-team synergies)
│   │   ├── design.md
│   │   └── implementation.md
│   └── map-enhancements/          # Active feature: map improvements
│       ├── design.md
│       └── passes.md
│
│  # ── Product & Business ────────────────────────────
├── product/
│   ├── vision.md                  # Product vision & direction
│   ├── pitchdeck.md               # Pitch materials
│   └── references/                # External articles, research
│       └── README.md              # Links (not files) to external material
│
│  # ── Archive (historical, not active) ──────────────
├── archive/
│   ├── v1-extension/              # VS Code extension prototype
│   ├── v1-cli/                    # Terminal client prototype
│   ├── v1-build-spec.md           # Original build spec (when superseded)
│   └── completed-sprints/         # Historical sprint records
│
│  # ── Scripts & Config ──────────────────────────────
├── scripts/
├── .github/
│
│  # ── Root files ────────────────────────────────────
├── README.md
├── CONTRIBUTING.md
├── CLAUDE.md
├── ROADMAP.md                     # Current + next sprint only
├── package.json
├── tsconfig.base.json
└── ...config files
```

---

## File-by-File Migration Plan

### From `active-product-development-context/`

| Current file                                | Destination                                                                  | Notes                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `campfires-build-spec-v3.md`                | `docs/architecture/build-spec-v3.md`                                         | Core technical reference                                             |
| `infrastructure-diagrams-2026-02-08.md`     | `docs/architecture/infrastructure.md`                                        | Architecture reference                                               |
| `app-future-state-sketch-2026-02-08.md`     | `product/vision.md`                                                          | Product direction                                                    |
| `campfire-watch-vision.html`                | `archive/campfire-watch-vision.html`                                         | Deprecated (CLI-era vision)                                          |
| `campfires-map-mockup.html`                 | `archive/campfires-map-mockup.html`                                          | Historical mockup (or `specs/map-enhancements/` if still referenced) |
| `sprint-12-sparks.md`                       | `specs/sparks/design.md`                                                     | Active feature spec                                                  |
| `sprint-13-campfire-lifecycle-prompt.md`    | `specs/campfire-lifecycle/design.md`                                         | Active feature spec                                                  |
| `map-enhancement-pass1.md`                  | `specs/map-enhancements/pass1.md`                                            | Active feature spec                                                  |
| `map-enhancement-pass2.md`                  | `specs/map-enhancements/pass2.md`                                            | Active feature spec                                                  |
| `Campfire Screenshot Feb 16 2026.png`       | `docs/images/campfire-screenshot-2026-02-16.png`                             | Rename to kebab-case                                                 |
| `Live Campfires Screenshot Feb 14 2026.png` | `docs/images/live-campfires-screenshot-2026-02-14.png`                       | Rename to kebab-case                                                 |
| `Campfires Map view demo feb 14 2026.mov`   | **Externalize** — upload to cloud storage, link from `docs/images/README.md` | Too large for git                                                    |
| `The Anthropic Hive Mind...Medium.pdf`      | **Remove from git** — add URL link to `product/references/README.md`         | Publicly available article                                           |

### From root level

| Current file                    | Destination                     | Notes                                 |
| ------------------------------- | ------------------------------- | ------------------------------------- |
| `pitchdeck.md`                  | `product/pitchdeck.md`          | Business doc                          |
| `extension/` (entire directory) | `archive/v1-extension/`         | Dead code; remove from npm workspaces |
| `cli/` (entire directory)       | `archive/v1-cli/`               | Dead code; remove from npm workspaces |
| `inactive-archived-context/`    | Delete (replaced by `archive/`) | Only contains a README                |

### `ROADMAP.md` changes

| Content                      | Destination                                  |
| ---------------------------- | -------------------------------------------- |
| Sprints 1-11 (completed)     | `archive/completed-sprints/sprints-01-11.md` |
| Current sprint + next sprint | Stays in `ROADMAP.md`                        |

---

## New Content to Create

### Architecture Decision Records

Retroactively capture key decisions that have already been made:

| ADR                                    | Topic                                                              | Rationale to capture                  |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `0001-plugin-over-extension.md`        | Why Campfires pivoted from VS Code extension to Claude Code plugin | Explains why `extension/` is archived |
| `0002-sqlite-for-persistence.md`       | Why SQLite instead of Postgres or another DB                       | Trade-offs for early-stage simplicity |
| `0003-pixel-art-map-visualization.md`  | Why an RPG-style pixel-art map is the primary UI                   | Product differentiation choice        |
| `0004-monorepo-with-npm-workspaces.md` | Why a single repo with npm workspaces                              | vs. separate repos or Nx/Turborepo    |
| `0005-append-only-activity-log.md`     | Why activity logs are append-only, never updated or deleted        | Data integrity choice                 |

Each ADR follows the standard format:

```markdown
# ADR-NNNN: [Title]

## Status

Accepted

## Context

[What problem were you solving?]

## Decision

[What did you decide?]

## Consequences

[What becomes easier or more difficult?]
```

### Spec templates

A `specs/_templates/` directory with starter files so that new features always get the same structure:

- `design.md` — what to build, approach, open questions
- `implementation.md` — progress tracking (completed / in-progress / blocked)
- `decisions.md` — feature-scoped decision log

---

## What to Update After Migration

These files reference the current structure and would need path updates:

| File              | What changes                                        |
| ----------------- | --------------------------------------------------- |
| `README.md`       | Project Structure section; spec reference link      |
| `CLAUDE.md`       | Structure section; reference doc paths              |
| `CONTRIBUTING.md` | Monorepo Structure section; "What Goes Where" table |

---

## Suggested Execution

This migration is entirely `git mv` commands, which preserves git history for all moved files. The full migration could be done in a single commit or broken into logical chunks:

1. Create new directories (`docs/`, `specs/`, `product/`, `archive/`)
2. `git mv` files from `active-product-development-context/` to their new homes
3. `git mv extension/ archive/v1-extension/` and `git mv cli/ archive/v1-cli/`
4. `git mv pitchdeck.md product/pitchdeck.md`
5. Split `ROADMAP.md` (move completed sprints to archive)
6. Externalize `.mov` and `.pdf`
7. Create new files (ADR index, templates, `product/references/README.md`)
8. Update `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` with new paths

---

## Open Questions

- **Naming**: `specs/` vs. `design/` vs. `rfcs/` — any preference?
- **ADRs**: Are there other key decisions worth documenting beyond the five listed?
- **Binary hosting**: Any preference for where to host the externalized `.mov`? (GitHub release assets, S3, Cloudflare R2, etc.)
- **Completed sprints**: Worth keeping the full history in `archive/`, or is the git history sufficient?
