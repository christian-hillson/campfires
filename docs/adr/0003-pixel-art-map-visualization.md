# ADR-0003: Pixel-Art Map Visualization

## Status

Accepted

## Context

The web app needs to show an organization's engineering activity at a glance. The question was how to visualize it: dashboard with charts, list/card view, or something more novel. The product thesis is that Campfires should feel like something you _want_ to leave open, not another monitoring dashboard.

## Decision

Use an RPG-style pixel-art map as the primary visualization. Each team is a campfire on a 2D canvas. Fire intensity reflects activity level. Developers appear as animated sprites with task-specific animations (smithing, scribing, mining). AI agents appear as golems linked to their human. The map includes environmental art (trees, paths, torches), a day/night cycle, zoom/pan controls, and ambient visual elements.

## Consequences

- **Easier:** The product is immediately differentiated from every other engineering visibility tool. The map is engaging and ambient — people leave it open. Spatial memory helps users build intuition for where teams are. The fire metaphor (cold/kindled/steady/roaring) communicates activity level instantly.
- **Harder:** Canvas-based rendering is more complex than DOM-based UI. Hit detection, camera transforms, and sprite animation require custom code. Accessibility is limited compared to traditional HTML interfaces. Mobile/responsive support is non-trivial.
