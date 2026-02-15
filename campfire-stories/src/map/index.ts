import type {
  Org,
  Team,
  Summary,
  User,
  AwarenessState,
  ActivityEvent,
  Spark,
} from '@campfires/shared';
import {
  PIXEL_SCALE,
  drawCampfire,
  drawTeamLabel,
  drawVignette,
  computeDayNight,
  drawDayNightOverlay,
  drawStars,
  drawPulseRing,
  drawSparkArc,
  drawSparkBadge,
} from './renderer.js';
import {
  drawGround,
  drawPath,
  drawTree,
  drawWorkstation,
  generateEnvironment,
  type EnvironmentData,
} from './environment.js';
import {
  layoutCampfires,
  layoutSprites,
  type CampfirePosition,
  type SpriteData,
} from './layout.js';
import {
  drawHumanSprite,
  drawGolemSprite,
  drawStrikeSprite,
  drawTossSprite,
  drawFloatingText,
  cleanupFloatingTexts,
  drawGolemSpawn,
  drawDespawnParticles,
  drawCastingSprite,
  drawActivityGlow,
  drawAfterimages,
  drawCarryingOrb,
  drawGolemIdle,
  drawMilestoneCelebration,
  createMilestoneCelebration,
  isMilestoneExpired,
  type FloatingText,
  type MilestoneCelebration,
} from './sprites.js';
import {
  type Camera,
  createCamera,
  screenToWorld,
  clampCamera,
  applyCameraTransform,
  lerpCamera,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_SPEED,
  ZOOM_LERP,
  PAN_SPEED,
} from './camera.js';
import {
  type AnimatedSprite,
  type SpriteRenderState,
  tickSprite,
  getSpriteRenderState,
  reconcileSprites,
} from './animations.js';
import {
  type CampfireFireState,
  type FireFlare,
  type PulseState,
  createFireState,
  createFireFlare,
  createPulseState,
  getFireMultipliers,
  tickFireState,
  tickPulses,
  triggerFireFlare,
  computeFireLevel,
  setFireLevel,
} from './fire-state.js';
import {
  COMMIT_WALK_DURATION,
  COMMIT_TOSS_DURATION,
  FILE_SAVE_DURATION,
  BRANCH_WALK_DURATION,
  COMMIT_FLARE_MULT,
  FIRE_LEVEL_WINDOW,
  SESSION_ENTER_DURATION,
  SESSION_EXIT_DURATION,
  SPAWN_TOTAL,
  DESPAWN_WALK_DURATION,
  DESPAWN_DISSOLVE_DURATION,
  GOLEM_SPEED_MULT,
  AFTERIMAGE_DURATION,
  GOLEM_GLOW_WINDOW,
  SPARK_ARC_DURATION,
  SPARK_BADGE_PERSIST,
} from './animation-constants.js';
import { ActivityFeed } from './activity-feed.js';

function esc(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export interface MapViewConfig {
  org: Org;
  teams: Team[];
  summaries: Summary[];
  sparks: Spark[];
  members: Map<string, User[]>;
  awareness: Map<string, AwarenessState[]>;
  serverUrl: string;
  homeTeamId?: string;
  onTeamSelect?: (teamId: string) => void;
}

interface SparkArcState {
  spark: Spark;
  startTime: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export class MapView {
  private container: HTMLElement;
  private config: MapViewConfig;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tooltip!: HTMLElement;
  private animFrameId: number | null = null;

  private campfires: CampfirePosition[] = [];
  private allSprites: SpriteData[] = [];
  private environment!: EnvironmentData;
  private hoveredSprite: SpriteData | null = null;
  private logsPanel!: HTMLElement;
  private currentPanelTeamId: string | null = null;
  private panelPollInterval: ReturnType<typeof setInterval> | null = null;

  // Animation system state
  private animatedSprites = new Map<string, AnimatedSprite>();
  private fireStates: CampfireFireState[] = [];
  private fireFlares: FireFlare[] = [];
  private pulseStates: PulseState[] = [];
  private floatingTexts: FloatingText[] = [];
  private activityFeed = new ActivityFeed();
  private lastRenderTime = 0;
  private recentEvents: { teamId: string; timestamp: number }[] = [];
  private milestones: MilestoneCelebration[] = [];
  private castingSprites = new Set<string>(); // userId of humans currently casting for golem spawn
  private sparkArcs: SparkArcState[] = [];
  private sparkBadges = new Map<string, number>(); // teamId → badge start time

  // Map dimensions in pixel-art units
  private mapWidth = 500;
  private mapHeight = 280;

  // Camera state
  private camera!: Camera;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragCameraStartX = 0;
  private dragCameraStartY = 0;
  private dragDistance = 0;
  private resetTarget: { x: number; y: number; zoom: number } | null = null;
  private zoomTarget = 1.0;
  private zoomAnchorScreen: { x: number; y: number } | null = null;
  private keysDown = new Set<string>();

  constructor(container: HTMLElement, config: MapViewConfig) {
    this.container = container;
    this.config = config;
  }

  start(): void {
    this.buildDOM();
    this.computeLayout();
    this.environment = generateEnvironment(this.mapWidth, this.mapHeight, this.campfires);
    this.camera = createCamera(this.mapWidth, this.mapHeight);
    this.zoomTarget = this.camera.zoom;
    this.initFireStates();
    this.attachEvents();
    this.activityFeed.start(this.config.teams, this.config.serverUrl, (events) =>
      this.handleActivityEvents(events),
    );

    // Set initial spark badges from config (no arc animation)
    const now = performance.now() / 1000;
    for (const spark of this.config.sparks) {
      if (spark.status !== 'active') continue;
      for (const tc of spark.teamConnections) {
        if (!this.sparkBadges.has(tc.teamId)) {
          this.sparkBadges.set(tc.teamId, now);
        }
      }
    }

    this.render(0);

    // Debug helper for manual event injection
    (window as unknown as Record<string, unknown>).__simulateEvent = (
      type: 'file_save' | 'commit' | 'branch_switch' | 'session_start' | 'session_end',
      userId?: string,
      message?: string,
    ) => {
      // Pick first available sprite if no userId given
      const targetId = userId || this.animatedSprites.keys().next().value;
      if (!targetId) return;
      const sprite = this.animatedSprites.get(targetId);
      if (!sprite) return;

      const event: ActivityEvent = {
        id: `debug-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: targetId,
        userType: sprite.type === 'agent' ? 'agent' : 'human',
        parentUserId: null,
        teamId: this.campfires[sprite.campfireIndex]?.teamId || '',
        type,
        file: null,
        branch: null,
        message: message || `debug ${type}`,
        metadata: null,
        sessionId: null,
      };
      this.handleActivityEvents([event]);
    };

    // Debug helper for milestone celebrations
    (window as unknown as Record<string, unknown>).__simulateMilestone = (teamIndex?: number) => {
      const cf = this.campfires[teamIndex ?? 0];
      if (cf) this.triggerMilestone(cf.teamId);
    };
  }

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.activityFeed.stop();
    if (this.panelPollInterval) {
      clearInterval(this.panelPollInterval);
      this.panelPollInterval = null;
    }
  }

  updateSummaries(newSummaries: Summary[]): void {
    this.config.summaries = [...newSummaries, ...this.config.summaries];
    // Recompute fire sizes
    this.campfires = layoutCampfires(
      this.config.teams,
      this.config.summaries,
      this.mapWidth,
      this.mapHeight,
    );
    // Update summary bar
    this.renderSummaryBar();
  }

  updateAwareness(awareness: Map<string, AwarenessState[]>): void {
    this.config.awareness = awareness;
    this.computeSprites();
    this.animatedSprites = reconcileSprites(this.animatedSprites, this.allSprites, this.campfires);
  }

  private buildDOM(): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'map-canvas-container';

    this.canvas = document.createElement('canvas');
    wrapper.appendChild(this.canvas);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'map-tooltip';
    wrapper.appendChild(this.tooltip);

    // AI Summary bar
    const summaryBar = document.createElement('div');
    summaryBar.className = 'map-summary-bar';
    summaryBar.id = 'map-summary-bar';
    wrapper.appendChild(summaryBar);

    // Logs panel (bottom-right, team detail)
    this.logsPanel = document.createElement('div');
    this.logsPanel.className = 'map-logs-panel';
    wrapper.appendChild(this.logsPanel);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.innerHTML = `
      <div class="map-legend-title">LEGEND</div>
      <div class="map-legend-item"><div class="map-legend-swatch" style="background:#e8d070"></div> Human (active)</div>
      <div class="map-legend-item"><div class="map-legend-swatch" style="background:#6088a0"></div> Human (idle)</div>
      <div class="map-legend-item"><div class="map-legend-swatch" style="background:#505858"></div> Human (draft)</div>
      <div class="map-legend-item"><div class="map-legend-swatch" style="background:#88a8c8; border: 1px solid #a0c0e0"></div> Agent / Golem</div>
      <div class="map-legend-item"><div class="map-legend-swatch" style="background:#58a6ff"></div> Visitor</div>
      <div class="map-legend-item"><div class="map-legend-swatch" style="background:#f97316; border-radius:50%"></div> Campfire</div>
    `;
    wrapper.appendChild(legend);

    // Reset view button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'map-reset-btn';
    resetBtn.textContent = '\u2302 RESET VIEW';
    resetBtn.addEventListener('click', () => {
      this.resetTarget = {
        x: this.mapWidth / 2,
        y: this.mapHeight / 2,
        zoom: 1.0,
      };
      this.zoomTarget = 1.0;
    });
    wrapper.appendChild(resetBtn);

    this.container.appendChild(wrapper);

    this.resize();
    this.renderSummaryBar();

    // Show home team logs or placeholder
    if (this.config.homeTeamId) {
      this.renderLogsPanel(this.config.homeTeamId);
    } else {
      this.logsPanel.innerHTML = `
        <div class="logs-panel-header">
          <span class="logs-panel-title">\u2726 LOGS</span>
        </div>
        <div class="logs-panel-body">
          <div class="logs-panel-placeholder">Click a campfire to view its logs</div>
        </div>
      `;
    }
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context');
    this.ctx = ctx;

    // Adjust map dimensions based on canvas size
    this.mapWidth = Math.floor(this.canvas.width / PIXEL_SCALE);
    this.mapHeight = Math.floor(this.canvas.height / PIXEL_SCALE);
  }

  private computeLayout(): void {
    this.campfires = layoutCampfires(
      this.config.teams,
      this.config.summaries,
      this.mapWidth,
      this.mapHeight,
    );
    this.computeSprites();
  }

  private computeSprites(): void {
    this.allSprites = [];
    for (let i = 0; i < this.campfires.length; i++) {
      const cf = this.campfires[i];
      const members = this.config.members.get(cf.teamId) || [];
      const awareness = this.config.awareness.get(cf.teamId) || [];
      this.allSprites.push(...layoutSprites(cf, members, awareness, i));
    }
  }

  private renderSummaryBar(): void {
    const bar = this.container.querySelector('#map-summary-bar');
    if (!bar) return;

    bar.innerHTML = '<div class="map-summary-title">\u2726 CAMPFIRE STORIES</div>';

    // Show latest summary per team
    for (const cf of this.campfires) {
      const teamSummaries = this.config.summaries
        .filter((s) => s.teamId === cf.teamId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const latest = teamSummaries[0];
      if (!latest) continue;

      const line = document.createElement('div');
      line.className = 'map-summary-line';
      line.innerHTML = `
        <span class="team-dot" style="background:${esc(cf.color)}"></span>
        <span><strong>${esc(cf.name)}</strong> \u2014 ${esc(latest.oneLiner || 'Activity recorded')}</span>
      `;
      bar.appendChild(line);
    }
  }

  private attachEvents(): void {
    // Resize
    const resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.computeLayout();
      this.environment = generateEnvironment(this.mapWidth, this.mapHeight, this.campfires);
      this.camera = createCamera(this.mapWidth, this.mapHeight);
      this.zoomTarget = this.camera.zoom;
      this.initFireStates();
    });
    const parentEl = this.canvas.parentElement;
    if (parentEl) resizeObserver.observe(parentEl);

    // Wheel: smooth zoom toward cursor
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAnchorScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
        this.zoomTarget = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoomTarget + delta));
        this.resetTarget = null;
      },
      { passive: false },
    );

    // Keyboard: arrow keys pan, +/- zoom, Home resets
    window.addEventListener('keydown', (e) => {
      const key = e.key;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '=', '-', 'Home'].includes(key)
      ) {
        e.preventDefault();
        this.keysDown.add(key);
        if (key === 'Home') {
          this.resetTarget = {
            x: this.mapWidth / 2,
            y: this.mapHeight / 2,
            zoom: 1.0,
          };
          this.zoomTarget = 1.0;
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key);
    });

    // Mousedown: start drag
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragCameraStartX = this.camera.x;
      this.dragCameraStartY = this.camera.y;
      this.dragDistance = 0;
      this.canvas.style.cursor = 'grabbing';
    });

    // Mousemove: drag pan + hover
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.dragDistance = Math.hypot(dx, dy);

        this.camera.x = this.dragCameraStartX - dx / (this.camera.zoom * PIXEL_SCALE);
        this.camera.y = this.dragCameraStartY - dy / (this.camera.zoom * PIXEL_SCALE);
        this.camera = clampCamera(
          this.camera,
          this.mapWidth,
          this.mapHeight,
          this.canvas.width,
          this.canvas.height,
          PIXEL_SCALE,
        );
        this.resetTarget = null;
        return;
      }

      // Hover: convert to world coords
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { wx, wy } = screenToWorld(
        mx,
        my,
        this.camera,
        this.canvas.width,
        this.canvas.height,
        PIXEL_SCALE,
      );

      this.hoveredSprite = null;
      for (const sprite of this.animatedSprites.values()) {
        if (!sprite.visible) continue;
        const rs = getSpriteRenderState(sprite);
        if (Math.hypot(wx - rs.x, wy - rs.y) < 20 / (this.camera.zoom * PIXEL_SCALE)) {
          // Convert to SpriteData for tooltip
          this.hoveredSprite = {
            userId: sprite.userId,
            name: sprite.name,
            type: sprite.type,
            color: sprite.color,
            status: sprite.status,
            task: sprite.defaultTask,
            file: sprite.file,
            parentName: sprite.parentName,
            teamName: sprite.teamName,
            px: rs.x,
            py: rs.y,
            homeX: sprite.homeX,
            homeY: sprite.homeY,
            campfireIndex: sprite.campfireIndex,
          };
          break;
        }
      }

      if (this.hoveredSprite) {
        this.tooltip.style.display = 'block';
        this.tooltip.style.left =
          e.clientX - this.container.getBoundingClientRect().left + 16 + 'px';
        this.tooltip.style.top = e.clientY - this.container.getBoundingClientRect().top - 10 + 'px';

        const s = this.hoveredSprite;
        const typeLabel =
          s.type === 'agent'
            ? `\u2699 Agent${s.parentName ? ` \u00b7 owned by ${s.parentName}` : ''}`
            : `\u25C6 ${s.status}`;

        this.tooltip.innerHTML = `
          <div class="tt-name" style="color:${esc(s.color)}">${esc(s.name)}</div>
          <div class="tt-role">${esc(typeLabel)} \u00b7 ${esc(s.teamName)}</div>
          <div class="tt-detail">${esc(s.file || s.task)}</div>
        `;
      } else {
        this.tooltip.style.display = 'none';
      }
    });

    // Mouseup: end drag
    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredSprite = null;
      this.tooltip.style.display = 'none';
    });

    // Click campfire to update logs panel (suppress if dragged)
    this.canvas.addEventListener('click', (e) => {
      if (this.dragDistance > 5) return;

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { wx, wy } = screenToWorld(
        mx,
        my,
        this.camera,
        this.canvas.width,
        this.canvas.height,
        PIXEL_SCALE,
      );

      for (const cf of this.campfires) {
        const hitRadius = cf.fireSize * 6 + 10;
        if (Math.hypot(wx - cf.x, wy - cf.y) < hitRadius) {
          this.renderLogsPanel(cf.teamId);
          return;
        }
      }
    });
  }

  private renderLogsPanel(teamId: string): void {
    if (teamId === this.currentPanelTeamId) return;
    this.currentPanelTeamId = teamId;

    // Clear previous poll
    if (this.panelPollInterval) {
      clearInterval(this.panelPollInterval);
      this.panelPollInterval = null;
    }

    // Loading state
    const cf = this.campfires.find((c) => c.teamId === teamId);
    const teamName = cf?.name || 'Team';
    const teamColor = cf?.color || '#f0883e';

    const showHomeBtn = this.config.homeTeamId && teamId !== this.config.homeTeamId;

    this.logsPanel.innerHTML = `
      <div class="logs-panel-header">
        ${showHomeBtn ? '<button class="logs-panel-home-btn">\u2302 HOME</button>' : ''}
        <span class="logs-panel-title"><span class="team-dot" style="background:${esc(teamColor)}"></span> ${esc(teamName)}</span>
      </div>
      <div class="logs-panel-body"><div class="logs-panel-loading">Loading...</div></div>
    `;

    // Wire home button
    if (showHomeBtn) {
      const homeBtn = this.logsPanel.querySelector('.logs-panel-home-btn');
      if (homeBtn && this.config.homeTeamId) {
        const homeTeamId = this.config.homeTeamId;
        homeBtn.addEventListener('click', () => {
          this.currentPanelTeamId = null; // force re-render
          this.renderLogsPanel(homeTeamId);
        });
      }
    }

    // Fetch and populate
    this.fetchPanelData(teamId);

    // Poll for fresh data every 10s
    this.panelPollInterval = setInterval(() => {
      this.fetchPanelData(teamId);
    }, 10000);
  }

  private async fetchPanelData(teamId: string): Promise<void> {
    try {
      const [membersRes, awarenessRes, summariesRes, sparksRes] = await Promise.all([
        fetch(`${this.config.serverUrl}/api/teams/${teamId}/members`),
        fetch(`${this.config.serverUrl}/api/teams/${teamId}/awareness`),
        fetch(`${this.config.serverUrl}/api/orgs/${this.config.org.orgId}/summaries`),
        fetch(
          `${this.config.serverUrl}/api/orgs/${this.config.org.orgId}/sparks?teamId=${teamId}&status=active`,
        ),
      ]);

      const members: User[] = membersRes.ok ? await membersRes.json() : [];
      const awareness: AwarenessState[] = awarenessRes.ok ? await awarenessRes.json() : [];
      const allSummaries: Summary[] = summariesRes.ok ? await summariesRes.json() : [];
      let teamSparks: Spark[] = [];
      if (sparksRes.ok) {
        const sparksData = await sparksRes.json();
        teamSparks = sparksData.sparks || [];
      }
      const teamSummaries = allSummaries
        .filter((s) => s.teamId === teamId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latest = teamSummaries[0];

      // Guard: panel may have switched while fetching
      if (this.currentPanelTeamId !== teamId) return;

      const onlineCount = awareness.filter(
        (a) => a.status === 'active' || a.status === 'idle',
      ).length;

      const statusDot = (status: string) => {
        const colors: Record<string, string> = {
          active: '#3fb950',
          idle: '#d29922',
          draft: '#6e7681',
          visitor: '#58a6ff',
          offline: '#484f58',
        };
        return `<span class="panel-status-dot" style="background:${colors[status] || '#484f58'}"></span>`;
      };

      const body = this.logsPanel.querySelector('.logs-panel-body');
      if (!body) return;

      // Summary section
      const summaryHtml = latest
        ? `<div class="panel-summary">
            <div class="panel-summary-oneliner">${esc(latest.oneLiner || 'Activity recorded')}</div>
            ${latest.content ? `<div class="panel-summary-content">${esc(latest.content.slice(0, 200))}${latest.content.length > 200 ? '...' : ''}</div>` : ''}
            <div class="panel-summary-meta">${new Date(latest.createdAt).toLocaleString()}</div>
          </div>`
        : '<div class="panel-no-summary">No logs yet</div>';

      // Members section
      const membersHtml = members
        .map((m) => {
          const a = awareness.find((s) => s.userId === m.userId);
          const status = a?.status || 'offline';
          return `<div class="panel-member">${statusDot(status)}<span class="panel-member-dot" style="background:${esc(m.avatarColor)}"></span>${esc(m.displayName)}</div>`;
        })
        .join('');

      // Visitors
      const visitorsHtml = awareness
        .filter((a) => a.homeTeamId && !members.find((m) => m.userId === a.userId))
        .map(
          (a) =>
            `<div class="panel-member">${statusDot('visitor')}<span class="panel-member-dot" style="background:${esc(a.color)}"></span>${esc(a.displayName)}</div>`,
        )
        .join('');

      // Sparks section
      const sparksHtml =
        teamSparks.length > 0
          ? `<div class="panel-sparks">${teamSparks
              .map((spark) => {
                const otherTeams = spark.teamConnections
                  .filter((tc: { teamId: string }) => tc.teamId !== teamId)
                  .map((tc: { teamName: string }) => esc(tc.teamName))
                  .join(', ');
                const myPerspective = spark.teamConnections.find(
                  (tc: { teamId: string }) => tc.teamId === teamId,
                );
                return `<div class="panel-spark-entry">
              <span class="spark-icon">\u26A1</span> <strong>${otherTeams}</strong>
              <div class="spark-perspective">${esc(myPerspective?.perspective || spark.summary)}</div>
              ${spark.suggestedAction && myPerspective?.actionRequired ? `<div class="spark-action">\u2192 ${esc(spark.suggestedAction)}</div>` : ''}
            </div>`;
              })
              .join('')}</div>`
          : '';

      body.innerHTML = `
        ${sparksHtml}
        ${summaryHtml}
        <div class="panel-stats">${members.length} member${members.length !== 1 ? 's' : ''} \u00b7 ${onlineCount} online</div>
        <div class="panel-members">${membersHtml}${visitorsHtml}</div>
      `;
    } catch {
      const body = this.logsPanel.querySelector('.logs-panel-body');
      if (body) body.innerHTML = '<div class="panel-error">Failed to load</div>';
    }
  }

  private initFireStates(): void {
    this.fireStates = this.campfires.map(() => createFireState());
    this.fireFlares = this.campfires.map(() => createFireFlare());
    this.pulseStates = this.campfires.map(() => createPulseState());
    // Initialize animated sprites from layout
    this.animatedSprites = reconcileSprites(new Map(), this.allSprites, this.campfires);
  }

  private handleActivityEvents(events: ActivityEvent[]): void {
    const now = Date.now();
    const time = performance.now() / 1000;

    for (const event of events) {
      // Track for fire level computation
      const cfIndex = this.campfires.findIndex((cf) => cf.teamId === event.teamId);
      if (cfIndex === -1) continue;

      this.recentEvents.push({ teamId: event.teamId, timestamp: now });

      const sprite = this.animatedSprites.get(event.userId);

      switch (event.type) {
        case 'file_save':
          this.handleFileSave(sprite, time);
          break;
        case 'commit':
          this.handleCommit(sprite, cfIndex, event.message || 'commit');
          break;
        case 'branch_switch':
          this.handleBranchSwitch(sprite, cfIndex);
          break;
        case 'session_start':
          this.handleSessionStart(event.userId, cfIndex, event.userType);
          break;
        case 'session_end':
          this.handleSessionEnd(event.userId, cfIndex, event.userType);
          break;
      }
    }

    // Prune old events and recalculate fire levels
    this.recentEvents = this.recentEvents.filter((e) => now - e.timestamp < FIRE_LEVEL_WINDOW);
    this.updateFireLevels();
  }

  private handleFileSave(sprite: AnimatedSprite | undefined, time: number): void {
    if (!sprite) return;

    // Golem-specific: faster strike, track orb brightness
    const speedMult = sprite.type === 'agent' ? GOLEM_SPEED_MULT : 1;
    sprite.animQueue.push({
      type: 'file_save_strike',
      duration: FILE_SAVE_DURATION / speedMult,
      elapsed: 0,
    });

    // Track for activity glow (PR3)
    sprite.recentEventTimes.push(time);
    if (sprite.type === 'agent') {
      sprite.orbSaveCount++;
      sprite.orbBrightness = Math.min(1, 0.1 + sprite.orbSaveCount * 0.2);
    }
  }

  private handleCommit(
    sprite: AnimatedSprite | undefined,
    campfireIndex: number,
    message: string,
  ): void {
    if (!sprite) return;

    const cf = this.campfires[campfireIndex];
    if (!cf) return;

    const time = performance.now() / 1000;
    const speedMult = sprite.type === 'agent' ? GOLEM_SPEED_MULT : 1;
    const walkDuration = COMMIT_WALK_DURATION / speedMult;

    // Walk to campfire → toss → walk back
    const startX = sprite.homeX;
    const startY = sprite.homeY;

    sprite.animQueue.push({
      type: 'walk',
      duration: walkDuration,
      elapsed: 0,
      startX,
      startY,
      endX: cf.x,
      endY: cf.y + 5,
    });

    sprite.animQueue.push({
      type: 'commit_toss',
      duration: COMMIT_TOSS_DURATION,
      elapsed: 0,
      message,
    });

    sprite.animQueue.push({
      type: 'walk',
      duration: walkDuration,
      elapsed: 0,
      startX: cf.x,
      startY: cf.y + 5,
      endX: startX,
      endY: startY,
    });

    // Floating text
    const shortMsg = message.length > 30 ? message.slice(0, 27) + '...' : message;
    this.floatingTexts.push({
      text: shortMsg,
      x: cf.x,
      y: cf.y - 15,
      startTime: time + walkDuration,
      color: '#f0e8c0',
    });

    // Fire flare — golems with bright orbs get stronger flares
    const flareMult =
      sprite.type === 'agent' ? COMMIT_FLARE_MULT + sprite.orbBrightness * 0.3 : COMMIT_FLARE_MULT;
    triggerFireFlare(this.fireFlares, campfireIndex, flareMult, time);

    // Track activity and reset orb (PR3)
    sprite.recentEventTimes.push(time);
    if (sprite.type === 'agent') {
      sprite.orbBrightness = 0.1;
      sprite.orbSaveCount = 0;
    }
  }

  private handleBranchSwitch(sprite: AnimatedSprite | undefined, campfireIndex: number): void {
    if (!sprite || sprite.campfireIndex !== campfireIndex) return;

    // Recompute home position from current layout data
    const layoutSprite = this.allSprites.find((s) => s.userId === sprite.userId);
    if (!layoutSprite) return;

    const newHomeX = layoutSprite.homeX;
    const newHomeY = layoutSprite.homeY;

    // Walk to new position
    sprite.animQueue.push({
      type: 'walk',
      duration: BRANCH_WALK_DURATION,
      elapsed: 0,
      startX: sprite.homeX,
      startY: sprite.homeY,
      endX: newHomeX,
      endY: newHomeY,
      onComplete: () => {
        sprite.homeX = newHomeX;
        sprite.homeY = newHomeY;
      },
    });
  }

  private updateFireLevels(): void {
    for (let i = 0; i < this.campfires.length; i++) {
      const teamId = this.campfires[i].teamId;
      const count = this.recentEvents.filter((e) => e.teamId === teamId).length;
      const newLevel = computeFireLevel(count);
      setFireLevel(this.fireStates[i], newLevel);
    }
  }

  // ── PR2: Session enter/exit ──

  private getMapEdgePoint(homeX: number, homeY: number): { x: number; y: number } {
    // Find nearest edge perpendicular to home position
    const distTop = homeY;
    const distBottom = this.mapHeight - homeY;
    const distLeft = homeX;
    const distRight = this.mapWidth - homeX;
    const minDist = Math.min(distTop, distBottom, distLeft, distRight);

    if (minDist === distTop) return { x: homeX, y: -10 };
    if (minDist === distBottom) return { x: homeX, y: this.mapHeight + 10 };
    if (minDist === distLeft) return { x: -10, y: homeY };
    return { x: this.mapWidth + 10, y: homeY };
  }

  private handleSessionStart(
    userId: string,
    campfireIndex: number,
    userType: 'human' | 'agent',
  ): void {
    const sprite = this.animatedSprites.get(userId);
    if (!sprite) return;

    const cf = this.campfires[campfireIndex];
    if (!cf) return;

    if (userType === 'agent') {
      // Golem spawn: 5-phase spark animation
      this.handleGolemSpawn(sprite, campfireIndex);
    } else {
      // Human: walk in from map edge with fade-in
      const edge = this.getMapEdgePoint(sprite.homeX, sprite.homeY);
      sprite.animQueue.push({
        type: 'walk',
        duration: SESSION_ENTER_DURATION,
        elapsed: 0,
        startX: edge.x,
        startY: edge.y,
        endX: sprite.homeX,
        endY: sprite.homeY,
        fadeIn: true,
      });
    }
  }

  private handleSessionEnd(
    userId: string,
    campfireIndex: number,
    userType: 'human' | 'agent',
  ): void {
    const sprite = this.animatedSprites.get(userId);
    if (!sprite) return;

    const cf = this.campfires[campfireIndex];
    if (!cf) return;

    if (userType === 'agent') {
      // Golem despawn: walk to edge fast, then dissolve
      this.handleGolemDespawn(sprite, campfireIndex);
    } else {
      // Human: walk to map edge with fade-out
      const edge = this.getMapEdgePoint(sprite.homeX, sprite.homeY);
      sprite.animQueue.push({
        type: 'walk',
        duration: SESSION_EXIT_DURATION,
        elapsed: 0,
        startX: sprite.homeX,
        startY: sprite.homeY,
        endX: edge.x,
        endY: edge.y,
        fadeOut: true,
      });
    }
  }

  private handleGolemSpawn(sprite: AnimatedSprite, campfireIndex: number): void {
    const cf = this.campfires[campfireIndex];
    if (!cf) return;

    // Find the owner human for casting pose
    const owner = sprite.parentName
      ? [...this.animatedSprites.values()].find((s) => s.name === sprite.parentName)
      : undefined;

    sprite.isSpawning = true;
    sprite.animQueue.push({
      type: 'golem_spawn',
      duration: SPAWN_TOTAL,
      elapsed: 0,
      fireX: cf.x,
      fireY: cf.y,
      targetX: sprite.homeX,
      targetY: sprite.homeY,
      ownerX: owner?.homeX ?? cf.x + 15,
      ownerY: owner?.homeY ?? cf.y,
    });

    // Set owner to casting pose during spawn
    if (owner) {
      this.castingSprites.add(owner.userId);
      setTimeout(() => {
        this.castingSprites.delete(owner.userId);
      }, SPAWN_TOTAL * 1000);
    }
  }

  private handleGolemDespawn(sprite: AnimatedSprite, campfireIndex: number): void {
    const cf = this.campfires[campfireIndex];
    if (!cf) return;

    // Walk to edge fast, then dissolve
    const edge = this.getMapEdgePoint(sprite.homeX, sprite.homeY);
    sprite.animQueue.push({
      type: 'walk',
      duration: DESPAWN_WALK_DURATION,
      elapsed: 0,
      startX: sprite.homeX,
      startY: sprite.homeY,
      endX: edge.x,
      endY: edge.y,
    });

    sprite.animQueue.push({
      type: 'golem_despawn',
      duration: DESPAWN_DISSOLVE_DURATION,
      elapsed: 0,
      fireX: cf.x,
      fireY: cf.y,
    });

    // Fire flare on despawn
    const time = performance.now() / 1000;
    triggerFireFlare(this.fireFlares, campfireIndex, 1.0, time);
  }

  // ── PR3: Milestone trigger ──

  triggerMilestone(teamId: string): void {
    const cfIndex = this.campfires.findIndex((cf) => cf.teamId === teamId);
    if (cfIndex === -1) return;
    const cf = this.campfires[cfIndex];
    const time = performance.now() / 1000;
    this.milestones.push(createMilestoneCelebration(cf.x, cf.y, cf.fireSize, cf.color, time));
  }

  triggerSparkArc(spark: Spark): void {
    if (spark.teamConnections.length < 2) return;

    const time = performance.now() / 1000;
    const tc0 = spark.teamConnections[0];
    const tc1 = spark.teamConnections[1];

    const cf0 = this.campfires.find((c) => c.teamId === tc0.teamId);
    const cf1 = this.campfires.find((c) => c.teamId === tc1.teamId);
    if (!cf0 || !cf1) return;

    this.sparkArcs.push({
      spark,
      startTime: time,
      fromX: cf0.x,
      fromY: cf0.y,
      toX: cf1.x,
      toY: cf1.y,
    });

    // Set spark badges on both campfires
    this.sparkBadges.set(tc0.teamId, time);
    this.sparkBadges.set(tc1.teamId, time);

    // Floating text at arc midpoint
    const midX = (cf0.x + cf1.x) / 2;
    const midY = (cf0.y + cf1.y) / 2 - 20;
    const shortSummary =
      spark.summary.length > 40 ? spark.summary.slice(0, 37) + '...' : spark.summary;
    this.floatingTexts.push({
      text: `\u26A1 ${shortSummary}`,
      x: midX,
      y: midY,
      startTime: time,
      color: '#fbbf24',
    });
  }

  private render = (timestamp: number): void => {
    const time = timestamp / 1000;
    const dt = this.lastRenderTime > 0 ? time - this.lastRenderTime : 0.016;
    this.lastRenderTime = time;
    const { ctx, canvas } = this;

    // Tick animation systems
    tickFireState(this.fireStates, this.fireFlares, dt, time);
    tickPulses(this.pulseStates, this.fireStates, this.campfires, time);
    for (const sprite of this.animatedSprites.values()) {
      tickSprite(sprite, dt);

      // Track afterimages for walking golems (PR3)
      if (sprite.type === 'agent' && sprite.currentAnim?.type === 'walk') {
        const rs = getSpriteRenderState(sprite);
        sprite.afterimages.push({ x: rs.x, y: rs.y, time });
      }
      // Prune old afterimages
      sprite.afterimages = sprite.afterimages.filter((a) => time - a.time < AFTERIMAGE_DURATION);
      if (!sprite.currentAnim || sprite.currentAnim.type !== 'walk') {
        sprite.afterimages.length = 0;
      }
      // Prune old activity events (PR3)
      sprite.recentEventTimes = sprite.recentEventTimes.filter((t) => time - t < GOLEM_GLOW_WINDOW);
      // Update golem idle state
      if (sprite.type === 'agent') {
        sprite.isGolemIdle = sprite.recentEventTimes.length === 0;
      }
      // Clear spawning flag when spawn animation finishes
      if (sprite.isSpawning && !sprite.currentAnim && sprite.animQueue.length === 0) {
        sprite.isSpawning = false;
      }
    }
    cleanupFloatingTexts(this.floatingTexts, time);
    // Cleanup expired milestones
    this.milestones = this.milestones.filter((m) => !isMilestoneExpired(m, time));

    // Animate reset if active
    if (this.resetTarget) {
      this.camera = lerpCamera(
        this.camera,
        this.resetTarget.x,
        this.resetTarget.y,
        this.resetTarget.zoom,
        0.08,
      );
      this.zoomTarget = this.resetTarget.zoom;
      const dx = Math.abs(this.camera.x - this.resetTarget.x);
      const dy = Math.abs(this.camera.y - this.resetTarget.y);
      const dz = Math.abs(this.camera.zoom - this.resetTarget.zoom);
      if (dx < 0.1 && dy < 0.1 && dz < 0.005) {
        this.camera.x = this.resetTarget.x;
        this.camera.y = this.resetTarget.y;
        this.camera.zoom = this.resetTarget.zoom;
        this.resetTarget = null;
      }
    }

    // Smooth zoom toward target
    if (Math.abs(this.camera.zoom - this.zoomTarget) > 0.002) {
      const anchor = this.zoomAnchorScreen || {
        x: canvas.width / 2,
        y: canvas.height / 2,
      };
      // World point under anchor before zoom
      const before = screenToWorld(
        anchor.x,
        anchor.y,
        this.camera,
        canvas.width,
        canvas.height,
        PIXEL_SCALE,
      );
      this.camera.zoom += (this.zoomTarget - this.camera.zoom) * ZOOM_LERP;
      // World point under anchor after zoom
      const after = screenToWorld(
        anchor.x,
        anchor.y,
        this.camera,
        canvas.width,
        canvas.height,
        PIXEL_SCALE,
      );
      this.camera.x += before.wx - after.wx;
      this.camera.y += before.wy - after.wy;
      this.camera = clampCamera(
        this.camera,
        this.mapWidth,
        this.mapHeight,
        canvas.width,
        canvas.height,
        PIXEL_SCALE,
      );
    } else {
      this.camera.zoom = this.zoomTarget;
      this.zoomAnchorScreen = null;
    }

    // Keyboard panning
    if (this.keysDown.size > 0 && !this.resetTarget) {
      const panAmount = PAN_SPEED / this.camera.zoom;
      if (this.keysDown.has('ArrowLeft')) this.camera.x -= panAmount;
      if (this.keysDown.has('ArrowRight')) this.camera.x += panAmount;
      if (this.keysDown.has('ArrowUp')) this.camera.y -= panAmount;
      if (this.keysDown.has('ArrowDown')) this.camera.y += panAmount;
      if (this.keysDown.has('+') || this.keysDown.has('=')) {
        this.zoomTarget = Math.min(MAX_ZOOM, this.zoomTarget + 0.02);
      }
      if (this.keysDown.has('-')) {
        this.zoomTarget = Math.max(MIN_ZOOM, this.zoomTarget - 0.02);
      }
      this.camera = clampCamera(
        this.camera,
        this.mapWidth,
        this.mapHeight,
        canvas.width,
        canvas.height,
        PIXEL_SCALE,
      );
    }

    // Day/night state
    const dayNight = computeDayNight(time);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // === World-space drawing (camera transform) ===
    applyCameraTransform(ctx, this.camera, canvas.width, canvas.height, PIXEL_SCALE);

    // Ground + grass
    drawGround(ctx, this.mapWidth, this.mapHeight, this.environment.grass);

    // Paths between campfires
    for (let i = 0; i < this.campfires.length; i++) {
      for (let j = i + 1; j < this.campfires.length; j++) {
        const a = this.campfires[i];
        const b = this.campfires[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < this.mapWidth * 0.6) {
          drawPath(ctx, a.x, a.y, b.x, b.y);
        }
      }
    }

    // Background trees (behind campfires)
    const sortedTrees = [...this.environment.trees].sort((a, b) => a.y - b.y);
    const midY = this.mapHeight / 2;
    for (const tree of sortedTrees) {
      if (tree.y < midY) drawTree(ctx, tree, time);
    }

    // Draw pulse rings (behind everything else in the scene)
    for (let i = 0; i < this.pulseStates.length; i++) {
      const ps = this.pulseStates[i];
      const cf = this.campfires[i];
      if (!cf) continue;
      for (const ring of ps.rings) {
        drawPulseRing(
          ctx,
          ring,
          time,
          cf.color,
          this.fireStates[i]?.level || 'steady',
          cf.fireSize,
        );
      }
    }

    // Draw spark arcs (filter expired)
    this.sparkArcs = this.sparkArcs.filter((a) => time - a.startTime < SPARK_ARC_DURATION);
    for (const arc of this.sparkArcs) {
      const progress = (time - arc.startTime) / SPARK_ARC_DURATION;
      drawSparkArc(ctx, arc.fromX, arc.fromY, arc.toX, arc.toY, progress, time);
    }

    // Build animated sprite render states
    const spriteRenders: { sprite: AnimatedSprite; state: SpriteRenderState }[] = [];
    for (const sprite of this.animatedSprites.values()) {
      if (!sprite.visible) continue;
      spriteRenders.push({ sprite, state: getSpriteRenderState(sprite) });
    }

    // Collect all render items for y-sorting
    interface RenderItem {
      type: 'fire' | 'decoration' | 'sprite';
      y: number;
      data: unknown;
    }

    const renderOrder: RenderItem[] = [];

    for (let i = 0; i < this.campfires.length; i++) {
      renderOrder.push({ type: 'fire', y: this.campfires[i].y, data: i });
    }

    for (const dec of this.environment.decorations) {
      renderOrder.push({ type: 'decoration', y: dec.y, data: dec });
    }

    for (const sr of spriteRenders) {
      renderOrder.push({ type: 'sprite', y: sr.state.y, data: sr });
    }

    renderOrder.sort((a, b) => a.y - b.y);

    // Render in depth order
    for (const item of renderOrder) {
      if (item.type === 'fire') {
        const cfIdx = item.data as number;
        const cf = this.campfires[cfIdx];
        const fm = this.fireStates[cfIdx]
          ? getFireMultipliers(this.fireStates[cfIdx], this.fireFlares[cfIdx], time)
          : undefined;
        drawCampfire(ctx, cf.x, cf.y, cf.fireSize, cf.color, time, dayNight.glowMultiplier, fm);
        drawTeamLabel(ctx, cf.x, cf.y, cf.name, cf.fireSize);

        // Spark badge
        const badgeStart = this.sparkBadges.get(cf.teamId);
        if (badgeStart !== undefined) {
          const badgeElapsed = time - badgeStart;
          if (badgeElapsed < SPARK_BADGE_PERSIST) {
            drawSparkBadge(ctx, cf.x, cf.y, cf.fireSize, badgeElapsed);
          } else {
            this.sparkBadges.delete(cf.teamId);
          }
        }
      } else if (item.type === 'decoration') {
        const dec = item.data as { x: number; y: number; type: string };
        drawWorkstation(ctx, dec.x, dec.y, dec.type, time);
      } else if (item.type === 'sprite') {
        const { sprite, state } = item.data as { sprite: AnimatedSprite; state: SpriteRenderState };

        ctx.save();
        if (state.opacity < 1) ctx.globalAlpha = state.opacity;

        // Create a temporary SpriteData-like object at the animated position
        const renderSprite: SpriteData = {
          userId: sprite.userId,
          name: sprite.name,
          type: sprite.type,
          color: sprite.color,
          status: sprite.status,
          task: state.task,
          file: sprite.file,
          parentName: sprite.parentName,
          teamName: sprite.teamName,
          px: state.x,
          py: state.y,
          homeX: sprite.homeX,
          homeY: sprite.homeY,
          campfireIndex: sprite.campfireIndex,
        };

        // Golem spawn sequence — draw spawn effects instead of sprite
        if (sprite.currentAnim?.type === 'golem_spawn') {
          drawGolemSpawn(
            ctx,
            sprite.currentAnim.elapsed,
            state.spawnFireX,
            state.spawnFireY,
            sprite.homeX,
            sprite.homeY,
            state.spawnOwnerX,
            state.spawnOwnerY,
            sprite.color,
            time,
          );
          ctx.restore();
          continue;
        }

        // Golem despawn — draw dissolve particles
        if (sprite.currentAnim?.type === 'golem_despawn') {
          drawDespawnParticles(
            ctx,
            state.x,
            state.y,
            state.despawnFireX,
            state.despawnFireY,
            sprite.color,
            state.animProgress,
            time,
          );
          ctx.restore();
          continue;
        }

        // Activity glow aura for golems (PR3, drawn behind sprite)
        if (sprite.type === 'agent' && !sprite.isSpawning) {
          drawActivityGlow(ctx, state.x, state.y, sprite.recentEventTimes, time);
        }

        // Afterimage trail for walking golems (PR3)
        if (sprite.type === 'agent' && sprite.afterimages.length > 0) {
          drawAfterimages(ctx, sprite.afterimages, sprite.color, time);
        }

        // Determine which sprite draw function to use
        if (state.task === 'strike') {
          drawStrikeSprite(ctx, state.x, state.y, sprite.color, state.animProgress, time);
        } else if (state.task === 'toss') {
          drawTossSprite(ctx, state.x, state.y, sprite.color, state.animProgress, time);
        } else if (this.castingSprites.has(sprite.userId)) {
          drawCastingSprite(ctx, renderSprite, time);
        } else if (sprite.type === 'agent' && sprite.isGolemIdle) {
          drawGolemIdle(ctx, renderSprite, time);
        } else if (sprite.type === 'agent') {
          drawGolemSprite(ctx, renderSprite, time);
        } else {
          drawHumanSprite(ctx, renderSprite, time);
        }

        // Carrying orb for golems (PR3, drawn on top of sprite)
        if (sprite.type === 'agent' && !sprite.isSpawning && sprite.orbSaveCount > 0) {
          drawCarryingOrb(ctx, state.x, state.y, sprite.orbBrightness, sprite.orbSaveCount);
        }

        ctx.restore();
      }
    }

    // Draw floating texts (on top of everything in world-space)
    for (const ft of this.floatingTexts) {
      drawFloatingText(ctx, ft, time);
    }

    // Draw milestone celebrations (PR3)
    for (const m of this.milestones) {
      drawMilestoneCelebration(ctx, m, time);
    }

    // Foreground trees
    for (const tree of sortedTrees) {
      if (tree.y >= midY) drawTree(ctx, tree, time);
    }

    // Stars (world-space, so they scroll with the map)
    drawStars(ctx, this.mapWidth, this.mapHeight, dayNight, time);

    // === End world-space ===
    ctx.restore();

    // === Screen-space overlays ===
    drawVignette(ctx, canvas.width, canvas.height);
    drawDayNightOverlay(ctx, canvas.width, canvas.height, dayNight);

    this.animFrameId = requestAnimationFrame(this.render);
  };
}
