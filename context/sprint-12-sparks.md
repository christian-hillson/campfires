# Sprint 12: Sparks — Cross-Team Connection Detection

Cross-team intelligence layer that detects meaningful connections between campfires and surfaces them as "Sparks." The AI summarizer already ingests activity from all teams — Sparks extend this with a cross-team analysis pass that identifies synergies, collisions, and dependencies between teams' current work.

**Core concept:** After each batch summarization cycle, a second Claude API call analyzes all team summaries together and identifies cross-team connections. These are surfaced as Sparks — brief, high-signal notifications that appear on the map (animated arc between campfires), momentarily in Fireside Updates, and persistently in the campfire detail panel until dismissed. Dismissed sparks are preserved in a searchable log.

**Design principles:**
- Sparks are precious, not noisy. Max 1 spark per campfire per 24-hour window.
- Sparks can be asymmetric — informational for one team, actionable for another.
- Any team member can dismiss a spark for their team. Dismissed sparks move to the log.
- The spark log preserves all sparks (active, dismissed, expired) for historical review.
- Sparks are deduped across batch cycles — if the same connection is re-detected, the existing spark is refreshed rather than duplicated.

---

## Data Model

### New type: `Spark` in `shared/src/types.ts`

```typescript
interface Spark {
  id: string;                    // UUID
  orgId: string;                 // UUID
  teamConnections: SparkTeamConnection[];  // 2+ teams involved
  summary: string;               // AI-generated one-line connection description
  details: string;               // AI-generated longer explanation (2-3 sentences)
  suggestedAction?: string;      // Optional concrete suggestion ("Consider syncing on release timing")
  confidence: number;            // 0-1 float from the detection model
  status: 'active' | 'dismissed' | 'expired';
  contentHash: string;           // Hash of team IDs + summary for dedup across batch cycles
  relatedSummaryIds: string[];   // Which batch summaries triggered this spark
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp — bumped when re-detected in subsequent batch
  expiresAt: string;             // ISO timestamp — 72 hours from creation/last refresh
  dismissedAt?: string;          // ISO timestamp — when dismissed
  dismissedBy?: string;          // userId of who dismissed
}

interface SparkTeamConnection {
  teamId: string;
  teamName: string;
  perspective: string;           // Team-specific framing of the connection
  actionRequired: boolean;       // Whether this team should take action vs. just be aware
  viewedBy: string[];            // userIds who have viewed this spark in detail
}
```

### New table: `sparks` in `server/src/persistence.ts`

```sql
CREATE TABLE IF NOT EXISTS sparks (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  suggestedAction TEXT,
  confidence REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  contentHash TEXT NOT NULL,
  relatedSummaryIds TEXT NOT NULL,  -- JSON array
  teamConnections TEXT NOT NULL,    -- JSON array of SparkTeamConnection
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  dismissedAt TEXT,
  dismissedBy TEXT,
  FOREIGN KEY (orgId) REFERENCES orgs(id)
);

CREATE INDEX idx_sparks_org_status ON sparks(orgId, status);
CREATE INDEX idx_sparks_contentHash ON sparks(contentHash);
CREATE INDEX idx_sparks_expiresAt ON sparks(expiresAt);
```

---

## Pipeline: Spark Detection

### Where it runs

At the end of the existing batch summarization cycle in `server/src/summarizer.ts`. After all per-team summaries are generated, a second Claude API call runs the cross-team analysis.

### Detection prompt structure

The detection call receives:
- All team summaries from the current batch cycle
- Org context (mission, roadmap, team descriptions) — already available from the existing summarizer
- Active sparks (to avoid re-surfacing the same connection)
- Recent dismissed sparks (to avoid re-surfacing connections teams already rejected)

The prompt asks Claude to:
1. Identify 0-N cross-team connections (where N is bounded by the rate limit)
2. For each connection, provide: a one-line summary, a 2-3 sentence detail, optional suggested action, confidence score (0-1), and a per-team perspective that may be asymmetric
3. Classify whether each team's involvement is informational or action-required
4. Return empty array if no meaningful connections exist — explicitly instruct the model that returning nothing is the correct answer when no strong connections are found

### Rate limiting

- Max 1 new spark per campfire per 24-hour rolling window
- If the model detects more connections than the limit allows, select the highest-confidence ones
- Rate limit check happens server-side before persisting — the model can return more candidates than will be surfaced
- Rate limit is per-campfire, not per-org — a 6-campfire org could theoretically have 6 sparks in a day if each campfire is only involved in one

### Deduplication

- Generate a `contentHash` from sorted team IDs + a normalized version of the summary
- Before creating a new spark, check for active sparks with the same team pair
- If an active spark exists for the same team pair and the connection is substantively similar, bump `updatedAt` and `expiresAt` instead of creating a new spark
- "Substantively similar" is determined by the detection prompt — include active sparks for the same team pairs in the prompt context and ask the model to flag if a detected connection is a continuation of an existing spark

### Expiration

- Sparks expire 72 hours after creation (or last refresh via re-detection)
- A background job or check-on-read marks expired sparks as `status: 'expired'`
- Expired sparks remain in the database for the log but are no longer shown in active UI

---

## Server: API Endpoints

### `GET /api/orgs/:orgId/sparks`

Returns active sparks for the org. Used by Campfire Stories to render sparks on the map and in Fireside Updates.

Query params:
- `status` — filter by status (`active`, `dismissed`, `expired`, `all`). Default: `active`
- `teamId` — filter to sparks involving a specific team
- `limit` — max results (default 20)

Response: `{ sparks: Spark[] }`

### `GET /api/orgs/:orgId/sparks/log`

Returns all sparks (active + dismissed + expired) in reverse chronological order. Powers the spark log UI.

Query params:
- `limit` — max results (default 50)
- `before` — cursor-based pagination by `createdAt`

Response: `{ sparks: Spark[], hasMore: boolean }`

### `POST /api/sparks/:sparkId/dismiss`

Dismisses a spark for a specific team. Any team member can dismiss for their whole team.

Request body: `{ teamId: string }`

Behavior:
- Sets `status: 'dismissed'`, `dismissedAt`, `dismissedBy` on the spark
- If the spark connects more than 2 teams, only dismiss for the requesting team's side (future consideration — for v1, dismissing affects the whole spark since we only support 2-team connections)

### `POST /api/sparks/:sparkId/view`

Records that a user has viewed a spark. Updates the `viewedBy` array on the relevant `SparkTeamConnection`.

Request body: `{ teamId: string, userId: string }`

---

## Presentation: Campfire Stories

### Map: Spark arc animation

When a new spark is first detected (not on page load for existing sparks — only for sparks created while the user is viewing the map):

1. A glowing ember particle detaches from campfire A
2. It arcs across the map to campfire B following a parabolic path
3. On arrival, a small flash/burst at campfire B
4. Both campfires receive a persistent small spark icon (lightning bolt glyph, yellow/amber color `#fbbf24` or similar)
5. The arc animation plays once and does not repeat

The persistent spark icon on each campfire remains visible until the spark is dismissed or expires. It should be small enough not to compete with the campfire itself — think of it as a badge, not a feature.

Implementation notes:
- The arc animation uses the existing animation system in `campfire-stories/src/map/`
- Particle follows a quadratic bezier curve between the two campfire world positions
- Use the existing ember/spark particle style from the campfire rendering
- Spark icon is drawn as part of the campfire rendering pass, positioned just above/beside the team name label

### Fireside Updates: Momentary spark entry

When a new spark is detected:
1. A spark entry appears at the top of the Fireside Updates panel
2. Styled distinctly from regular updates — spark/lightning icon, yellow accent text (`#fbbf24`), slightly different background
3. Shows the one-line summary: "⚡ Spark: Payments ↔ Growth — converging on faster payment rollout for new SMBs"
4. The entry fades out after 15 seconds or on the next Fireside Updates refresh cycle, whichever comes first
5. Not persistent — this is a flash of awareness, not a permanent entry

### Campfire detail panel: Persistent spark section

When a user clicks on a campfire that has active sparks:

1. A "Sparks" section appears in the detail panel, above or below the member list
2. Each spark shows:
   - Spark icon + yellow accent styling
   - The team-specific perspective text (asymmetric — what's relevant to *this* team)
   - The suggested action if one exists and `actionRequired` is true for this team
   - If the user is active in this campfire's team: "Visit [other team]'s campfire?" link that triggers the existing cross-team visit flow
   - A dismiss button (small X or "Dismiss" text link)
3. Clicking the spark entry calls `POST /api/sparks/:sparkId/view` to record the view
4. The "Visit their campfire?" prompt is only shown to users who are active members of this team (not visitors)

### Spark log

A "Spark History" section accessible from the Fireside Updates panel (a toggle or small link at the bottom):

1. Shows all sparks in reverse chronological order (active, dismissed, expired)
2. Each entry shows: timestamp, connected teams, one-line summary, status badge (active/dismissed/expired)
3. Dismissed sparks show who dismissed and when
4. Clicking an entry expands to show the full details and suggested action
5. Simple scrollable list, no fancy rendering needed
6. Powered by `GET /api/orgs/:orgId/sparks/log`

---

## SSE Integration

Extend the existing SSE stream (`GET /orgs/:id/summaries/stream`) to include spark events:

```typescript
// New SSE event type
event: spark
data: { spark: Spark, isNew: boolean }
```

- `isNew: true` — triggers the map arc animation and the momentary Fireside Updates entry
- `isNew: false` — sent on initial connection to hydrate existing active sparks (show persistent icons, no animation)

---

## Feature Table

| Feature | Status | Owner | Notes |
| --- | --- | --- | --- |
| Shared: Spark type definition | Not started | — | `shared/src/types.ts` — Spark, SparkTeamConnection |
| Server: sparks table + persistence methods | Not started | — | `server/src/persistence.ts` — CRUD, dedup queries, expiration |
| Server: spark detection prompt | Not started | — | `server/src/summarizer.ts` — second Claude API call after team summaries |
| Server: spark rate limiter | Not started | — | 1 spark/campfire/24h, select highest confidence when over limit |
| Server: spark deduplication | Not started | — | Content hash + active spark check before creation |
| Server: spark expiration | Not started | — | 72h TTL, check-on-read or background cleanup |
| Server: spark API endpoints | Not started | — | GET sparks, GET log, POST dismiss, POST view |
| Server: SSE spark events | Not started | — | Extend existing summary stream with spark event type |
| Campfire Stories: map arc animation | Not started | — | Bezier particle arc between campfires, plays once on new spark |
| Campfire Stories: persistent spark icon on campfires | Not started | — | Yellow lightning badge on campfires with active sparks |
| Campfire Stories: Fireside Updates momentary entry | Not started | — | 15s fade-out spark notification in Fireside Updates panel |
| Campfire Stories: campfire detail spark section | Not started | — | Persistent spark display with dismiss, view tracking, visit prompt |
| Campfire Stories: spark log | Not started | — | Historical log in Fireside Updates, all statuses, scrollable |

---

## Implementation Order

Recommended sequence for Claude Code agents:

1. **Types first** — Add Spark and SparkTeamConnection to shared types
2. **Persistence** — Create sparks table, write CRUD methods, dedup and expiration queries
3. **Detection pipeline** — Add cross-team analysis call to summarizer, implement rate limiter and dedup logic
4. **API endpoints** — Wire up GET/POST routes, auth checks
5. **SSE extension** — Add spark event type to existing stream
6. **Campfire detail panel** — Persistent spark section with dismiss and view tracking (simplest UI, validates pipeline)
7. **Spark log** — Historical log view in Fireside Updates
8. **Fireside Updates momentary entry** — Timed fade-out notification
9. **Map arc animation** — The visual payoff, built last once everything else works

Steps 1-5 are the pipeline. Steps 6-9 are the presentation. The pipeline should be validated (manually review generated sparks for quality) before investing in presentation work.

---

## Prompt Engineering Notes

The spark detection prompt should:

- Emphasize that returning zero sparks is the correct answer most of the time
- Include examples of what constitutes a real connection vs. superficial overlap (e.g., "both teams use TypeScript" is NOT a spark; "both teams are modifying the same billing API" IS a spark)
- Include the org roadmap so it can identify connections that align with strategic priorities
- Include recently dismissed sparks so it avoids re-surfacing rejected connections
- Ask for asymmetric perspectives — what this connection means specifically to each team
- Request confidence scores with calibration guidance: 0.9+ means "these teams need to talk," 0.7-0.9 means "interesting overlap worth noting," below 0.7 don't return it

---

## Security Considerations

- Spark dismiss and view endpoints require authentication and org membership
- Users can only dismiss sparks for teams they belong to
- The spark detection prompt inherits the same prompt injection defenses from Sprint 11 (control char stripping, field length caps) since it consumes team summaries which derive from user-generated transcript content
- Spark summaries are AI-generated, not raw user input, so injection risk is lower but still present in the pipeline

---

## Deferred

- Spark notifications outside Campfire Stories (email digest, Slack integration)
- Multi-team sparks (3+ teams connected) — v1 is strictly pairwise
- Spark categories exposed in UI (synergy/collision/dependency) — model tags internally but UI just shows natural language
- Spark analytics dashboard (which sparks led to visits, dismiss rates, etc.)
- Spark detection tuning based on dismiss history (feeding dismissed examples back into prompt)
