# 🔥 Campfires

> **Note:** Vibe should be:
>
> - Less: "visibility tool for oversight", More: "coordination infrastructure for velocity"
> - Less: "nobody knows what engineers are doing", More: "at AI-speed, stale information kills velocity"
> - Less: "everyone works in silos", More: "we lack tools for efficient, effective, and fun context sharing"
> - Less: "makes work visible", More: "reduces coordination lag from hours to seconds"
> - Less: "AI-summarized for PMs/execs", More: : "enables hive operation where everyone sculpts the living prototype together"

Campfires is real-time coordination infrastructure for teams building at AI speed. Our Claude Code plugin ambiently captures what you're working on — files, branches, commits — and aggregates activity across your team (humans and agents). The Campfires web app transforms that data into a live map of what everyone is building (visualized as flames in a campfire), with real-time activity logs and AI-generated project summaries that open the door for collaboration and keep cross-functional stakeholders in the loop without interrupting builders.

```
Source                   System                    Surface
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Claude Code      │   │ Campfires        │   │ Campfire Stories │
│ Plugin           │──▶│ Server           │──▶│ Web App          │
│                  │   │                  │   │                  │
│ - File edits     │   │ - Activity       │   │ - Pixel-art map  │
│ - Commands       │   │   storage        │   │ - Zoom/pan       │
│ - Sessions       │   │ - Team           │   │ - Day/night      │
│                  │   │   organization   │   │   cycle          │
│                  │   │ - AI             │   │ - AI summaries   │
│                  │   │   summarization  │   │                  │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

---

## Problem

In Steve Yegge's recent article on companies building at AI-speed, he wrote:

> "An external fourth contributor overseas wasted a bunch of time acting on 2-hour-old information, because everything is moving so fast... You need full transparency at all times, at their speeds, or nobody will ever see what you are doing and you'll fall irretrievably behind."
>
> — ["The Anthropic Hive Mind"](https://steve-yegge.medium.com/the-anthropic-hive-mind-d01f768f3d7b)

Expanding on this, we see four problems that get worse as teams are enabled by AI to execute ideas faster:

- **Coordination lags behind development velocity.** Coding may be 10x faster, but teams building together still coordinate through Slack and standups to stay aligned. The bottleneck has shifted from writing code to sharing context.
- **Agents operate invisibly.** AI assistants are doing real work, but they're often unsupervised, hidden from each other, and cross-functionally invisible.
- **Context goes stale instantly.** The information exists — in git logs, terminals, uncommitted branches — but there's no ambient layer connecting it in real time. Work happening in parallel can easily be done with critically outdated context.
- **Teams collide unknowingly.** At 10x velocity, the expense and inefficiency of two teams building the same thing (or contradicting things) is significant.

---

## Campfires' Approach

Campfires reduces coordination lag from hours to seconds by making work visible the moment it happens, and summarizing progress for the people who need it.

- **For developers** that means real-time visibility into who's working on what, and AI-assisted updates for your stakeholders on what you're building.
- **For engineering stakeholders** that means seeing frequent development status updates in plain language — no code, no jargon, no bothering a busy engineer for routine updates.
- **For leadership** that means an org-wide view of what's being worked on, making it easier to see where there's energy, overlap, or misalignment.

The key concepts of our platform include:

- **Real-time awareness:** See teammates' active files, commits, and branches as they happen
- **AI agents as participants:** Claude Code agents are automatically detected and tracked alongside their human, with distinct representation on the map
- **AI-summarization:** Business-legible team updates generated every 15 minutes from real activity data
- **Cross-team visibility:** Visit any campfire in your organization as an observer
- **Zero configuration for developers:** Claude Code plugin captures activity automatically; no additional setup
- **Privacy by default:** One-click toggle to go dark when you need focus time

---

## Our Web App

<!-- TODO: Insert screenshot -->

The Campfires web app ("Campfire Stories") is a full-screen pixel-art map view with two components:

1. **Organization Map**: An RPG-style pixel-art canvas of your entire organization. Each campfire represents a team. Fire intensity reflects how active the team is. Developers appear as animated sprites; AI agents appear as golems linked to their human. Click any campfire to see who's gathered and what they're building. Supports mouse-wheel zoom, click-drag panning, and a day/night cycle with twinkling stars and dynamic campfire glow.
2. **Fireside Updates**: An overlay panel showing AI-generated one-liner summaries for each team, updated in real time via SSE.

### Naming Conventions

Campfires uses fire-themed naming throughout the app:
| Level | Name | Emoji | Description |
|:------------ |:------------ |:-----:|:------------------------------- |
| Organization | **Bonfire** | 🔥 | Your entire org — "Acme Bonfire" |
| Team | **Campfire** | 🏕️ | A single team — "Payments Campfire" |
| Individual | **Flame** | 🎇 | One developer's activity stream |
| Agent | **Golem** | | One AI agent's activity stream |

---

> **Note:** The following sections are development references. They will evolve as Campfires continues to take shape.

## Project Structure

```
campfires/
├── shared/            # Types and protocol (build first)
├── server/            # Node.js + Express + SQLite
├── campfire-stories/  # Web app (Vite + vanilla TS)
├── campfires-plugin/  # Claude Code plugin (hooks, commands, skills)
└── context/           # Specs and reference docs
```

For the full technical specification — architecture, data model, API surface, and how the packages connect — see [`context/campfires-build-spec-v3.md`](context/campfires-build-spec-v3.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, branch conventions, and code rules.

---

## Current Status

See [ROADMAP.md](ROADMAP.md) for sprint status, feature ownership, and what's planned next.

--

## License

This project does not currently have a license. All rights are reserved by the author. If you're interested in using or contributing to Campfires, please reach out to discuss terms.
