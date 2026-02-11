import type { Org, Team, Summary, User, AwarenessState } from '@campfires/shared';
import { PIXEL_SCALE, drawCampfire, drawTeamLabel, drawVignette } from './renderer.js';
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
import { drawHumanSprite, drawGolemSprite } from './sprites.js';

export interface MapViewConfig {
  org: Org;
  teams: Team[];
  summaries: Summary[];
  members: Map<string, User[]>;
  awareness: Map<string, AwarenessState[]>;
  serverUrl: string;
  onTeamSelect?: (teamId: string) => void;
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
  private overlayElement: HTMLElement | null = null;
  private overlayPollInterval: ReturnType<typeof setInterval> | null = null;

  // Map dimensions in pixel-art units
  private mapWidth = 500;
  private mapHeight = 280;

  constructor(container: HTMLElement, config: MapViewConfig) {
    this.container = container;
    this.config = config;
  }

  start(): void {
    this.buildDOM();
    this.computeLayout();
    this.environment = generateEnvironment(this.mapWidth, this.mapHeight, this.campfires);
    this.attachEvents();
    this.render(0);
  }

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.hideOverlay();
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

    this.container.appendChild(wrapper);

    this.resize();
    this.renderSummaryBar();
  }

  private resize(): void {
    const parent = this.canvas.parentElement!;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
    this.ctx = this.canvas.getContext('2d')!;

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
    for (const cf of this.campfires) {
      const members = this.config.members.get(cf.teamId) || [];
      const awareness = this.config.awareness.get(cf.teamId) || [];
      this.allSprites.push(...layoutSprites(cf, members, awareness));
    }
  }

  private renderSummaryBar(): void {
    const bar = this.container.querySelector('#map-summary-bar');
    if (!bar) return;

    bar.innerHTML = '<div class="map-summary-title">\u2726 AI REEL</div>';

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
        <span class="team-dot" style="background:${cf.color}"></span>
        <span><strong>${cf.name}</strong> \u2014 ${latest.oneLiner || 'Activity recorded'}</span>
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
    });
    resizeObserver.observe(this.canvas.parentElement!);

    // Hover
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      this.hoveredSprite = null;
      for (const sprite of this.allSprites) {
        const sx = sprite.px * PIXEL_SCALE;
        const sy = sprite.py * PIXEL_SCALE;
        if (Math.hypot(mx - sx, my - sy) < 20) {
          this.hoveredSprite = sprite;
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
          <div class="tt-name" style="color:${s.color}">${s.name}</div>
          <div class="tt-role">${typeLabel} \u00b7 ${s.teamName}</div>
          <div class="tt-detail">${s.file || s.task}</div>
        `;
      } else {
        this.tooltip.style.display = 'none';
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredSprite = null;
      this.tooltip.style.display = 'none';
    });

    // Click to show campfire overlay
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const cf of this.campfires) {
        const cfx = cf.x * PIXEL_SCALE;
        const cfy = cf.y * PIXEL_SCALE;
        const hitRadius = (cf.fireSize * 6 + 10) * PIXEL_SCALE;
        if (Math.hypot(mx - cfx, my - cfy) < hitRadius) {
          this.showOverlay(cf);
          return;
        }
      }

      // Clicked empty space — close overlay
      this.hideOverlay();
    });
  }

  private showOverlay(campfire: CampfirePosition): void {
    this.hideOverlay();

    const wrapper = this.canvas.parentElement!;
    const overlay = document.createElement('div');
    overlay.className = 'map-campfire-overlay';
    this.overlayElement = overlay;

    // Loading state
    overlay.innerHTML = `
      <div class="overlay-header">
        <span class="overlay-team-name" style="color:${campfire.color}">${campfire.name}</span>
        <button class="overlay-close">\u2715</button>
      </div>
      <div class="overlay-body"><div class="loading">Loading...</div></div>
    `;

    overlay.querySelector('.overlay-close')!.addEventListener('click', () => this.hideOverlay());
    wrapper.appendChild(overlay);

    // Fetch and populate
    this.fetchOverlayData(campfire);

    // Poll for fresh awareness every 10s while open
    this.overlayPollInterval = setInterval(() => {
      if (this.overlayElement) this.fetchOverlayData(campfire);
    }, 10000);
  }

  private async fetchOverlayData(campfire: CampfirePosition): Promise<void> {
    if (!this.overlayElement) return;

    try {
      const [membersRes, awarenessRes, summariesRes] = await Promise.all([
        fetch(`${this.config.serverUrl}/api/teams/${campfire.teamId}/members`),
        fetch(`${this.config.serverUrl}/api/teams/${campfire.teamId}/awareness`),
        fetch(`${this.config.serverUrl}/api/orgs/${this.config.org.orgId}/summaries`),
      ]);

      const members: User[] = membersRes.ok ? await membersRes.json() : [];
      const awareness: AwarenessState[] = awarenessRes.ok ? await awarenessRes.json() : [];
      const allSummaries: Summary[] = summariesRes.ok ? await summariesRes.json() : [];
      const teamSummary = allSummaries
        .filter((s) => s.teamId === campfire.teamId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

      if (!this.overlayElement) return;

      const team = this.config.teams.find((t) => t.teamId === campfire.teamId);
      const onlineCount = awareness.filter(
        (a) => a.status === 'active' || a.status === 'idle',
      ).length;

      const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
          active: '#3fb950',
          idle: '#d29922',
          draft: '#6e7681',
          visitor: '#58a6ff',
          offline: '#484f58',
        };
        return `<span class="overlay-status-dot" style="background:${colors[status] || '#484f58'}"></span>${status}`;
      };

      const body = this.overlayElement.querySelector('.overlay-body')!;
      body.innerHTML = `
        ${team?.description ? `<div class="overlay-description">${team.description}</div>` : ''}
        ${teamSummary ? `<div class="overlay-summary">${teamSummary.oneLiner || 'Activity recorded'}</div>` : ''}
        <div class="overlay-stats">${members.length} member${members.length !== 1 ? 's' : ''} \u00b7 ${onlineCount} online</div>
        <div class="overlay-members">
          ${members
            .map((m) => {
              const a = awareness.find((s) => s.userId === m.userId);
              const status = a?.status || 'offline';
              return `<div class="overlay-member"><span class="overlay-member-dot" style="background:${m.avatarColor}"></span>${m.displayName} ${statusBadge(status)}</div>`;
            })
            .join('')}
          ${awareness
            .filter((a) => a.homeTeamId && !members.find((m) => m.userId === a.userId))
            .map(
              (a) =>
                `<div class="overlay-member"><span class="overlay-member-dot" style="background:${a.color}"></span>${a.displayName} ${statusBadge('visitor')}</div>`,
            )
            .join('')}
        </div>
        <div class="overlay-actions">
          <button class="overlay-btn overlay-btn-detail">View Details</button>
        </div>
      `;

      body.querySelector('.overlay-btn-detail')?.addEventListener('click', () => {
        this.hideOverlay();
        this.config.onTeamSelect?.(campfire.teamId);
      });
    } catch {
      if (this.overlayElement) {
        const body = this.overlayElement.querySelector('.overlay-body');
        if (body) body.innerHTML = '<div class="error">Failed to load</div>';
      }
    }
  }

  private hideOverlay(): void {
    if (this.overlayPollInterval) {
      clearInterval(this.overlayPollInterval);
      this.overlayPollInterval = null;
    }
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
  }

  private render = (timestamp: number): void => {
    const time = timestamp / 1000;
    const { ctx, canvas } = this;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ground + grass
    drawGround(ctx, canvas.width, canvas.height, this.environment.grass);

    // Paths between campfires
    for (let i = 0; i < this.campfires.length; i++) {
      for (let j = i + 1; j < this.campfires.length; j++) {
        const a = this.campfires[i];
        const b = this.campfires[j];
        // Only draw paths between nearby campfires
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

    // Collect all render items for y-sorting
    interface RenderItem {
      type: 'fire' | 'decoration' | 'sprite';
      y: number;
      data: CampfirePosition | { x: number; y: number; type: string } | SpriteData;
    }

    const renderOrder: RenderItem[] = [];

    for (const cf of this.campfires) {
      renderOrder.push({ type: 'fire', y: cf.y, data: cf });
    }

    for (const dec of this.environment.decorations) {
      renderOrder.push({ type: 'decoration', y: dec.y, data: dec });
    }

    for (const sprite of this.allSprites) {
      renderOrder.push({ type: 'sprite', y: sprite.py, data: sprite });
    }

    renderOrder.sort((a, b) => a.y - b.y);

    // Render in depth order
    for (const item of renderOrder) {
      if (item.type === 'fire') {
        const cf = item.data as CampfirePosition;
        drawCampfire(ctx, cf.x, cf.y, cf.fireSize, cf.color, time);
        drawTeamLabel(ctx, cf.x, cf.y, cf.name, cf.fireSize);
      } else if (item.type === 'decoration') {
        const dec = item.data as { x: number; y: number; type: string };
        drawWorkstation(ctx, dec.x, dec.y, dec.type, time);
      } else if (item.type === 'sprite') {
        const sprite = item.data as SpriteData;
        if (sprite.type === 'agent') {
          drawGolemSprite(ctx, sprite, time);
        } else {
          drawHumanSprite(ctx, sprite, time);
        }
      }
    }

    // Foreground trees
    for (const tree of sortedTrees) {
      if (tree.y >= midY) drawTree(ctx, tree, time);
    }

    // Vignette
    drawVignette(ctx, canvas.width, canvas.height);

    this.animFrameId = requestAnimationFrame(this.render);
  };
}
