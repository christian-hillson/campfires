# Campfires — Pitch Deck

---

## Slide 1: The Problem

**Nobody knows what engineering is building right now.**

- PMs ask in standups. Execs read stale status docs. Designers wait for Slack replies.
- Developers context-switch to explain work they're actively doing.
- The bigger the org, the worse it gets. Teams become black boxes.

The information exists — it's just trapped inside editors, terminals, and git logs.

---

## Slide 2: The Insight

**Software teams are campfires.**

When people gather around interesting work, the fire burns brighter. The bigger the fire, the more it attracts. But today, you can't see the fires — you can only see the ashes (merged PRs, closed tickets, shipped features).

What if you could see the fires while they're burning?

---

## Slide 3: Campfires

**Real-time team awareness for developers. AI-translated visibility for everyone else.**

Campfires captures what developers are working on — files, branches, commits — and turns it into two things:

1. **For devs:** Ambient awareness of your team, right in your editor or terminal
2. **For everyone else:** AI-summarized, business-legible updates — no asking required

---

## Slide 4: The Map — Hero Shot

*[Screenshot: RPG-style pixel-art map showing an organization]*

Each campfire on the map is a team. The fire's intensity shows how active they are. Human developers are sprites working at the fire — smithing, scribing, mining. AI agents are golems, color-matched to their human owner.

You can see at a glance: where the energy is, how many people are gathered, and what's drawing them there.

---

## Slide 5: Zoom Into a Campfire

*[Screenshot: Campfire detail view]*

Click any campfire to see:

- **Who's there** — 4 engineers, 2 AI agents, 1 visitor from the design team
- **What they're building** — "Payments team is integrating Stripe webhooks as part of the Q1 billing migration"
- **How active it is** — fire intensity, recent commit cadence

The summary is AI-generated from real activity, grounded in your company's roadmap and project context. Not a status update someone wrote — a live translation of what's actually happening.

---

## Slide 6: "That Looks Interesting"

The magic moment:

> A PM opens the map. They see a big fire at the Infrastructure campfire — 6 people gathered, unusually active. The AI summary says "migrating auth to the new SSO provider." The PM thinks: "Oh — that's related to the enterprise deal. Let me sit in on this."

They click **Visit** and join the campfire as an observer. They see the team's activity stream, who's working on what, and the momentum. They don't interrupt. They don't need to ask.

**This is the interaction that doesn't exist today.**

---

## Slide 7: Three Surfaces, One Pipeline

| Surface | Who it's for | What they see |
|---------|-------------|---------------|
| **VS Code Extension** | Developers | Teammates in your campfire — who's in what file, real-time |
| **Terminal CLI** | Terminal-first devs | Same awareness, split-pane alongside Claude Code or vim |
| **The Reel (Web App)** | PMs, execs, designers, anyone | AI-summarized org-wide view — every campfire at a glance |

All three surfaces read from the same real-time data pipeline. Install once, visible everywhere.

---

## Slide 8: The Reel

*[Screenshot: Reel summary feed]*

The Reel is the org-wide view. Every team's campfire, summarized by AI every 15 minutes using your company's context — mission, roadmap, team descriptions.

Summaries like:
- "Payments: Building Stripe webhook receiver for the billing migration (3 active, 1 agent)"
- "Platform: Quiet today — 1 engineer doing dependency upgrades"
- "Growth: Shipping the onboarding redesign — 4 active across frontend and API"

No raw code. No file paths. No jargon. Just what's happening, translated for humans.

---

## Slide 9: Humans + Agents, From Day One

AI coding agents (Claude Code, Copilot, Cursor) are first-class participants.

- Agents appear as distinct sprites on the map — blockier, glowing eyes, linked to their human owner
- Their commits and file changes flow through the same pipeline
- AI summaries attribute work correctly: "Sarah and her agent are building the auth flow"

As AI agents do more of the coding, the campfire is how you see what they're doing — without reading every diff.

---

## Slide 10: How It Works

```
Developer's editor              Campfires Server              Surfaces
┌─────────────────┐           ┌──────────────────┐
│  File opens      │──────────│  Yjs rooms        │──────── VS Code sidebar
│  File saves      │ WebSocket│  Awareness state   │──────── Terminal CLI
│  Commits         │──────────│  Activity log      │
│  Branch switches │           │  AI summarization  │──────── The Reel (web)
│  Presence        │           └──────────────────┘          The Map
└─────────────────┘
```

- **Yjs CRDT** for real-time sync — battle-tested, used by AFFiNE, Huly, and others
- **Append-only activity log** feeds AI summarization
- **Claude API** generates business-legible summaries with company context
- **Draft mode** lets any developer go dark with one toggle — trust requires opt-out

---

## Slide 11: The Adoption Flywheel

```
Devs install Campfires
        ↓
They see teammates → useful for coordination
        ↓
Activity data flows into the Reel
        ↓
PMs and execs see what's happening → demand grows
        ↓
"Why isn't your team on Campfires?"
        ↓
More teams install → Reel gets better → Map gets more interesting
```

Developers adopt it because it helps them. The org adopts it because it helps everyone else. The map makes the whole thing visible and social.

---

## Slide 12: What's Built

| Component | Status |
|-----------|--------|
| Core server (WebSocket, REST, SQLite, auth) | Done |
| Terminal CLI with agent activity tracking | Done |
| Reel web app with AI summaries and SSE | Done |
| RPG-style pixel-art map view | Done |
| VS Code extension (sidebar, decorations, status bar) | Done |
| Cross-team campfire visits | Planned |

Five sprints complete. Monorepo, TypeScript throughout, ready to dogfood.

---

## Slide 13: What's Next

- **Cross-team visits** — click a campfire on the map, observe as a visitor
- **Richer AI summaries** — connect to Notion/Linear for roadmap context
- **Ambient display mode** — the map on a TV in the office
- **Enterprise** — SSO, self-hosted, audit logs

---

## Slide 14: The Vision

Every organization has campfires burning. Work is happening right now — interesting, important, collaborative work. But you can't see it unless you're already sitting there.

**Campfires makes the invisible work visible.**

Walk over to any fire. See who's gathered. See what they're building. Sit down if it's interesting.

*Build the campfire. Gather the team. Start sculpting together.*
