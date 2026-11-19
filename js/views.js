/**
 * views.js — pure HTML renderers. Each view receives a context object and
 * returns markup; all user text goes through escapeHtml.
 */
(function (JT) {
  'use strict';

  const U = JT.utils;
  const esc = U.escapeHtml;
  const FU = () => JT.followUps;

  /* ---------- Small components ---------- */

  function statusBadge(status, cls = '') {
    const m = JT.STATUS_META[status] || JT.STATUS_META.Interested;
    return `<span class="status-badge s-${m.tone} ${cls}"><i class="bi ${m.icon}" aria-hidden="true"></i><span>${esc(status)}</span></span>`;
  }

  function followPill(app, today, { long = false } = {}) {
    const st = FU().getFollowUpState(app, today);
    if (st === 'none') return '<span class="fu-pill fu-none" title="No follow-up scheduled">—<span class="visually-hidden">No follow-up</span></span>';
    const m = FU().STATE_META[st];
    const showLabel = long || st === 'overdue' || st === 'today';
    return `<span class="fu-pill fu-${m.tone}" title="${esc(m.label)} · ${esc(U.formatDate(app.followUpDate))} (${esc(U.relativeDays(app.followUpDate, today))})">
      <i class="bi ${m.icon}" aria-hidden="true"></i><span>${esc(U.formatDate(app.followUpDate, { short: true }))}</span>${showLabel ? `<span class="fu-label">${esc(m.label)}</span>` : `<span class="visually-hidden">${esc(m.label)}</span>`}</span>`;
  }

  function monogram(company, size = '') {
    const tone = U.hashIndex(company, 6);
    return `<span class="mono-avatar t-${tone} ${size}" aria-hidden="true">${esc(U.initials(company))}</span>`;
  }

  function priorityTag(p) {
    const m = JT.PRIORITY_META[p] || JT.PRIORITY_META.Medium;
    return `<span class="prio prio-${m.tone}"><i class="bi ${m.icon}" aria-hidden="true"></i>${esc(p)}</span>`;
  }

  function emptyState({ icon = 'bi-inbox', title, text, action = '' }) {
    return `<div class="empty-state"><div class="empty-icon"><i class="bi ${icon}" aria-hidden="true"></i></div>
      <h3 class="h5">${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
  }

  function statusSelect(app, cls = '') {
    const m = JT.STATUS_META[app.status];
    return `<select class="form-select form-select-sm status-select s-${m.tone} ${cls}" data-action="status-change" data-id="${esc(app.id)}" aria-label="Update status for ${esc(app.company)}">
      ${JT.STATUSES.map((s) => `<option value="${s}" ${s === app.status ? 'selected' : ''}>${s}</option>`).join('')}
    </select>`;
  }

  function levelRing(player, size = 92) {
    const r = (size / 2) - 7;
    const c = 2 * Math.PI * r;
    const off = c * (1 - player.progress / 100);
    return `<div class="level-ring" style="width:${size}px;height:${size}px" aria-label="Level ${player.level}, ${player.progress}% to next level" role="img">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-bar="ring-${size}" data-offset="${off.toFixed(1)}"/>
      </svg>
      <div class="ring-text"><span class="lv-label">LV</span><span class="lv-num">${player.level}</span></div>
    </div>`;
  }

  function xpBar(player, label = true) {
    return `<div class="xpbar" role="progressbar" aria-label="Experience toward level ${player.level + 1}" aria-valuemin="0" aria-valuemax="${player.levelSpan}" aria-valuenow="${player.intoLevel}">
        <div class="xpbar-fill" style="width:0%" data-bar="xp" data-width="${player.progress}%"></div><div class="xpbar-ticks" aria-hidden="true"></div></div>
      ${label ? `<div class="d-flex justify-content-between xp-caption"><span>${player.intoLevel} / ${player.levelSpan} XP</span><span>${player.next - player.xp} XP to LV ${player.level + 1}</span></div>` : ''}`;
  }

  /* ---------- Dashboard ---------- */

  function nextBestMove(apps, today) {
    const overdue = FU().getOverdueFollowUps(apps, today);
    if (overdue.length) {
      const a = overdue[0];
      return { icon: 'bi-exclamation-triangle', tone: 'danger', text: `Follow up with <b>${esc(a.company)}</b> — it was due ${esc(U.relativeDays(a.followUpDate, today))}.`, href: `#/app/${encodeURIComponent(a.id)}`, cta: 'Review' };
    }
    const interview = apps.filter((a) => a.interviewDate && a.interviewDate >= today && !JT.applications.isClosed(a) && U.diffDays(today, a.interviewDate) <= 7)
      .sort((a, b) => a.interviewDate.localeCompare(b.interviewDate))[0];
    if (interview) {
      return { icon: 'bi-camera-video', tone: 'interview', text: `Prepare for your <b>${esc(interview.company)}</b> interview ${esc(U.relativeDays(interview.interviewDate, today))} (${esc(U.formatDate(interview.interviewDate))}).`, href: `#/app/${encodeURIComponent(interview.id)}`, cta: 'Prep' };
    }
    const dueToday = FU().getUpcomingFollowUps(apps, today).find((a) => a.followUpDate === today);
    if (dueToday) {
      return { icon: 'bi-alarm', tone: 'warning', text: `Follow-up with <b>${esc(dueToday.company)}</b> is due today.`, href: `#/app/${encodeURIComponent(dueToday.id)}`, cta: 'Open' };
    }
    const deadline = apps.filter((a) => a.status === 'Interested' && a.deadline && a.deadline >= today && U.diffDays(today, a.deadline) <= 7)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    if (deadline) {
      return { icon: 'bi-hourglass-split', tone: 'warning', text: `Apply to <b>${esc(deadline.company)}</b> before the deadline ${esc(U.relativeDays(deadline.deadline, today))}.`, href: `#/app/${encodeURIComponent(deadline.id)}`, cta: 'Open' };
    }
    return { icon: 'bi-check2-circle', tone: 'success', text: 'You\'re all caught up. Log a new application to keep your streak alive.', action: 'add-app', cta: 'Add' };
  }

  function statCard({ label, value, icon, tone, sub, href, suffix = '' }) {
    return `<div class="col-6 col-md-4 col-xl-2">
      <a class="stat-card tone-${tone}" href="${href}" data-tilt>
        <span class="stat-icon"><i class="bi ${icon}" aria-hidden="true"></i></span>
        <span class="stat-label">${esc(label)}</span>
        <span class="stat-value" data-count="${value}" data-suffix="${suffix}">${value}${suffix}</span>
        <span class="stat-sub">${sub}</span>
      </a></div>`;
  }

  function pipelineTrack(apps) {
    const funnel = JT.analytics.getFunnel(apps);
    const closed = ['Rejected', 'Withdrawn'].map((s) => ({ s, n: apps.filter((a) => a.status === s).length }));
    return `<div class="pipeline" role="list">
      ${funnel.map((f, i) => {
        const m = JT.STATUS_META[f.stage];
        const prev = i > 0 ? funnel[i - 1].reached : 0;
        const conv = i > 1 && prev ? Math.round((f.reached / prev) * 100) : null;
        return `<a role="listitem" class="pipe-node s-${m.tone}" href="#/applications?status=${f.stage}" aria-label="${f.stage}: ${f.current} now, ${f.reached} reached">
          ${i > 0 ? `<span class="pipe-link" aria-hidden="true">${conv !== null ? `<span class="pipe-conv">${conv}%</span>` : ''}</span>` : ''}
          <span class="pipe-dot"><i class="bi ${m.icon}" aria-hidden="true"></i></span>
          <span class="pipe-count" data-count="${f.current}">${f.current}</span>
          <span class="pipe-label">${f.stage}</span>
          <span class="pipe-reached">${f.reached} reached</span>
        </a>`;
      }).join('')}
      <div class="pipe-closed" role="listitem">
        ${closed.map((c) => `<a class="closed-chip s-${JT.STATUS_META[c.s].tone}" href="#/applications?status=${c.s}"><i class="bi ${JT.STATUS_META[c.s].icon}" aria-hidden="true"></i>${c.s} <b>${c.n}</b></a>`).join('')}
      </div>
    </div>`;
  }

  function followRow(app, today, { compact = false } = {}) {
    const st = FU().getFollowUpState(app, today);
    return `<li class="fu-row fu-row-${st}" data-flip="fu-${esc(app.id)}">
      ${monogram(app.company, 'sm')}
      <div class="min-w-0 flex-grow-1">
        <a class="row-title" href="#/app/${encodeURIComponent(app.id)}">${esc(app.company)}</a>
        <div class="row-sub text-truncate">${esc(app.jobTitle)}${app.followUpNote && !compact ? ` · <span class="fst-italic">${esc(app.followUpNote)}</span>` : ''}</div>
      </div>
      ${followPill(app, today, { long: !compact })}
      <div class="row-actions">
        <button class="btn btn-icon btn-sm btn-ok" data-action="complete-followup" data-id="${esc(app.id)}" aria-label="Mark follow-up complete for ${esc(app.company)}" title="Mark Follow-up Complete"><i class="bi bi-check-lg"></i></button>
        <button class="btn btn-icon btn-sm" data-action="snooze" data-days="3" data-id="${esc(app.id)}" aria-label="Reschedule ${esc(app.company)} follow-up by 3 days" title="Snooze 3 days"><i class="bi bi-clock-history"></i></button>
        ${compact ? '' : `<button class="btn btn-icon btn-sm" data-action="schedule-followup" data-id="${esc(app.id)}" aria-label="Pick a new follow-up date for ${esc(app.company)}" title="Reschedule"><i class="bi bi-calendar2-week"></i></button>`}
      </div>
    </li>`;
  }

  function heatmap(player, today) {
    const hm = JT.analytics.getHeatmap(player.events, today, 18);
    const cols = [];
    for (let w = 0; w < hm.weeks; w += 1) {
      const cells = hm.cells.slice(w * 7, w * 7 + 7).map((c) => `<span class="hm-cell l${c.level}${c.future ? ' future' : ''}${c.date === today ? ' is-today' : ''}" title="${c.count} ${c.count === 1 ? 'activity' : 'activities'} · ${U.formatDate(c.date)}"></span>`).join('');
      cols.push(`<div class="hm-col"><span class="hm-month">${hm.months[w]}</span>${cells}</div>`);
    }
    return `<div class="heatmap-wrap"><div class="hm-days" aria-hidden="true"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span></div>
      <div class="heatmap" role="img" aria-label="${hm.total} activities in the last ${hm.weeks} weeks">${cols.join('')}</div></div>
      <div class="hm-legend"><span>${hm.total} actions in ${hm.weeks} weeks</span><span class="ms-auto">Less</span>${[0, 1, 2, 3, 4].map((l) => `<span class="hm-cell l${l}"></span>`).join('')}<span>More</span></div>`;
  }

  function achievementTile(a, { mini = false } = {}) {
    return `<div class="ach ${a.unlocked ? 'unlocked' : 'locked'} tier-${a.tier} ${mini ? 'mini' : ''}" data-flip="ach-${a.id}${mini ? '-mini' : ''}" ${mini ? '' : 'data-tilt'} title="${esc(a.title)} — ${esc(a.desc)}">
      <div class="ach-badge"><i class="bi ${a.unlocked ? a.icon : 'bi-lock-fill'}" aria-hidden="true"></i></div>
      <div class="ach-body min-w-0">
        <div class="ach-title">${esc(a.title)} ${a.unlocked ? `<span class="tier-tag">${JT.game.TIERS[a.tier]}</span>` : ''}</div>
        <div class="ach-desc">${esc(a.desc)}</div>
        ${a.unlocked ? (mini ? '' : `<div class="ach-meta"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Unlocked${a.unlockedAt ? ` · ${esc(U.formatDate(U.localDateOf(a.unlockedAt)))}` : ''}</div>`)
          : `<div class="ach-progress" role="progressbar" aria-label="${esc(a.title)} progress" aria-valuemin="0" aria-valuemax="${a.target}" aria-valuenow="${a.current}"><span style="width:${a.pct}%"></span></div><div class="ach-meta">${a.current} / ${a.target}</div>`}
      </div></div>`;
  }

  function dashboard(ctx) {
    const { apps, today, player, stats, settings, achievements } = ctx;
    if (!apps.length) {
      return `<section class="panel hero-empty text-center">
        <div class="empty-icon big"><i class="bi bi-controller" aria-hidden="true"></i></div>
        <p class="eyebrow">New game</p>
        <h1 class="h2">Your job search starts here.</h1>
        <p class="lead text-muted mx-auto" style="max-width:560px">Add your first application to keep every opportunity organized — and start earning XP for every step you take.</p>
        <div class="d-flex gap-2 justify-content-center flex-wrap mt-3">
          <button class="btn btn-primary btn-lg" data-action="add-app" data-magnetic><i class="bi bi-plus-lg" aria-hidden="true"></i> Add Application</button>
          <button class="btn btn-outline-secondary btn-lg" data-action="reset-demo" data-magnetic><i class="bi bi-joystick" aria-hidden="true"></i> Load demo data</button>
        </div></section>`;
    }

    const move = nextBestMove(apps, today);
    const overdue = FU().getOverdueFollowUps(apps, today);
    const upcoming = FU().getUpcomingFollowUps(apps, today);
    const fuList = [...overdue, ...upcoming].slice(0, 6);
    const recent = JT.analytics.getRecentlyUpdated(apps, 5);
    const unlocked = achievements.filter((a) => a.unlocked).sort((a, b) => String(b.unlockedAt).localeCompare(String(a.unlockedAt)));
    const nextUp = achievements.filter((a) => !a.unlocked).sort((a, b) => b.pct - a.pct).slice(0, 2);

    const firstDay = apps.reduce((m, a) => (a.createdAt < m ? a.createdAt : m), apps[0].createdAt);
    const dayN = Math.max(1, U.diffDays(U.localDateOf(firstDay), today) + 1);

    return `
    <section class="hero-strip hero-cosmos" aria-label="Mission control">
      <div class="hero-copy">
        <p class="eyebrow mb-3">// Season ${today.slice(0, 4)} · Day ${dayN} of the hunt</p>
        <h1 class="hero-title"><span class="ht-line ht-outline">Boost</span><span class="ht-line">your</span><span class="ht-line">career</span></h1>
        <p class="hero-sub">Track every application at the intersection of <b>ambition</b> and <b>follow-through</b>, helping you <b>land the offer</b>, today.</p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" data-action="add-app" data-magnetic><i class="bi bi-plus-lg" aria-hidden="true"></i> Add application</button>
          <button type="button" class="hero-orb" data-action="scroll-overview" data-magnetic aria-label="Jump to your overview"><i class="bi bi-arrow-down" aria-hidden="true"></i></button>
        </div>
        <div class="hero-meta mono" aria-label="Status readout">
          <span class="hm-live"><span class="live-dot" aria-hidden="true"></span>Signal live</span>
          <span>LVL <b>${player.level}</b></span>
          <span>XP <b>${player.xp.toLocaleString()}</b></span>
          <span>Streak <b>${player.streak.current}d</b></span>
          <span>Offers <b>${stats.offers}</b></span>
        </div>
      </div>
    </section>
    <span id="overview"></span>
    <section class="row g-3 mb-3" aria-label="Player overview">
      <div class="col-xl-8">
        <div class="panel player-card h-100">
          <div class="d-flex gap-3 align-items-center flex-wrap flex-sm-nowrap">
            ${levelRing(player)}
            <div class="flex-grow-1 min-w-0">
              <p class="eyebrow mb-1">Your job search · ${esc(U.formatDate(today))}</p>
              <h2 class="h3 mb-1 text-truncate">Welcome back, ${esc(settings.playerName)}</h2>
              <p class="text-muted mb-2 small"><i class="bi bi-shield-fill-check rank-icon" aria-hidden="true"></i> <b class="text-body">${esc(player.rank)}</b> · ${player.xp.toLocaleString()} XP total${player.todayXp ? ` · <span class="text-xp">+${player.todayXp} today</span>` : ''}</p>
              ${xpBar(player)}
            </div>
            <a class="streak-box ${player.streak.activeToday ? 'lit' : ''}" href="#/trophies" data-tilt aria-label="${player.streak.current} day streak${player.streak.activeToday ? '' : ', log activity today to keep it'}">
              <i class="bi bi-fire" aria-hidden="true"></i><b>${player.streak.current}</b><span>day streak</span>
            </a>
          </div>
          <div class="next-move tone-${move.tone} mt-3">
            <span class="nm-icon"><i class="bi ${move.icon}" aria-hidden="true"></i></span>
            <div class="flex-grow-1 min-w-0"><span class="eyebrow">Next best move</span><p class="mb-0">${move.text}</p></div>
            ${move.href ? `<a class="btn btn-sm btn-outline-primary" data-magnetic href="${move.href}">${move.cta}</a>` : `<button class="btn btn-sm btn-outline-primary" data-action="${move.action}">${move.cta}</button>`}
          </div>
        </div>
      </div>
      <div class="col-xl-4">
        <div class="panel h-100">
          <div class="panel-head"><h2 class="panel-title"><i class="bi bi-list-check" aria-hidden="true"></i> Daily quests</h2><span class="mono small text-xp">+${JT.game.XP_RULES.quest} XP each</span></div>
          <ul class="quest-list">
            ${player.quests.map((q) => `<li class="quest ${q.done ? 'done' : ''}" data-flip="quest-${q.id}">
              <span class="quest-check"><i class="bi ${q.done ? 'bi-check-lg' : q.icon}" aria-hidden="true"></i></span>
              <div class="flex-grow-1 min-w-0"><div class="quest-title">${esc(q.title)}</div>
                <div class="quest-bar"><span style="width:${(q.current / q.target) * 100}%"></span></div></div>
              <span class="quest-count mono">${q.current}/${q.target}</span>
              <span class="visually-hidden">${q.done ? 'Completed' : 'In progress'}</span>
            </li>`).join('')}
          </ul>
          <p class="small text-muted mb-0 mt-2"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Quests reset at midnight.</p>
        </div>
      </div>
    </section>

    <section class="row g-3 mb-3" aria-label="Summary metrics">
      ${statCard({ label: 'Total', value: stats.total, icon: 'bi-collection', tone: 'primary', sub: `${stats.updatedThisWeek} updated this week`, href: '#/applications' })}
      ${statCard({ label: 'Active', value: stats.active, icon: 'bi-activity', tone: 'info', sub: `${stats.responseRate}% response rate`, href: '#/applications?status=active' })}
      ${statCard({ label: 'Interviews', value: stats.interviews, icon: 'bi-people', tone: 'xp', sub: `${stats.interviewRate}% interview rate`, href: '#/applications?status=Interview' })}
      ${statCard({ label: 'Offers', value: stats.offers, icon: 'bi-trophy', tone: 'success', sub: stats.offers ? 'Nice work!' : 'Keep pushing', href: '#/applications?status=Offer' })}
      ${statCard({ label: 'Rejected', value: stats.rejected, icon: 'bi-x-octagon', tone: 'danger', sub: `${stats.withdrawn} withdrawn`, href: '#/applications?status=Rejected' })}
      ${statCard({ label: 'Overdue', value: stats.overdue, icon: 'bi-alarm', tone: stats.overdue ? 'warning' : 'muted', sub: `${stats.upcoming} upcoming`, href: '#/followups' })}
    </section>

    <section class="panel mb-3" aria-labelledby="pipe-title">
      <div class="panel-head"><h2 class="panel-title" id="pipe-title"><i class="bi bi-signpost-split" aria-hidden="true"></i> Pipeline</h2>
        <span class="small text-muted d-none d-md-inline">Click a stage to filter · % = conversion from the previous stage</span></div>
      ${pipelineTrack(apps)}
    </section>

    <section class="row g-3 mb-3">
      <div class="col-lg-7">
        <div class="panel h-100">
          <div class="panel-head"><h2 class="panel-title"><i class="bi bi-bell" aria-hidden="true"></i> Follow-ups
            ${overdue.length ? `<span class="count-badge danger">${overdue.length} overdue</span>` : ''}</h2>
            <a class="small" href="#/followups">View all <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>
          ${fuList.length ? `<ul class="fu-list">${fuList.map((a) => followRow(a, today, { compact: true })).join('')}</ul>`
            : emptyState({ icon: 'bi-check2-all', title: 'No follow-ups due', text: 'Nothing needs your attention right now. Schedule a follow-up from any application.' })}
        </div>
      </div>
      <div class="col-lg-5">
        <div class="panel h-100">
          <div class="panel-head"><h2 class="panel-title"><i class="bi bi-clock-history" aria-hidden="true"></i> Recently updated</h2>
            <button class="btn btn-sm btn-primary" data-action="add-app" data-magnetic><i class="bi bi-plus-lg" aria-hidden="true"></i> Add New</button></div>
          <ul class="recent-list">
            ${recent.map((a) => `<li data-flip="recent-${esc(a.id)}"><a href="#/app/${encodeURIComponent(a.id)}" class="recent-item">
              ${monogram(a.company, 'sm')}
              <span class="min-w-0 flex-grow-1"><span class="row-title d-block text-truncate">${esc(a.company)}</span><span class="row-sub d-block text-truncate">${esc(a.jobTitle)}</span></span>
              <span class="text-end">${statusBadge(a.status, 'sm')}<span class="row-time d-block">${esc(U.timeAgo(a.updatedAt))}</span></span>
            </a></li>`).join('')}
          </ul>
        </div>
      </div>
    </section>

    <section class="row g-3">
      <div class="col-lg-8">
        <div class="panel h-100">
          <div class="panel-head"><h2 class="panel-title"><i class="bi bi-grid-3x3" aria-hidden="true"></i> Activity</h2>
            <span class="small text-muted"><i class="bi bi-fire text-xp" aria-hidden="true"></i> Best streak: ${player.streak.best} days</span></div>
          ${heatmap(player, today)}
        </div>
      </div>
      <div class="col-lg-4">
        <div class="panel h-100">
          <div class="panel-head"><h2 class="panel-title"><i class="bi bi-award" aria-hidden="true"></i> Trophies <span class="count-badge">${unlocked.length}/${achievements.length}</span></h2>
            <a class="small" href="#/trophies">All <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>
          <div class="badge-strip mb-3">${unlocked.slice(0, 6).map((a) => `<span class="mini-badge tier-${a.tier}" title="${esc(a.title)}"><i class="bi ${a.icon}" aria-hidden="true"></i><span class="visually-hidden">${esc(a.title)}</span></span>`).join('') || '<span class="small text-muted">No trophies yet — they unlock as you progress.</span>'}</div>
          <p class="eyebrow mb-2">Next up</p>
          ${nextUp.map((a) => achievementTile(a, { mini: true })).join('') || '<p class="small text-muted mb-0">Every trophy unlocked. Legendary.</p>'}
        </div>
      </div>
    </section>`;
  }

  /* ---------- Applications ---------- */

  function applicationsShell(ctx) {
    const { apps, ui, settings } = ctx;
    const f = ui.filters;
    const counts = Object.fromEntries(JT.STATUSES.map((s) => [s, apps.filter((a) => a.status === s).length]));
    const active = apps.filter((a) => JT.ACTIVE_STATUSES.includes(a.status)).length;
    const chip = (value, label, n, icon = '') => `<button type="button" class="chip ${f.status === value ? 'on' : ''} ${value !== 'all' && value !== 'active' ? `s-${JT.STATUS_META[value].tone}` : ''}" data-action="filter-status" data-value="${value}" aria-pressed="${f.status === value}">${icon ? `<i class="bi ${icon}" aria-hidden="true"></i>` : ''}${label}<span class="chip-n">${n}</span></button>`;
    const opt = (list, val) => list.map((v) => `<option value="${v}" ${val === v ? 'selected' : ''}>${v}</option>`).join('');

    return `
    <div class="page-head">
      <div><p class="eyebrow">Inventory</p><h1 class="h2 mb-0">All Applications</h1></div>
      <div class="d-flex gap-2 flex-wrap">
        <div class="btn-group view-toggle" role="group" aria-label="Choose layout">
          <button class="btn btn-sm ${settings.listView === 'table' ? 'active' : ''}" data-action="set-view" data-view="table" aria-pressed="${settings.listView === 'table'}"><i class="bi bi-list-ul" aria-hidden="true"></i> List</button>
          <button class="btn btn-sm ${settings.listView === 'board' ? 'active' : ''}" data-action="set-view" data-view="board" aria-pressed="${settings.listView === 'board'}"><i class="bi bi-kanban" aria-hidden="true"></i> Board</button>
        </div>
        <button class="btn btn-sm btn-outline-secondary" data-action="export-csv"><i class="bi bi-download" aria-hidden="true"></i> <span class="d-none d-sm-inline">Export</span> CSV</button>
        <button class="btn btn-sm btn-primary" data-action="add-app" data-magnetic><i class="bi bi-plus-lg" aria-hidden="true"></i> Add New</button>
      </div>
    </div>

    <div class="panel toolbar mb-3" role="search">
      <div class="row g-2 align-items-center">
        <div class="col-12 col-lg-5">
          <label class="visually-hidden" for="search-input">Search applications</label>
          <div class="search-box"><i class="bi bi-search" aria-hidden="true"></i>
            <input id="search-input" type="search" class="form-control" placeholder="Search company, role or recruiter…" value="${esc(f.query)}" autocomplete="off" data-filter="query">
            <kbd class="d-none d-md-inline">/</kbd></div>
        </div>
        <div class="col-6 col-md-3 col-lg-2">
          <label class="visually-hidden" for="filter-type">Job type</label>
          <select id="filter-type" class="form-select" data-filter="jobType"><option value="all">All types</option>${opt(JT.JOB_TYPES, f.jobType)}</select>
        </div>
        <div class="col-6 col-md-3 col-lg-2">
          <label class="visually-hidden" for="filter-priority">Priority</label>
          <select id="filter-priority" class="form-select" data-filter="priority"><option value="all">Any priority</option>${opt(JT.PRIORITIES, f.priority)}</select>
        </div>
        <div class="col-8 col-md-4 col-lg-2">
          <label class="visually-hidden" for="sort-select">Sort by</label>
          <select id="sort-select" class="form-select" data-filter="sort">${Object.entries(JT.filters.SORTS).map(([k, s]) => `<option value="${k}" ${settings.sort === k ? 'selected' : ''}>Sort: ${s.label}</option>`).join('')}</select>
        </div>
        <div class="col-4 col-md-2 col-lg-1 d-grid">
          <button class="btn btn-outline-secondary" data-action="clear-filters" title="Clear all filters"><i class="bi bi-x-circle" aria-hidden="true"></i><span class="d-lg-none"> Clear</span><span class="visually-hidden"> filters</span></button>
        </div>
      </div>
      <div class="chip-row mt-2" role="group" aria-label="Filter by status">
        ${chip('all', 'All', apps.length, 'bi-asterisk')}${chip('active', 'Active', active, 'bi-activity')}
        ${JT.STATUSES.map((s) => chip(s, s, counts[s], JT.STATUS_META[s].icon)).join('')}
      </div>
    </div>
    <p class="results-count" id="results-count" aria-live="polite"></p>
    <div id="results"></div>`;
  }

  function applicationsTable(list, today) {
    return `<div class="panel p-0 d-none d-lg-block"><div class="table-responsive">
      <table class="table app-table align-middle mb-0">
        <caption class="visually-hidden">Job applications</caption>
        <thead><tr><th scope="col">Company</th><th scope="col">Job title</th><th scope="col">Applied</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Follow-up</th><th scope="col" class="text-end">Actions</th></tr></thead>
        <tbody>
        ${list.map((a) => `<tr data-row-href="#/app/${encodeURIComponent(a.id)}" data-flip="row-${esc(a.id)}">
          <td><div class="d-flex align-items-center gap-2">${monogram(a.company, 'sm')}<div class="min-w-0"><a class="row-title" href="#/app/${encodeURIComponent(a.id)}">${esc(a.company)}</a><div class="row-sub">${esc(a.location || '—')}</div></div></div></td>
          <td><div class="fw-medium">${esc(a.jobTitle)}</div><div class="row-sub">${esc(a.jobType)}</div></td>
          <td class="mono small text-nowrap">${esc(U.formatDate(a.applicationDate, { short: true }))}</td>
          <td style="min-width:150px">${statusSelect(a)}</td>
          <td>${priorityTag(a.priority)}</td>
          <td class="text-nowrap">${followPill(a, today)}</td>
          <td class="text-end text-nowrap">
            <a class="btn btn-icon btn-sm" href="#/app/${encodeURIComponent(a.id)}" aria-label="View application ${esc(a.company)}" title="View Application"><i class="bi bi-eye"></i></a>
            <button class="btn btn-icon btn-sm" data-action="edit-app" data-id="${esc(a.id)}" aria-label="Edit ${esc(a.company)}" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-icon btn-sm btn-danger-soft" data-action="delete-app" data-id="${esc(a.id)}" aria-label="Delete ${esc(a.company)}" title="Delete"><i class="bi bi-trash3"></i></button>
          </td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="d-lg-none card-list">${list.map((a) => applicationCard(a, today)).join('')}</div>`;
  }

  function applicationCard(a, today) {
    return `<article class="app-card panel" data-flip="card-${esc(a.id)}">
      <div class="d-flex gap-2 align-items-start">
        ${monogram(a.company)}
        <div class="min-w-0 flex-grow-1">
          <a class="row-title stretched-link-off" href="#/app/${encodeURIComponent(a.id)}">${esc(a.company)}</a>
          <div class="row-sub">${esc(a.jobTitle)} · ${esc(a.jobType)}</div>
        </div>
        ${priorityTag(a.priority)}
      </div>
      <dl class="app-card-meta">
        <div><dt>Applied</dt><dd>${esc(U.formatDate(a.applicationDate, { short: true }))}</dd></div>
        <div><dt>Follow-up</dt><dd>${followPill(a, today)}</dd></div>
      </dl>
      <div class="d-flex gap-2 align-items-center">
        <div class="flex-grow-1">${statusSelect(a)}</div>
        <button class="btn btn-icon btn-sm" data-action="edit-app" data-id="${esc(a.id)}" aria-label="Edit ${esc(a.company)}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-icon btn-sm btn-danger-soft" data-action="delete-app" data-id="${esc(a.id)}" aria-label="Delete ${esc(a.company)}"><i class="bi bi-trash3"></i></button>
      </div></article>`;
  }

  function board(list, today) {
    return `<p class="small text-muted mb-2 d-none d-md-block"><i class="bi bi-arrows-move" aria-hidden="true"></i> Drag cards between columns to update their status — or use the status menu on each card.</p>
    <div class="board" role="list">
      ${JT.STATUSES.map((s) => {
        const items = list.filter((a) => a.status === s);
        const m = JT.STATUS_META[s];
        return `<section class="board-col s-${m.tone}" data-drop-status="${s}" role="listitem" aria-label="${s} column, ${items.length} applications">
          <header class="board-col-head">${statusBadge(s)}<span class="chip-n">${items.length}</span></header>
          <div class="board-col-body">
            ${items.map((a) => `<article class="board-card" draggable="true" data-drag-id="${esc(a.id)}" data-flip="board-${esc(a.id)}">
              <div class="d-flex gap-2 align-items-center mb-1">${monogram(a.company, 'xs')}<a class="row-title text-truncate" href="#/app/${encodeURIComponent(a.id)}">${esc(a.company)}</a></div>
              <div class="row-sub mb-2">${esc(a.jobTitle)}</div>
              <div class="d-flex justify-content-between align-items-center gap-1 flex-wrap">${priorityTag(a.priority)}${followPill(a, today)}</div>
              <div class="mt-2">${statusSelect(a, 'board-status')}</div>
            </article>`).join('') || '<div class="board-empty">Drop here</div>'}
          </div></section>`;
      }).join('')}
    </div>`;
  }

  function results(ctx) {
    const { apps, ui, settings, today } = ctx;
    if (!apps.length) {
      return emptyState({ icon: 'bi-inbox', title: 'No applications yet', text: 'Your job search starts here. Add your first application to keep every opportunity organized.', action: '<button class="btn btn-primary" data-action="add-app"><i class="bi bi-plus-lg"></i> Add Application</button>' });
    }
    const boardMode = settings.listView === 'board';
    const filters = boardMode ? { ...ui.filters, status: 'all' } : ui.filters;
    const list = JT.filters.sortApplications(JT.filters.filterApplications(apps, filters), settings.sort);
    if (!list.length) {
      return emptyState({ icon: 'bi-search', title: 'No applications found', text: 'No applications match your search. Try another company name or change the filters.', action: '<button class="btn btn-outline-secondary" data-action="clear-filters">Clear filters</button>' });
    }
    return boardMode ? board(list, today) : applicationsTable(list, today);
  }

  function resultsCount(ctx) {
    const { apps, ui, settings } = ctx;
    const filters = settings.listView === 'board' ? { ...ui.filters, status: 'all' } : ui.filters;
    const n = JT.filters.filterApplications(apps, filters).length;
    return `Showing <b>${n}</b> of ${apps.length} applications${JT.filters.hasActiveFilters(filters) ? ' (filtered)' : ''}`;
  }

  /* ---------- Application details ---------- */

  function stepper(app) {
    const closed = JT.applications.isClosed(app);
    const currentIdx = JT.PIPELINE.indexOf(app.status);
    const reachedIdx = Math.max(...JT.PIPELINE.map((s, i) => (JT.applications.hasReached(app, s) ? i : -1)));
    return `<ol class="stepper ${closed ? 'is-closed' : ''}" aria-label="Application stage">
      ${JT.PIPELINE.map((s, i) => {
        const m = JT.STATUS_META[s];
        let cls = 'todo';
        if (!closed && i < currentIdx) cls = 'done';
        if (closed && i <= reachedIdx) cls = 'done';
        if (i === currentIdx) cls = 'current';
        return `<li class="step ${cls} s-${m.tone}"><button type="button" data-action="set-status" data-id="${esc(app.id)}" data-status="${s}" ${i === currentIdx ? 'aria-current="step"' : ''} aria-label="Set status to ${s}${cls === 'done' ? ' (passed)' : ''}">
          <span class="step-dot"><i class="bi ${cls === 'done' ? 'bi-check-lg' : m.icon}" aria-hidden="true"></i></span><span class="step-label">${s}</span></button></li>`;
      }).join('')}
    </ol>
    <div class="d-flex gap-2 flex-wrap mt-3 align-items-center">
      ${closed ? `<span class="closed-banner s-${JT.STATUS_META[app.status].tone}">${statusBadge(app.status)} <span>This application is closed. Pick any stage above to reopen it.</span></span>`
        : `<button class="btn btn-sm btn-outline-danger" data-action="set-status" data-id="${esc(app.id)}" data-status="Rejected"><i class="bi bi-x-octagon" aria-hidden="true"></i> Mark Rejected</button>
           <button class="btn btn-sm btn-outline-secondary" data-action="set-status" data-id="${esc(app.id)}" data-status="Withdrawn"><i class="bi bi-box-arrow-left" aria-hidden="true"></i> Withdraw</button>`}
    </div>`;
  }

  function timeline(app) {
    const items = [];
    items.push({ at: app.createdAt, icon: 'bi-plus-circle', tone: 'primary', text: 'Application added to tracker' });
    app.statusHistory.forEach((h, i) => {
      if (i === 0 && h.status === 'Interested') return;
      const m = JT.STATUS_META[h.status];
      items.push({ at: h.at, icon: m.icon, tone: m.tone, text: i === 0 ? `Started as <b>${h.status}</b>` : `Status changed to <b>${h.status}</b>` });
    });
    app.followUpLog.forEach((f) => items.push({ at: f.completedAt, icon: 'bi-check2-circle', tone: 'offer', text: `Follow-up for ${esc(U.formatDate(f.date))} completed${f.note ? ` — <i>${esc(f.note)}</i>` : ''}` }));
    app.notesLog.forEach((n) => items.push({ at: n.at, icon: 'bi-journal-text', tone: 'interested', text: 'Note added' }));
    items.sort((a, b) => b.at.localeCompare(a.at));
    return `<ol class="timeline">${items.map((it) => `<li class="tl-item" data-flip="tl-${esc(it.at)}-${it.icon}"><span class="tl-dot s-${it.tone}"><i class="bi ${it.icon}" aria-hidden="true"></i></span>
      <div><div class="tl-text">${it.text}</div><time class="tl-time" datetime="${esc(it.at)}">${esc(U.formatDateTime(it.at))}</time></div></li>`).join('')}</ol>`;
  }

  function details(ctx) {
    const { app, today } = ctx;
    if (!app) {
      return `<div class="panel">${emptyState({ icon: 'bi-question-octagon', title: 'Application not found', text: 'This application no longer exists. It may have been deleted, or the link is out of date.', action: '<a class="btn btn-primary" href="#/applications">Back to applications</a>' })}</div>`;
    }
    const st = FU().getFollowUpState(app, today);
    const fm = FU().STATE_META[st];
    const r = app.recruiter;
    const hasContact = JT.applications.hasContact(app);
    const field = (label, value, icon) => `<div class="kv"><dt><i class="bi ${icon}" aria-hidden="true"></i> ${label}</dt><dd>${value || '<span class="text-muted">Not added</span>'}</dd></div>`;

    return `
    <nav aria-label="breadcrumb" class="mb-2"><ol class="breadcrumb small"><li class="breadcrumb-item"><a href="#/applications">Applications</a></li><li class="breadcrumb-item active" aria-current="page">${esc(app.company)}</li></ol></nav>
    <div class="panel detail-hero mb-3">
      <div class="d-flex gap-3 align-items-start flex-wrap">
        ${monogram(app.company, 'lg')}
        <div class="flex-grow-1 min-w-0">
          <h1 class="h3 mb-1">${esc(app.jobTitle)}</h1>
          <p class="mb-2 fs-5">${esc(app.company)}</p>
          <div class="d-flex gap-2 flex-wrap align-items-center">${statusBadge(app.status)}${priorityTag(app.priority)}
            <span class="tag"><i class="bi bi-briefcase" aria-hidden="true"></i>${esc(app.jobType)}</span>
            ${app.location ? `<span class="tag"><i class="bi bi-geo-alt" aria-hidden="true"></i>${esc(app.location)}</span>` : ''}
            <span class="tag mono"><i class="bi bi-hash" aria-hidden="true"></i>${esc(app.id)}</span></div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          ${app.jobUrl ? `<a class="btn btn-outline-secondary" href="${esc(app.jobUrl)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> Job posting</a>` : ''}
          <button class="btn btn-primary" data-action="edit-app" data-id="${esc(app.id)}"><i class="bi bi-pencil" aria-hidden="true"></i> Edit</button>
          <button class="btn btn-outline-danger" data-action="delete-app" data-id="${esc(app.id)}"><i class="bi bi-trash3" aria-hidden="true"></i> Delete</button>
        </div>
      </div>
      <h2 class="eyebrow mt-4 mb-2">Update status</h2>
      ${stepper(app)}
    </div>

    <div class="row g-3">
      <div class="col-lg-8 d-flex flex-column gap-3">
        <section class="panel" aria-labelledby="jd-title">
          <div class="panel-head"><h2 class="panel-title" id="jd-title"><i class="bi bi-file-earmark-text" aria-hidden="true"></i> Job details</h2></div>
          <dl class="kv-grid">
            ${field('Applied on', esc(U.formatDate(app.applicationDate)), 'bi-calendar-check')}
            ${field('Deadline', app.deadline ? `${esc(U.formatDate(app.deadline))} <span class="text-muted small">(${esc(U.relativeDays(app.deadline, today))})</span>` : '', 'bi-hourglass-split')}
            ${field('Interview', app.interviewDate ? `${esc(U.formatDate(app.interviewDate))} <span class="text-muted small">(${esc(U.relativeDays(app.interviewDate, today))})</span>` : '', 'bi-camera-video')}
            ${field('Salary / stipend', esc(app.salary), 'bi-cash-coin')}
            ${field('Job link', app.jobUrl ? `<a href="${esc(app.jobUrl)}" target="_blank" rel="noopener noreferrer" class="text-break">${esc(app.jobUrl)}</a>` : '', 'bi-link-45deg')}
            ${field('Last updated', esc(U.formatDateTime(app.updatedAt)), 'bi-arrow-repeat')}
          </dl>
        </section>

        <section class="panel" aria-labelledby="notes-title">
          <div class="panel-head"><h2 class="panel-title" id="notes-title"><i class="bi bi-journal-text" aria-hidden="true"></i> Notes</h2><span class="mono small text-xp">+${JT.game.XP_RULES.note} XP / note</span></div>
          ${app.notes ? `<p class="notes-main">${esc(app.notes).replace(/\n/g, '<br>')}</p>` : ''}
          <form class="note-form" data-form="note" data-id="${esc(app.id)}">
            <label for="note-input" class="visually-hidden">Add a timestamped note</label>
            <div class="input-group"><input id="note-input" name="note" class="form-control" maxlength="1000" placeholder="Add a timestamped note — e.g. interview prep, feedback…" autocomplete="off">
            <button class="btn btn-primary" type="submit"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add</button></div>
          </form>
          <ul class="note-list">
            ${[...app.notesLog].reverse().map((n) => `<li class="note-item" data-flip="note-${esc(n.id)}"><div class="flex-grow-1 min-w-0"><p class="mb-1">${esc(n.text)}</p><time class="tl-time" datetime="${esc(n.at)}">${esc(U.formatDateTime(n.at))}</time></div>
              <button class="btn btn-icon btn-sm" data-action="delete-note" data-id="${esc(app.id)}" data-note="${esc(n.id)}" aria-label="Delete note"><i class="bi bi-x-lg"></i></button></li>`).join('')
              || (app.notes ? '' : '<li class="text-muted small">No notes yet.</li>')}
          </ul>
        </section>

        <section class="panel" aria-labelledby="hist-title">
          <div class="panel-head"><h2 class="panel-title" id="hist-title"><i class="bi bi-clock-history" aria-hidden="true"></i> History</h2></div>
          ${timeline(app)}
        </section>
      </div>

      <aside class="col-lg-4 d-flex flex-column gap-3" aria-label="Follow-up and contact">
        <section class="panel fu-card fu-card-${st}" aria-labelledby="fu-title">
          <div class="panel-head"><h2 class="panel-title" id="fu-title"><i class="bi bi-bell" aria-hidden="true"></i> Follow-up</h2>${st !== 'none' ? `<span class="fu-pill fu-${fm.tone}"><i class="bi ${fm.icon}" aria-hidden="true"></i><span class="fu-label">${fm.label}</span></span>` : ''}</div>
          ${st === 'none' ? `<p class="text-muted small">No follow-up scheduled. Set a date so this application shows up when it needs attention.</p>
              <button class="btn btn-primary w-100" data-action="schedule-followup" data-id="${esc(app.id)}"><i class="bi bi-calendar-plus" aria-hidden="true"></i> Schedule Follow-up</button>`
            : `<p class="fu-date mono">${esc(U.formatDate(app.followUpDate))}</p>
              <p class="small text-muted mb-2">${st === 'completed' ? 'Completed. Schedule another when you need to check in again.' : esc(U.relativeDays(app.followUpDate, today).replace(/^./, (c) => c.toUpperCase()))}</p>
              ${st === 'overdue' ? '<div class="alert alert-overdue small" role="alert"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> This follow-up is overdue. Review the application and decide whether to contact the company or reschedule it.</div>' : ''}
              ${st === 'inactive' ? '<p class="small text-muted">This application is closed, so the follow-up is hidden from active lists.</p>' : ''}
              ${app.followUpNote ? `<p class="fu-note"><i class="bi bi-chat-left-text" aria-hidden="true"></i> ${esc(app.followUpNote)}</p>` : ''}
              <div class="d-grid gap-2">
                ${['overdue', 'today', 'upcoming'].includes(st) ? `<button class="btn btn-success" data-action="complete-followup" data-id="${esc(app.id)}"><i class="bi bi-check2-circle" aria-hidden="true"></i> Mark Follow-up Complete <span class="xp-hint">+${JT.game.XP_RULES.followup} XP</span></button>` : ''}
                <div class="d-flex gap-2">
                  <button class="btn btn-outline-secondary flex-fill" data-action="snooze" data-days="3" data-id="${esc(app.id)}">+3 days</button>
                  <button class="btn btn-outline-secondary flex-fill" data-action="snooze" data-days="7" data-id="${esc(app.id)}">+1 week</button>
                </div>
                <button class="btn btn-outline-primary" data-action="schedule-followup" data-id="${esc(app.id)}"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ${st === 'completed' ? 'Schedule another' : 'Pick a date'}</button>
                <button class="btn btn-link btn-sm text-muted" data-action="clear-followup" data-id="${esc(app.id)}">Clear follow-up</button>
              </div>`}
          ${app.followUpLog.length ? `<details class="mt-3"><summary class="small">Completed follow-ups (${app.followUpLog.length})</summary><ul class="small list-unstyled mt-2 mb-0">${[...app.followUpLog].reverse().map((f) => `<li class="mb-1"><i class="bi bi-check2 text-success" aria-hidden="true"></i> ${esc(U.formatDate(f.date))}${f.note ? ` — ${esc(f.note)}` : ''}</li>`).join('')}</ul></details>` : ''}
        </section>

        <section class="panel" aria-labelledby="ct-title">
          <div class="panel-head"><h2 class="panel-title" id="ct-title"><i class="bi bi-person-badge" aria-hidden="true"></i> Recruiter contact</h2></div>
          ${hasContact ? `<div class="contact-block">
              <div class="d-flex align-items-center gap-2 mb-2"><span class="mono-avatar t-1 sm" aria-hidden="true">${esc(U.initials(r.name || r.email))}</span><b>${esc(r.name || 'Unnamed contact')}</b></div>
              ${r.email ? `<div class="contact-line"><i class="bi bi-envelope" aria-hidden="true"></i><a href="mailto:${esc(r.email)}" class="text-break">${esc(r.email)}</a><button class="btn btn-icon btn-sm ms-auto" data-action="copy" data-text="${esc(r.email)}" aria-label="Copy email"><i class="bi bi-clipboard"></i></button></div>` : ''}
              ${r.phone ? `<div class="contact-line"><i class="bi bi-telephone" aria-hidden="true"></i><a href="tel:${esc(r.phone.replace(/[^\d+]/g, ''))}">${esc(r.phone)}</a><button class="btn btn-icon btn-sm ms-auto" data-action="copy" data-text="${esc(r.phone)}" aria-label="Copy phone number"><i class="bi bi-clipboard"></i></button></div>` : ''}
              <div class="d-flex gap-2 mt-3"><button class="btn btn-sm btn-outline-primary flex-fill" data-action="edit-app" data-id="${esc(app.id)}" data-focus="recruiterName"><i class="bi bi-pencil" aria-hidden="true"></i> Edit</button>
              <button class="btn btn-sm btn-outline-secondary flex-fill" data-action="clear-contact" data-id="${esc(app.id)}"><i class="bi bi-eraser" aria-hidden="true"></i> Clear</button></div></div>`
            : `<p class="text-muted small">No recruiter details yet. Many postings don’t list one — add it when you find a contact.</p>
              <button class="btn btn-outline-primary w-100" data-action="edit-app" data-id="${esc(app.id)}" data-focus="recruiterName"><i class="bi bi-person-plus" aria-hidden="true"></i> Add contact</button>`}
        </section>
      </aside>
    </div>`;
  }

  /* ---------- Follow-ups ---------- */

  function calendar(ctx) {
    const { apps, today, ui, settings } = ctx;
    const month = ui.calMonth || today.slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const map = FU().getFollowUpsByDate(apps, today, { includeClosed: settings.showClosedFollowUps });
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push('<span class="cal-cell pad" aria-hidden="true"></span>');
    for (let d = 1; d <= daysInMonth; d += 1) {
      const iso = `${month}-${String(d).padStart(2, '0')}`;
      const items = map[iso] || [];
      const tones = [...new Set(items.map((x) => x.state))];
      cells.push(`<button type="button" class="cal-cell ${iso === today ? 'is-today' : ''} ${ui.calSelected === iso ? 'is-selected' : ''} ${items.length ? 'has-items' : ''}" data-action="cal-day" data-date="${iso}" aria-label="${U.formatDate(iso)}${items.length ? `, ${items.length} follow-up${items.length > 1 ? 's' : ''}` : ''}" aria-pressed="${ui.calSelected === iso}">
        <span>${d}</span>${items.length ? `<span class="cal-dots">${tones.map((t) => `<i class="dot fu-${t}"></i>`).join('')}</span>` : ''}</button>`);
    }
    const selItems = ui.calSelected ? (map[ui.calSelected] || []) : [];
    return `<div class="cal">
      <div class="cal-head"><button class="btn btn-icon btn-sm" data-action="cal-prev" aria-label="Previous month"><i class="bi bi-chevron-left"></i></button>
        <b>${U.MONTHS[m - 1]} ${y}</b><button class="btn btn-icon btn-sm" data-action="cal-next" aria-label="Next month"><i class="bi bi-chevron-right"></i></button></div>
      <div class="cal-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="cal-dow" aria-hidden="true">${d}</span>`).join('')}${cells.join('')}</div>
      <div class="cal-legend small"><span><i class="dot fu-overdue"></i> Overdue</span><span><i class="dot fu-upcoming"></i> Upcoming</span><span><i class="dot fu-completed"></i> Done</span></div>
      ${ui.calSelected ? `<div class="cal-selected mt-3"><p class="eyebrow mb-2">${U.formatDate(ui.calSelected)}</p>${selItems.length ? `<ul class="list-unstyled mb-0">${selItems.map((x) => `<li class="mb-2"><a href="#/app/${encodeURIComponent(x.app.id)}" class="d-flex gap-2 align-items-center">${monogram(x.app.company, 'xs')}<span class="text-truncate">${esc(x.app.company)}</span><span class="ms-auto">${followPill(x.app, today)}</span></a></li>`).join('')}</ul>` : '<p class="small text-muted mb-0">Nothing scheduled on this day.</p>'}</div>` : ''}
    </div>`;
  }

  function followUpsPage(ctx) {
    const { apps, today, settings } = ctx;
    const opts = { includeClosed: settings.showClosedFollowUps };
    const overdue = FU().getOverdueFollowUps(apps, today, opts);
    const upcoming = FU().getUpcomingFollowUps(apps, today, opts);
    const done = FU().getCompletedFollowUps(apps).slice(0, 12);
    const group = (title, icon, tone, list, emptyText) => `<section class="panel fu-group fu-group-${tone}" aria-label="${title}">
      <div class="panel-head"><h2 class="panel-title"><i class="bi ${icon}" aria-hidden="true"></i> ${title} <span class="count-badge ${tone === 'overdue' && list.length ? 'danger' : ''}">${list.length}</span></h2></div>
      ${list.length ? `<ul class="fu-list">${list.map((a) => followRow(a, today)).join('')}</ul>` : `<p class="text-muted small mb-0"><i class="bi bi-check2-all" aria-hidden="true"></i> ${emptyText}</p>`}
    </section>`;

    return `
    <div class="page-head">
      <div><p class="eyebrow">Mission log</p><h1 class="h2 mb-0">Follow-ups</h1></div>
      <div class="form-check form-switch m-0">
        <input class="form-check-input" type="checkbox" role="switch" id="show-closed" data-setting="showClosedFollowUps" ${settings.showClosedFollowUps ? 'checked' : ''}>
        <label class="form-check-label small" for="show-closed">Include rejected &amp; withdrawn</label>
      </div>
    </div>
    ${!overdue.length && !upcoming.length ? `<div class="panel mb-3">${emptyState({ icon: 'bi-check2-all', title: 'No follow-ups due', text: 'There are no upcoming or overdue follow-ups. Open an application to schedule one.', action: '<a class="btn btn-outline-primary" href="#/applications">Browse applications</a>' })}</div>` : ''}
    <div class="row g-3">
      <div class="col-lg-8 d-flex flex-column gap-3">
        ${group('Overdue', 'bi-exclamation-triangle', 'overdue', overdue, 'Nothing overdue. Nice discipline!')}
        ${group('Due today & upcoming', 'bi-calendar-event', 'upcoming', upcoming, 'No upcoming follow-ups scheduled.')}
        <section class="panel fu-group" aria-label="Completed">
          <div class="panel-head"><h2 class="panel-title"><i class="bi bi-check2-circle" aria-hidden="true"></i> Completed <span class="count-badge">${FU().getCompletedFollowUps(apps).length}</span></h2></div>
          ${done.length ? `<ul class="done-list">${done.map((d) => `<li data-flip="done-${esc(d.app.id)}-${esc(d.completedAt)}"><i class="bi bi-check2-circle text-success" aria-hidden="true"></i>
            <a href="#/app/${encodeURIComponent(d.app.id)}" class="fw-medium">${esc(d.app.company)}</a><span class="text-muted small text-truncate">${esc(d.app.jobTitle)}${d.note ? ` · ${esc(d.note)}` : ''}</span>
            <span class="ms-auto mono small text-muted text-nowrap">Done ${esc(U.formatDate(U.localDateOf(d.completedAt), { short: true }))}</span></li>`).join('')}</ul>`
            : '<p class="text-muted small mb-0">Completed follow-ups will appear here.</p>'}
        </section>
      </div>
      <div class="col-lg-4"><section class="panel" aria-label="Follow-up calendar"><div class="panel-head"><h2 class="panel-title"><i class="bi bi-calendar3" aria-hidden="true"></i> Calendar</h2></div>${calendar(ctx)}</section></div>
    </div>`;
  }

  /* ---------- Contacts ---------- */

  function contactsPage(ctx) {
    const { apps, ui } = ctx;
    const all = JT.analytics.getContacts(apps);
    const q = ui.contactQuery.toLowerCase().trim();
    const list = q ? all.filter((c) => `${c.name} ${c.email} ${c.apps.map((a) => a.company).join(' ')}`.toLowerCase().includes(q)) : all;
    return `
    <div class="page-head"><div><p class="eyebrow">Party</p><h1 class="h2 mb-0">Contacts</h1></div>
      <div class="search-box" style="min-width:min(320px,100%)"><i class="bi bi-search" aria-hidden="true"></i><label class="visually-hidden" for="contact-search">Search contacts</label>
      <input id="contact-search" type="search" class="form-control" placeholder="Search name, email or company…" value="${esc(ui.contactQuery)}" data-contact-search autocomplete="off"></div></div>
    <p class="small text-muted">Contacts are stored on each application, so editing a contact here means editing its application.</p>
    ${!all.length ? `<div class="panel">${emptyState({ icon: 'bi-person-lines-fill', title: 'No recruiter contacts yet', text: 'Add recruiter details to an application and they’ll show up here.' })}</div>`
      : !list.length ? `<div class="panel">${emptyState({ icon: 'bi-search', title: 'No contacts match', text: 'Try another name, email or company.' })}</div>`
      : `<div class="row g-3">${list.map((c) => `<div class="col-md-6 col-xl-4"><article class="panel contact-card h-100" data-tilt>
          <div class="d-flex align-items-center gap-2 mb-2"><span class="mono-avatar t-${U.hashIndex(c.key, 6)}" aria-hidden="true">${esc(U.initials(c.name || c.email))}</span><div class="min-w-0"><b class="d-block text-truncate">${esc(c.name || 'Unnamed contact')}</b><span class="small text-muted">${c.apps.length} application${c.apps.length > 1 ? 's' : ''}</span></div></div>
          ${c.email ? `<div class="contact-line"><i class="bi bi-envelope" aria-hidden="true"></i><a href="mailto:${esc(c.email)}" class="text-break">${esc(c.email)}</a><button class="btn btn-icon btn-sm ms-auto" data-action="copy" data-text="${esc(c.email)}" aria-label="Copy email ${esc(c.email)}"><i class="bi bi-clipboard"></i></button></div>` : ''}
          ${c.phone ? `<div class="contact-line"><i class="bi bi-telephone" aria-hidden="true"></i><a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a></div>` : ''}
          <div class="mt-2 d-flex flex-wrap gap-1">${c.apps.map((a) => `<a class="tag tag-link" href="#/app/${encodeURIComponent(a.id)}">${esc(a.company)} ${statusBadge(a.status, 'xs')}</a>`).join('')}</div>
        </article></div>`).join('')}</div>`}`;
  }

  /* ---------- Trophies ---------- */

  function trophiesPage(ctx) {
    const { player, achievements } = ctx;
    const unlocked = achievements.filter((a) => a.unlocked).length;
    const b = player.breakdown;
    const rows = [
      ['Applications logged', b.applications, 'bi-plus-square'], ['Stage progress', b.progress, 'bi-signpost-split'],
      ['Follow-ups completed', b.followups, 'bi-check2-square'], ['Notes written', b.notes, 'bi-journal-text'], ['Daily quests', b.quests, 'bi-list-check'],
    ];
    const recent = player.events.filter((e) => e.xp > 0).slice(0, 10);
    const evText = (e) => ({
      created: `Logged <b>${esc(e.app.company)}</b>`,
      status: `<b>${esc(e.app.company)}</b> → ${esc(e.status)}`,
      followup: `Followed up with <b>${esc(e.app.company)}</b>`,
      note: `Note on <b>${esc(e.app.company)}</b>`,
    }[e.type]);
    const R = JT.game.XP_RULES;

    return `
    <div class="page-head"><div><p class="eyebrow">Progress</p><h1 class="h2 mb-0">Trophy Room</h1></div></div>
    <div class="row g-3 mb-3">
      <div class="col-lg-5">
        <section class="panel h-100 player-card">
          <div class="d-flex gap-3 align-items-center mb-3">${levelRing(player, 108)}
            <div><p class="eyebrow mb-1">Current rank</p><h2 class="h3 mb-0">${esc(player.rank)}</h2><p class="text-muted mb-0 mono">${player.xp.toLocaleString()} XP</p></div></div>
          ${xpBar(player)}
          <div class="mini-stats mt-3">
            <div><b>${player.streak.current}</b><span>Streak</span></div><div><b>${player.streak.best}</b><span>Best streak</span></div>
            <div><b>${player.questsCompleted}</b><span>Quests done</span></div><div><b>${unlocked}/${achievements.length}</b><span>Trophies</span></div>
          </div>
        </section>
      </div>
      <div class="col-lg-7">
        <section class="panel h-100">
          <div class="panel-head"><h2 class="panel-title"><i class="bi bi-bar-chart-steps" aria-hidden="true"></i> Where your XP comes from</h2></div>
          <ul class="xp-breakdown">${rows.map(([label, v, icon]) => `<li><i class="bi ${icon}" aria-hidden="true"></i><span>${label}</span>
            <span class="xpb-bar"><span style="width:${player.xp ? Math.round((v / player.xp) * 100) : 0}%"></span></span><b class="mono">${v}</b></li>`).join('')}</ul>
          <details class="mt-2"><summary class="small">How XP works</summary>
            <ul class="small text-muted mt-2 mb-0">
              <li>Log an application: +${R.created} XP</li>
              <li>First time an application reaches a stage: Applied +${R.status.Applied}, Assessment +${R.status.Assessment}, Interview +${R.status.Interview}, Offer +${R.status.Offer}, Rejected +${R.status.Rejected} (resilience)</li>
              <li>Complete a follow-up: +${R.followup} XP · Timestamped note: +${R.note} XP (max ${R.notesCapPerApp} per application)</li>
              <li>Each daily quest: +${R.quest} XP. Levels follow 50·L·(L−1) cumulative XP.</li>
              <li>XP is calculated from your records, so it always matches your real progress.</li>
            </ul></details>
        </section>
      </div>
    </div>
    <section class="panel mb-3" aria-labelledby="ach-title">
      <div class="panel-head"><h2 class="panel-title" id="ach-title"><i class="bi bi-award" aria-hidden="true"></i> Achievements <span class="count-badge">${unlocked}/${achievements.length}</span></h2></div>
      <div class="ach-grid">${[...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.pct - a.pct).map((a) => achievementTile(a)).join('')}</div>
    </section>
    <section class="panel" aria-labelledby="log-title">
      <div class="panel-head"><h2 class="panel-title" id="log-title"><i class="bi bi-terminal" aria-hidden="true"></i> XP log</h2></div>
      ${recent.length ? `<ul class="xp-log">${recent.map((e) => `<li><span class="mono small text-muted">${esc(U.timeAgo(e.at))}</span><span class="flex-grow-1 min-w-0 text-truncate">${evText(e)}</span><b class="mono text-xp">+${e.xp}</b></li>`).join('')}</ul>` : '<p class="text-muted small mb-0">No XP earned yet.</p>'}
    </section>`;
  }

  /* ---------- Settings ---------- */

  function settingsPage(ctx) {
    const { settings, apps } = ctx;
    const kb = (JT.storage.usageBytes() / 1024).toFixed(1);
    const sw = (key, label, hint) => `<div class="form-check form-switch setting-row">
      <input class="form-check-input" type="checkbox" role="switch" id="set-${key}" data-setting="${key}" ${settings[key] ? 'checked' : ''}>
      <label class="form-check-label" for="set-${key}"><b>${label}</b><span class="d-block small text-muted">${hint}</span></label></div>`;
    return `
    <div class="page-head"><div><p class="eyebrow">Options</p><h1 class="h2 mb-0">Settings</h1></div></div>
    <div class="row g-3">
      <div class="col-lg-6 d-flex flex-column gap-3">
        <section class="panel" aria-labelledby="pf-title"><div class="panel-head"><h2 class="panel-title" id="pf-title"><i class="bi bi-person-circle" aria-hidden="true"></i> Profile &amp; display</h2></div>
          <form data-form="profile" class="mb-3"><label for="player-name" class="form-label">Display name</label>
            <div class="input-group"><input id="player-name" name="playerName" class="form-control" maxlength="40" value="${esc(settings.playerName)}"><button class="btn btn-outline-primary" type="submit">Save</button></div></form>
          ${sw('sound', 'Sound effects', 'Short retro blips for XP, level-ups and trophies')}
          ${sw('liveBg', '3D particle scene', 'The cosmic particle sculpture behind the app — morphs per screen and reacts to your cursor, clicks and XP')}
          ${sw('reduceMotion', 'Reduce motion', 'Turns off confetti, count-ups and animations')}
        </section>
        <section class="panel" aria-labelledby="kb-title"><div class="panel-head"><h2 class="panel-title" id="kb-title"><i class="bi bi-keyboard" aria-hidden="true"></i> Keyboard shortcuts</h2></div>
          ${shortcutsTable()}</section>
      </div>
      <div class="col-lg-6 d-flex flex-column gap-3">
        <section class="panel" aria-labelledby="data-title"><div class="panel-head"><h2 class="panel-title" id="data-title"><i class="bi bi-database" aria-hidden="true"></i> Your data</h2><span class="mono small text-muted">${apps.length} records · ${kb} KB</span></div>
          <p class="small text-muted">Everything is saved in this browser’s localStorage. Export a backup before clearing browser data.</p>
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button class="btn btn-outline-primary" data-action="export-csv"><i class="bi bi-filetype-csv" aria-hidden="true"></i> Export CSV</button>
            <button class="btn btn-outline-primary" data-action="export-json"><i class="bi bi-filetype-json" aria-hidden="true"></i> Backup JSON</button>
            <button class="btn btn-outline-secondary" data-action="import"><i class="bi bi-upload" aria-hidden="true"></i> Import CSV / JSON</button>
            <input type="file" id="import-file" accept=".csv,.json,text/csv,application/json" class="d-none" aria-label="Choose a CSV or JSON file to import">
          </div>
          <div class="danger-zone"><p class="eyebrow mb-2">Danger zone</p>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-warning" data-action="reset-demo"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Reset demo data</button>
              <button class="btn btn-outline-danger" data-action="clear-all"><i class="bi bi-trash3" aria-hidden="true"></i> Delete all applications</button></div></div>
        </section>
        <section class="panel" aria-labelledby="about-title"><div class="panel-head"><h2 class="panel-title" id="about-title"><i class="bi bi-info-circle" aria-hidden="true"></i> About JobTrack</h2></div>
          <p class="small">A personal job &amp; internship application tracker (PRD PST_PD_044). Built with HTML, CSS, Bootstrap 5 and vanilla JavaScript — no backend, no tracking.</p>
          <ul class="small text-muted mb-0">
            <li>Records are stored only in this browser and don’t sync between devices.</li>
            <li>Clearing browser data removes saved applications — export a backup first.</li>
            <li>Reminders are in-app indicators, not email or push notifications.</li>
            <li>This is a personal tool: there are no user accounts or cloud backups.</li>
            <li>Demo companies, contacts and links are fictional sample data.</li>
          </ul></section>
      </div>
    </div>`;
  }

  function shortcutsTable() {
    const rows = [
      [['Ctrl', 'K'], 'Command palette'], [['N'], 'Add application'], [['/'], 'Search applications'],
      [['G', 'D'], 'Go to dashboard'], [['G', 'A'], 'Go to applications'], [['G', 'F'], 'Go to follow-ups'],
      [['G', 'C'], 'Go to contacts'], [['G', 'T'], 'Go to trophies'], [['G', 'S'], 'Go to settings'],
      [['B'], 'Toggle list / board'], [['?'], 'Show shortcuts'], [['Ctrl', 'Enter'], 'Save the open form'],
    ];
    return `<table class="table table-sm shortcuts mb-0"><tbody>${rows.map(([keys, label]) => `<tr><td class="text-nowrap">${keys.map((k) => `<kbd>${k}</kbd>`).join(' ')}</td><td>${label}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- HUD ---------- */

  function hud(player) {
    return `<span class="hud-level" aria-hidden="true">LV ${player.level}</span>
      <span class="hud-mid d-none d-md-flex d-xl-none d-xxl-flex"><span class="hud-rank">${esc(player.rank)}</span><span class="hud-bar"><span style="width:${player.progress}%"></span></span></span>
      <span class="hud-streak ${player.streak.activeToday ? 'lit' : ''}" aria-hidden="true"><i class="bi bi-fire"></i>${player.streak.current}</span>
      <span class="visually-hidden">Level ${player.level} ${esc(player.rank)}, ${player.progress}% to next level, ${player.streak.current} day streak. Open trophy room.</span>`;
  }

  JT.views = {
    statusBadge, followPill, monogram, priorityTag, emptyState, levelRing, xpBar, achievementTile,
    dashboard, applicationsShell, results, resultsCount, details, followUpsPage, contactsPage, trophiesPage,
    settingsPage, shortcutsTable, hud,
  };
})(globalThis.JT = globalThis.JT || {});
