# Campfires — Business Requirements Document

**Version:** 0.2 (Draft)
**Last updated:** 2026-02-20
**Authors:** Natasha Najdovski, Claude
**Audience:** Build team (Natasha, Christian, JC, contributors)

---

## 1. Purpose

This document defines the customer-facing business requirements for Campfires. It describes what the product must do from the perspective of the people who use it — not how it's built. It is the shared reference for what we're building and why.

Technical architecture, sprint plans, and implementation details live elsewhere. This document answers: **what does Campfires need to do for our customers?**

---

## 2. Product Overview 

While AI coding tools have dramatically accelerated how fast individual developers and agents can write code, the coordination infrastructure for building products as a team has remained widely unchanged. We believe that bottlenecks in building will shift from writing code to sharing context, and that four main problems will worsen as teams are enabled by AI:  

- **Coordination will lag behind development velocity.** Coding may be 10x faster, but teams still rely on manual, periodic updates to stay aligned. Context goes stale within hours — or minutes.
- **Agents operate will invisibly.** AI assistants are doing real work, but they are often unsupervised, hidden from each other, and invisible to cross-functional stakeholders.
- **Context will go stale instantly.** The information exists — in git logs, terminals, uncommitted branches — but there's no ambient layer connecting it in real time. Work happening in parallel can easily be done with critically outdated context.
- **Teams will collide (or conflict) unknowingly.** At 10x velocity, the expense and inefficiency of two teams building the same thing (or contradicting things) is significant.

Campfires is real-time coordination infrastructure for teams building at AI speed. 

---

## 3. Target Users

### 3.1 Developer (Primary)

Software engineers using AI coding tools (Claude Code, Copilot, Cursor) in their daily work. They work in editors or terminals, often alongside AI agents that write code on their behalf. Today, developers get context about what teammates are doing through Slack messages ("what are you working on?"), standups, checking ticket status in Jira/Linear, and scanning GitHub PRs — all can be manual, interruptive, or stale by the time they're read.

**Needs:**
- Know what teammates and their agents are working on to avoid duplicate or conflicting work
- Discover related work happening across the org to reuse patterns and avoid reinventing
- See what has been delegated to AI agents across the team
- Share progress without writing status updates
- Maintain privacy when needed (focus time, experimental work)

### 3.2 Engineering Stakeholder (Primary)

Product managers, engineering managers, designers, etc. — anyone who needs to understand what engineering is building but doesn't write or read code directly. Today, they rely on Jira/Linear (ticket status, sprint boards), standups and weekly syncs (verbal updates), Slack ("where are we on X?"), and manually assembled dashboards and reports. These sources are periodic, manual, and dependent on developers maintaining ticket hygiene.

**Needs:**
- Understand what's being built in plain language without relying on ticket updates
- Track project progress through actual development activity, not self-reported status
- Reduce or eliminate status meetings and async check-ins for routine progress updates
- Identify misalignment between planned work (roadmap/sprint) and actual activity
- Spot resource allocation issues — who's stretched thin, what's understaffed, where energy is concentrated
- For smaller teams: potentially replace sprint tracking and status reporting entirely with activity-driven project intelligence

### 3.3 Organization Leadership (Secondary)

Executives, VPs, CTOs, founders — people who need an org-wide view of engineering activity. Today, they rely on executive dashboards (often manually assembled from Jira exports and spreadsheets), monthly or quarterly business reviews, skip-level meetings, and second-hand reports from engineering managers. Information is heavily filtered and often weeks old by the time it reaches them.

**Needs:**
- See all teams at a glance: what's active, what's quiet, where the energy is
- Identify cross-team dependencies or collisions early
- Understand resource allocation through actual activity, not reported status
- Understand whether engineering activity is aligned with strategic priorities and goals
- Reduce reliance on manually assembled engineering reports and status decks

---

## 4. Business Requirements

Requirements are organized by the core capability they support. Each requirement has a priority and a current status.

**Priority** (tied to customer segment and product milestone):

- **P0 — MVP for small teams.** Required to launch a viable product for teams of 2-10 developers working on 1-3 applications, using Claude Code as their primary AI coding tool. This is the beachhead: small startups, indie teams, and early-stage companies where everyone knows each other and coordination overhead is just starting to hurt. Org structure is flat (one team or a handful), context is lightweight, and the product must work with near-zero setup.

- **P1 — Growth-stage teams and multi-team orgs.** Required for teams of 10-50 developers across multiple teams working on multiple products/services. This is the scaling company: distinct teams with different mandates, a PM layer that needs visibility, and enough cross-team activity that coordination without tooling becomes a bottleneck. Requires project-level context, cross-team intelligence, structured business context, and the ability to pull context from tools teams already use. Agent diversity starts to matter here (teams may use Cursor, Copilot, or Windsurf alongside Claude Code).

- **P2 — Enterprise readiness and platform maturity.** Required for organizations of 50-500+ engineers with department hierarchies, formal goal frameworks (OKRs), and mature toolchains. This is where Campfires needs deep org structure, goal-level rollups, rich integrations, RBAC, and the ability to support agents operating across the full development lifecycle (CI/CD, autonomous agents, multi-model setups). These requirements are forward-looking — they ensure the product architecture doesn't paint us into a corner, but they are not needed for initial traction.

**Status:**
- **Done** — Implemented and working in the current build.
- **Not started** — On the roadmap but not yet built.
- **Policy** — Not a software feature; enforced through product principles and team norms.

---

### 4.1 Activity Capture

The system must capture developer and AI agent activity without requiring manual input.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AC-1 | The system must capture developer activity (file edits, commits, branch changes) automatically from the developer's working environment | P0 | Done |
| AC-2 | Activity capture must work terminal sessions without additional setup beyond initial login | P0 | Done |
| AC-3 | AI agent activity must be captured and attributed separately from the human who invoked the agent | P0 | Done |
| AC-4 | The system must support three sharing modes: full activity sharing, presence-only (online but no details), and fully off | P0 | Done |
| AC-5 | Switching between sharing modes must be instant and require no more than one action | P0 | Done |
| AC-6 | When sharing is off, no activity data is transmitted — not stored locally for later upload, not queued | P0 | Done |
| AC-7 | Session transcripts (the conversation between developer and AI) must be capturable as an input to AI summarization when the developer opts in | P1 | Done |
| AC-8 | The system must detect and capture git events (commits, branch switches) even when performed by AI agents | P1 | Done |
| AC-9 | Every activity captured must be attributed to a person and to a project as an input into AI summarization (Note: this might make sense to put elsewhere) | P0 | Done |

**Open Questions:**
- **Data retention**: How long should activity data and summaries be retained? Is there a business need for historical summaries beyond the current session?

---

### 4.2 Real-Time Awareness (Developer Experience)

Developers must be able to see what their teammates are doing in real time.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| RA-1 | Developers must see which teammates are currently online, active, idle, or in privacy mode | P0 | Done |
| RA-2 | For each active teammate, the system must show what file or area of the codebase they are working in | P0 | Done |
| RA-3 | AI agents must be visible as distinct participants, linked to the human who invoked them | P0 | Done |
| RA-4 | Developers must see a chronological activity feed of team events (file saves, commits, branch switches) | P0 | Done |
| RA-5 | Commit messages must be displayed as high-signal intent markers in the activity feed | P1 | Done |
| RA-6 | The system must support idle detection — if a developer is inactive for a configurable period, their status updates automatically | P1 | Done |
| RA-7 | Awareness data must update in real time (sub-second latency for presence, seconds for activity events) | P1 | Done |
| RA-8 | A developer must be able to see awareness for their own team by default and visit other teams' campfires as a read-only observer | P1 | Done |

---

### 4.3 Privacy and Trust

Developer trust is foundational. The product will not be adopted without strong privacy controls.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| PT-1 | A developer must be able to enter "draft mode" (privacy mode) with a single action, immediately hiding all activity details from teammates | P0 | Done |
| PT-2 | When in draft mode, teammates must see that the developer is online but must not see any file, branch, commit, or activity details | P0 | Done |
| PT-3 | Non-developer stakeholders must never see raw developer activity (file paths, code, terminal output). They only see AI-summarized, project-level information  **Note: I'm not too sure about this phrasing**| P0 | Done |
| PT-4 | The system must not capture or transmit keystrokes, screen content, or clipboard data. Activity capture is limited to file-level events and git events | P0 | Done |
| PT-5 | Privacy mode must be opt-out (activity sharing is the default) but trivially easy to activate. Adoption requires trust, and trust requires knowing you can go dark | P0 | Done |
| PT-6 | Activity data must not be used for individual performance measurement, time tracking, or productivity scoring. The system is for coordination, not surveillance | P0 | Policy |
| PT-7 | Session transcripts are only captured and shared when the developer explicitly opts into full sharing mode | P1 | Done |

**Open Questions:**
- **Trust signal**: What's the customer's opinion on being able to read the source code and verify exactly what data Campfires collects and transmits? Would that change their willingness to adopt it, or is a clear privacy policy sufficient?

---

### 4.4 AI Summarization

The system must translate raw technical activity into business-legible summaries.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AS-1 | The system must generate plain-language summaries of what each team is working on, updated at regular intervals (target: every 15 minutes) | P0 | Done |
| AS-2 | Summaries must use company context (organization/team structure, project roadmaps, organization goals) to translate technical activity into business-relevant language | P0 | Done |
| AS-3 | Summaries must attribute work to the correct team and project without exposing raw code or file paths | P0 | Done |
| AS-4 | Summaries must distinguish between human and AI agent contributions when relevant | P1 | Not started |
| AS-5 | The system must produce both a short one-liner summary (for at-a-glance views) and a longer narrative summary (for detail views) per team | P1 | Done |
| AS-6 | When session transcripts are available, the summarizer must use them for richer, more accurate summaries than file-event-only summaries | P1 | Done |
| AS-7 | Summaries must update via live streaming (e.g., server-sent events) so stakeholders see new information without refreshing | P1 | Done |
| AS-8 | The system must be resilient to AI summarization failures — if the AI service is unavailable, the product must still function with degraded summaries (stubs or raw event counts) | P2 | Done |
| AS-9 | The system must create summaries at a project and a team/organization level | P0 |  |
| AS-10 | The system must allow the user to toggle between team/organization and project level summaries| P2 | |
| AS-11 | Project and team summaries must reflect roadmap or goal context provided by users| P2 | |

**Open Questions:**
1. How do we want to think about
2. **Summary customization**: Should different stakeholder roles see different levels of summary detail, or is one level of summarization sufficient?

---

### 4.5 Organization Map (Visualization)

Stakeholders must be able to see the entire organization's engineering activity at a glance.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| OM-1 | The system must provide a visual overview of all teams in an organization, showing relative activity levels | P0 | Done |
| OM-2 | The system must provide a visual overview of all projects being worked on in an organization, showing relative activity levels | P0 | |
| OM-3 | Each team's visual representation must reflect its current activity level (e.g., a busy team looks visually different from a quiet one) | P0 | Done |
| OM-4 | Individual developers and AI agents must be visually represented within their team's and project's area, with distinct appearance for humans vs. agents | P1 | Done |
| OM-5 | The map must support zoom and pan so users can get both org-wide and team-level/project-level views | P1 | Done |
| OM-6 | Clicking on a team must show detail: who's there, what they're building (AI summary), and recent activity | P1 | Done |
| OM-7 | Clicking on a project must show detail: who's there, what they're building (AI summary), and recent activity | P1 | Done |
| OM-8 | Team positions on the map must be stable and persistent — people build spatial memory of where teams are | P1 | Done |
| OM-9 | Project positions on the map must be stable and persistent — people build spatial memory of where teams are | P1 | Done |
| OM-10 | The map must include a day/night cycle or ambient visual elements that make it feel alive and worth leaving open | P2 | Done |
| OM-11 | New teams should have a visually memorable moment when they first appear on the map | P2 | Done |

**Open Questions:**
- **Ambient display**: Is "the map on a TV in the office" a formal requirement or a nice-to-have demo feature?

---

### 4.6 Cross-Team Visibility

The system must help people discover what's happening beyond their own team.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| CT-1 | Any authenticated user in an organization must be able to view any team's campfire as a read-only observer | P0 | Done |
| CT-2 | The org-wide summary panel must show AI-generated one-liner summaries for every team, updated in real time | P0 | Done |
| CT-2 | Users must be able to view either team or projects as campfires *Note: I think this is controversial - we should discuss* | P0 | |
| CT-3 | The system must detect and surface meaningful cross-team connections — when two teams are working on related or conflicting things | P1 | Done |
| CT-4 | Cross-team connections (Sparks) must include per-team perspective that may be asymmetric (what the connection means for each team specifically) | P1 | Done |
| CT-5 | Cross-team connections must be rate-limited to avoid noise (no more than 1 per team per 24 hours) and dismissable by team members | P1 | Done |
| CT-6 | A historical log of cross-team connections must be available for review | P2 | Done |

**Open Questions:**
1. Do we want different context to be exposed to people outside of a project/team (but still in the organization) based on the phase of development? Might be some danger in wide visibility (or even "sparks" between teams) if one is very early on in their development.
2. **Guest access**: Should stakeholders outside the organization (investors, advisors, board members) be able to view the map with limited access?

---

### 4.7 Team & Organization Management

The system must support multi-team organizations.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| TM-1 | Users must be able to create an organization and invite others to join | P0 | Done |
| TM-2 | Organizations must support multiple teams, each with their own campfire | P0 | Done |
| TM-3 | Users must be able to join a team via an invite code or link | P0 | Done |
| TM-4 | Organization admins must be able to set org-level context (mission, roadmap, team descriptions) that feeds into AI summarization | P1 | Done |
| TM-5 | The onboarding experience for a new developer must be zero-configuration after initial login — automatic provisioning of org and team membership | P1 | Done |
| TM-6 | The system must support users belonging to multiple teams or switching between teams | P2 | Not started |

**Open Questions:**
1. Are we organizing campfires by teams, or by projects, or both (with the option to toggle). That changes things here.

---

### 4.8 Campfire Lifecycle

Campfires must have a visible lifecycle that reflects the real state of the team.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| CL-1 | Teams with no members currently online must still appear on the map in a visually distinct "offline" state | P1 | Done |
| CL-2 | When the first team member comes online, the campfire must visually "come to life" with an animated transition | P1 | Done |
| CL-3 | When the last team member goes offline, the campfire must visually wind down after a brief grace period (to handle brief disconnections) | P1 | Done |
| CL-4 | The campfire's visual intensity must reflect the team's current activity level, with smooth transitions between states | P1 | Done |
| CL-5 | A brand-new team's first appearance on the map should include a special visual moment (distinct from daily rekindle) | P2 | Done |

---

### 4.9 Business Context & Organization Intelligence

The quality of AI summaries, cross-team Spark detection, and stakeholder experience is directly proportional to how much the system understands about the organization's structure, projects, and goals. Today, context is limited to three free-text fields (org mission, org roadmap, team description). This section defines the requirements for a much richer context model and the multiple ways it can be ingested.

#### 4.9.1 Organization Structure Context

The system must understand how the organization is structured beyond a flat list of teams.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| OS-1 | The system must support a hierarchical organization model: org > departments/groups > teams | P1 | Not started |
| OS-2 | Each organizational unit (department, group) must have a name, description, and designated owner/lead | P1 | Not started |
| OS-3 | The map visualization must reflect organizational groupings — teams within the same department should be visually clustered | P1 | Not started |
| OS-4 | AI summaries must be available at every level of the hierarchy: team-level, department-level, and org-level rollups | P1 | Not started |
| OS-5 | The system must support team-to-team relationships (e.g., "Platform supports Payments", "Growth depends on Infrastructure") that inform Spark detection | P2 | Not started |
| OS-6 | Users must be able to have roles within the organization (e.g., team member, team lead, department head, org admin) that determine what context they can edit | P2 | Not started |

**Open Questions:**
1. All of this section might be bad/stupid. Worth interrogating.
2. **Context visibility**: Should all business context (goals, project descriptions) be visible to all org members, or should some context be restricted to leadership?

#### 4.9.2 Project Context

The system must understand what projects and initiatives teams are working on, so that activity can be mapped to meaningful work streams rather than just team-level buckets.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| PC-1 | The system must support named projects/initiatives as a first-class concept, each with a title, description, and status (active, paused, completed) | P0 | Not started |
| PC-2 | Projects must be assignable to one or more teams, enabling cross-team project tracking | P0 | Not started |
| PC-3 | AI summaries must reference specific projects by name when activity maps to a known project (e.g., "The Payments team is building Stripe webhook support as part of the Billing Migration project") | P0 | Not started |
| PC-4 | The system must be able to associate developer activity with a project — either through explicit tagging (branch naming conventions, repo mapping) or through AI inference from activity patterns and context | P1 | Not started |
| PC-5 | Each project must support a plain-language description of its purpose, scope, and current phase that the AI summarizer uses as context | P1 | Not started |
| PC-6 | The system must surface project-level views: for any given project, show all teams contributing, recent activity, and AI-generated progress summaries | P1 | Not started |
| PC-7 | Projects must have optional time horizons (start date, target date) that the summarizer can reference when describing progress and urgency | P2 | Not started |
| PC-8 | The map visualization should indicate which projects are active at each campfire, so stakeholders can visually trace a project across teams | P2 | Not started |

**Open Questions:**
1. All of this section might be bad/stupid. Worth interrogating.

#### 4.9.3 Goal Context

The system must understand the business goals and objectives that projects and teams are working toward, so that AI summaries can connect technical activity to strategic outcomes.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| GC-1 | The system must support named goals/objectives as a first-class concept, each with a title, description, and owner | P1 | Not started |
| GC-2 | Goals must be linkable to one or more projects, creating a goal > project > team hierarchy that the AI summarizer can traverse | P1 | Not started |
| GC-3 | AI summaries must be able to frame activity in terms of goal progress when context is available (e.g., "This work contributes to the Q1 objective of reducing onboarding time by 50%") | P1 | Not started |
| GC-4 | The system must support goal-level summary views: for any given goal, show all linked projects, contributing teams, and AI-generated progress narrative | P1 | Not started |
| GC-5 | Goals must support a status or progress indicator (on track, at risk, behind, completed) that can be set manually or inferred from activity patterns | P2 | Not started |
| GC-6 | The system must detect when work is happening that does not map to any known goal or project and surface this as an insight (e.g., "The Platform team has significant activity that isn't linked to any current objective") | P2 | Not started |
| GC-7 | Spark detection must factor in goal alignment — connections between teams working toward the same goal should be weighted higher than coincidental technical overlap | P2 | Not started |

**Open Questions:**
1. All of this section might be bad/stupid. Worth interrogating.
2. **Context depth vs. maintenance burden**: How deep should the goal > project > team hierarchy go before the maintenance cost outweighs the summary quality improvement? Need to validate with real usage.

#### 4.9.4 Context Ingestion — Manual Entry

The system must provide intuitive, low-friction ways for users to directly input and maintain business context.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| MI-1 | The web app must include a context management UI where org admins can create and edit the organization structure, teams, projects, and goals | P0 | Not started |
| MI-2 | Team leads must be able to edit their own team's description, project associations, and goal linkages without requiring org admin access | P1 | Not started |
| MI-3 | The roadmap field must evolve from a single text blob to structured items (individual roadmap entries with title, description, owner, status, and linked goal) | P1 | Not started |
| MI-4 | Context entry forms must be designed for speed — creating a new project or linking a team to a goal should take under 30 seconds | P1 | Not started |
| MI-5 | The system must support bulk context setup (e.g., paste a list of teams, import a CSV of projects) for initial onboarding of a new organization | P2 | Not started |
| MI-6 | The plugin should support context entry from within Claude Code sessions (e.g., a `/campfires:context` command to update team description or link to a project without leaving the terminal) | P2 | Not started |

#### 4.9.5 Context Ingestion — External Integrations

The system must be able to pull business context from the tools organizations already use, reducing manual data entry and keeping context fresh.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| EI-1 | The system must define a context provider interface — a standard way for external sources to supply organization structure, projects, and goals to Campfires | P1 | Not started |
| EI-2 | The system must support integration with project management tools (e.g., Jira, Linear, Asana) to import projects, epics, and their team assignments | P1 | Not started |
| EI-3 | The system must support integration with documentation/wiki tools (e.g., Notion, Confluence) to pull team descriptions, project briefs, and roadmap context | P1 | Not started |
| EI-4 | The system must support integration with OKR/goal-tracking tools (e.g., Lattice, Ally.io, Notion databases, Google Sheets) to import goal hierarchies and progress | P2 | Not started |
| EI-5 | Integrated context must auto-refresh on a configurable schedule so that Campfires always reflects the current state of external tools without manual syncing | P1 | Not started |
| EI-6 | When the same concept exists in both Campfires and an external tool (e.g., a project in Linear and in Campfires), the system must support mapping them together rather than creating duplicates | P2 | Not started |
| EI-7 | The system must support a generic webhook/API endpoint where any tool can push context updates to Campfires, enabling integrations beyond the ones Campfires builds natively | P2 | Not started |

**Open Questions:**
- **Context source of truth**: When business context exists in both Campfires and an external tool, which one wins? Should Campfires be read-only from external sources, or allow edits that sync back?
- **First integration target**: Which external tool integration should be built first? Likely candidates: Linear (project context), Notion (roadmap/docs context), or GitHub (repo-to-project mapping). Should be driven by what our early users actually use.

#### 4.9.6 Context Ingestion — AI Inference

The system must be able to infer business context from the activity it already captures, reducing the burden on humans to maintain context manually.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AI-1 | The system must be able to suggest project groupings by analyzing patterns in developer activity (e.g., "These 3 developers are consistently working in the same area of the codebase — is this a project?") | P2 | Not started |
| AI-2 | The system must be able to infer project-to-activity mapping from branch naming conventions, repository structure, and commit messages without explicit tagging | P1 | Not started |
| AI-3 | The system must be able to detect when a team's activity shifts significantly (e.g., new repo, new code area, different patterns) and prompt for updated context rather than using stale descriptions | P2 | Not started |
| AI-4 | When session transcripts mention project names, goals, or business context, the summarizer must extract and use this information even if it hasn't been formally entered into the system | P1 | Not started |
| AI-5 | The system should surface "context gaps" — areas where richer context would significantly improve summary quality — and prompt the appropriate person to fill them in | P2 | Not started |

**Open Questions:**
- **AI inference accuracy**: How confident does the system need to be before automatically suggesting project groupings or goal linkages? What's the cost of a wrong inference vs. the cost of missing context?

---

### 4.10 Agent Extensibility

Today, Campfires captures AI agent activity exclusively through the Claude Code plugin. As teams adopt multiple AI coding tools (Cursor, Copilot, Windsurf, Devin, custom agents), the system must evolve from "Claude Code awareness" to "agent-agnostic awareness." The P0 requirements in this section reflect what's needed to launch with Claude Code; P1 and P2 requirements define the path to supporting the broader agent ecosystem.

#### 4.10.1 Agent Activity API

The system must provide a standard way for any agent — regardless of tool or framework — to report activity to Campfires.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AE-1 | The Claude Code plugin must remain the primary, fully-supported agent integration for the MVP launch | P0 | Done |
| AE-2 | The server must expose a generic agent activity API that any tool can use to register agents, report activity events, and send heartbeats — not coupled to Claude Code's specific hook system | P0 | Partial |
| AE-3 | The agent activity API must accept the same event types as the Claude Code plugin (file edits, commits, branch switches, session start/end) so that all agents produce comparable data | P0 | Done |
| AE-4 | Every agent must be linked to a human owner (`parentUserId`) regardless of which tool it runs in, so that the map correctly nests agents under their humans | P0 | Done |
| AE-5 | The system must support agents from different tools coexisting within the same team — a developer using Claude Code and a teammate using Cursor should both have their agents visible on the same campfire | P1 | Not started |
| AE-6 | The agent activity API must include a `toolType` or `agentSource` field so the system can distinguish which tool an agent comes from (e.g., "claude-code", "cursor", "copilot", "custom") | P1 | Not started |
| AE-7 | The map visualization must support visually distinguishing agents from different tools (e.g., different golem variants or color accents per tool type) while maintaining the core golem aesthetic | P1 | Not started |

**Open Questions:**
- **Multi-agent per human**: Should the system support a developer having multiple concurrent agents from different tools (e.g., a Claude Code agent and a Cursor agent both active)? How do they appear on the map?

#### 4.10.2 Git-Based Agent Detection

For agents that don't have plugin/integration support, the system must be able to detect agent activity through git signals that any tool produces.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| GD-1 | The system must be able to detect AI-authored commits through git commit metadata (author names, email patterns, commit message conventions) commonly used by AI coding tools | P1 | Not started |
| GD-2 | When an AI-authored commit is detected via git but no agent session exists, the system must be able to create an inferred agent presence and attribute the activity to the repository owner or most likely human | P1 | Not started |
| GD-3 | The system must support configurable rules for git-based agent detection (e.g., "commits from `*[bot]@users.noreply.github.com` are agent commits") so organizations can tune detection for their specific toolchains | P2 | Not started |

**Open Questions:**
- **Agent detection accuracy**: For git-based agent detection (no plugin), how do we handle false positives (human commits misidentified as agent) and false negatives (agent commits that look human)? What's the acceptable error rate?

#### 4.10.3 Third-Party Tool Integrations

The system must provide clear integration paths for specific AI coding tools beyond Claude Code.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| TI-1 | The system must provide documentation and an SDK/example for building a Campfires agent integration for any tool, so that the community or tool vendors can build their own plugins | P1 | Not started |
| TI-2 | The system should support a Cursor extension/plugin that captures activity and reports it to Campfires via the generic agent activity API | P2 | Not started |
| TI-3 | The system should support a VS Code extension that captures Copilot agent activity and reports it to Campfires via the generic agent activity API | P2 | Not started |
| TI-4 | The system must support headless/CI agents (e.g., Devin, Codex, autonomous agents running in pipelines) that have no IDE context but produce git activity and can report via the API | P2 | Not started |
| TI-5 | The system must support webhook-based integrations where a CI/CD platform or orchestrator pushes agent activity events to Campfires (e.g., "GitHub Actions triggered an agent run that produced these commits") | P2 | Not started |

**Open Questions:**
- **Agent tool priority**: After Claude Code, which AI coding tool has the most adoption among our target users and should get native integration next? Cursor seems likely, but should be validated.

---

## 5. Out of Scope (Explicitly Not Required)

The following are deliberately excluded from current requirements:

| Item | Rationale |
|------|-----------|

| Individual performance metrics or time tracking | Fundamentally conflicts with the trust model. Campfires is for coordination, not measurement. |
| Keystroke or screen capture | Privacy violation. Activity capture is file-level and git-level only. |
| Self-hosted / enterprise deployment | Cloud-first for now. Self-hosting is being explored as part of a potential open-source strategy (see Section 8). Enterprise features are a future business decision. |
| Mobile app | The map and summaries are designed for desktop/laptop screens. |
| Notifications / push alerts | The product is designed as an ambient, pull-based experience — you look when you want to. Push notifications change the dynamic. |

---

## 6. Success Criteria

How we know the product is working:

| Criteria | Measure |
|----------|---------|
| Developers keep Campfires active during work | Majority of team members have sharing on during working hours |
| Stakeholders check the map regularly | Repeat visits to the web app without being prompted |
| Fewer "what are you working on?" interruptions | Self-reported reduction in status-request messages (Slack, standups) |
| Cross-team awareness increases | Teams discover overlapping or related work through Sparks before it becomes a problem |
| Developers trust the privacy model | Draft mode usage is low (people are comfortable sharing) but non-zero (people know it's there) |
| AI summaries reference projects and goals by name | When business context is provided, summaries consistently connect activity to the right projects and goals |
| Agent coverage reflects team reality | All active AI agents on a team are visible on the map, regardless of which tool they come from |

Note: 
[NN] This is terrible right now. Will think about it more. 

---

## 7. General Open Questions

Questions that span multiple sections or are fundamentally business-model level. Section-specific open questions live within their respective subsections in Section 4.

- **Pricing model implications**: Do any of these requirements have implications for how the product is packaged and priced (e.g., per-seat, per-team, per-org)?
- **Small team vs. enterprise pricing**: If priorities map to customer segments, does the pricing model follow the same tiers? (e.g., free/cheap for P0 features, paid for P1, enterprise for P2)
- **Pricing sensitivity**: What's the customer's opinion on paying for a hosted version of an open-source tool vs. investing the time to self-host to avoid the cost?
- **Open source necessity**: What's the customer's opinion on whether open source matters to them, or is a good product with a clear privacy policy sufficient?

---

## 8. Licensing & Extensibility Model

**Status:** Under exploration. No decision has been made. This section captures the strategic considerations, constraints, and open questions around whether and how Campfires could be open-sourced. Customer interviews should probe these questions.

### 8.1 Strategic Context

Campfires asks developers to share real-time activity data from their working environments. This requires deep trust. Open source is one of the strongest trust signals available — users can verify that "when sharing is off, nothing is transmitted" by reading the code, not by taking our word for it.

At the same time, Campfires includes proprietary AI summarization, a differentiated visual experience (the map), and a hosted service layer that represents potential revenue. The question is not "open source or not" but **what is open, what is closed, and where does the business model live.**

### 8.2 Licensing Model Options

| Model | What's open | What's closed/paid | Revenue source | Fit for Campfires |
|-------|------------|-------------------|----------------|-------------------|
| **Fully open / free** | Everything | Nothing | None — adoption and ecosystem play, not a revenue generator | Maximum trust and adoption signal. Viable if Campfires is a strategic bet on ecosystem growth (e.g., drives adoption of a parent platform) rather than a standalone business |
| **Fully proprietary (current)** | Nothing | Everything | SaaS subscriptions | Simplest, but limits trust signal and adoption |
| **Open core** | Server, plugin, shared types | Enterprise features (SSO, RBAC, advanced analytics, hosted AI summarization) | Paid tier for enterprise features | Strong fit — core is inspectable, premium features justify pricing |
| **Hosted open source** | Everything including server | Nothing — but you sell managed hosting | Managed cloud service (convenience + SLA) | Good fit if self-hosting is hard enough that most teams prefer paying |
| **Open source + API** | Server, plugin, visualization | AI summarization API is metered/paid | Usage-based API pricing | Possible, but ties revenue to a single capability that could be replicated |

### 8.3 Extensibility Requirements

If Campfires adopts any open-source model, the architecture must support community extension without compromising core guarantees. These requirements apply regardless of which licensing model is chosen.

#### 8.3.1 Plugin & Extension Architecture

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| LE-1 | The system must define a plugin interface for activity sources, allowing third parties to build integrations for any editor, agent, or development tool without modifying core code | P1 | Not started |
| LE-2 | The system must define an extension interface for context providers, allowing third parties to build integrations with any project management, documentation, or goal-tracking tool | P1 | Not started |
| LE-3 | The map visualization must support theming or visual customization so that organizations or community contributors can modify the look and feel without forking the core | P2 | Not started |
| LE-4 | The AI summarization layer must be swappable — the system must not be hardcoded to a single AI provider, so that self-hosters can bring their own API key or use a different model | P1 | Not started |
| LE-5 | Configuration (org structure, privacy defaults, throttling values, summarization intervals) must be manageable via config files or environment variables, not only through a UI, so that self-hosters and automated deployments can configure the system programmatically | P1 | Not started |

**Open Questions:**
- **Customization appetite**: What's the customer's opinion on customizing Campfires — would they want to build their own integrations, change the visualization, or modify how summaries work?
- **Contribution willingness**: If Campfires were open source, would customers contribute back (bug fixes, integrations, features), or would they primarily use it as-is?

#### 8.3.2 Self-Hosting Support

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SH-1 | The system must be deployable as a single Docker container (or small compose stack) for small-team self-hosting | P2 | Not started |
| SH-2 | Self-hosted deployments must support all P0 features without requiring a connection to Campfires-operated services | P2 | Not started |
| SH-3 | The system must provide clear documentation for self-hosting setup, configuration, and upgrades | P2 | Not started |
| SH-4 | Self-hosted and cloud-hosted instances must not be architecturally different — the same codebase runs in both modes, with configuration determining the deployment model | P2 | Not started |

**Open Questions:**
- **Self-hosting demand**: What's the customer's opinion on running Campfires on their own infrastructure vs. using a managed cloud service?

#### 8.3.3 Privacy Architectural Constraints

If the codebase is open, privacy guarantees must be enforced architecturally, not just by policy.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| PA-1 | The activity capture layer must enforce privacy modes at the data-emission level — when sharing is off, the code path must not collect, buffer, or transmit any activity data. This must be verifiable by code inspection. | P0 | Done |
| PA-2 | The system must not expose any API endpoint, database query, or extension point that enables individual productivity scoring, time tracking, or keystroke-level monitoring — even for forks that want to add it, the core architecture should make surveillance features structurally difficult to bolt on | P0 | Policy |
| PA-3 | The AI summarization prompts must be inspectable (either open source or published) so that users can verify what information the AI is asked to produce and what it is instructed to exclude | P1 | Not started |

