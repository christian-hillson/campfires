import type { Org } from '@campfires/shared';

export type ViewMode = 'feed' | 'map';

export interface HeaderContext {
  org: Org;
  activeView: ViewMode;
  onlineCount: number;
  teamCount: number;
  onViewChange: (view: ViewMode) => void;
}

export function renderHeader(container: HTMLElement, ctx: HeaderContext): void {
  let header = container.querySelector('.stories-app-header') as HTMLElement | null;
  if (!header) {
    header = document.createElement('div');
    header.className = 'stories-app-header';
    container.insertBefore(header, container.firstChild);
  }

  header.innerHTML = '';

  // Left: logo + org name
  const left = document.createElement('div');
  left.className = 'header-left';

  const logo = document.createElement('span');
  logo.className = 'header-logo';
  logo.textContent = '\uD83D\uDD25 CAMPFIRES';
  left.appendChild(logo);

  const orgName = document.createElement('span');
  orgName.className = 'header-org-name';
  orgName.textContent = ctx.org.name;
  left.appendChild(orgName);

  header.appendChild(left);

  // Right: toggle + stats
  const right = document.createElement('div');
  right.className = 'header-right';

  // Online count
  if (ctx.onlineCount > 0) {
    const stat = document.createElement('div');
    stat.className = 'header-stat';
    const dot = document.createElement('span');
    dot.className = 'header-dot';
    stat.appendChild(dot);
    stat.appendChild(document.createTextNode(` ${ctx.onlineCount} online`));
    right.appendChild(stat);
  }

  // Team count
  const teamStat = document.createElement('div');
  teamStat.className = 'header-stat';
  teamStat.textContent = `${ctx.teamCount} campfire${ctx.teamCount !== 1 ? 's' : ''}`;
  right.appendChild(teamStat);

  header.appendChild(right);
}
