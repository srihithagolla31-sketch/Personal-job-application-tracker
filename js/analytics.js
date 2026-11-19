/**
 * analytics.js — every dashboard number is derived from the records here.
 * Nothing in this file is ever written to storage (PRD §10.3).
 */
(function (JT) {
  'use strict';

  const U = JT.utils;
  const A = () => JT.applications;
  const F = () => JT.followUps;

  function getApplicationStats(apps, today = U.todayISO()) {
    const byStatus = Object.fromEntries(JT.STATUSES.map((s) => [s, 0]));
    apps.forEach((a) => { byStatus[a.status] += 1; });

    const reachedAny = (a, list) => list.some((s) => A().hasReached(a, s));
    const submitted = apps.filter((a) => reachedAny(a, ['Applied', 'Assessment', 'Interview', 'Offer', 'Rejected'])).length;
    const responded = apps.filter((a) => reachedAny(a, ['Assessment', 'Interview', 'Offer', 'Rejected'])).length;
    const interviewed = apps.filter((a) => reachedAny(a, ['Interview', 'Offer'])).length;
    const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

    return {
      total: apps.length,
      byStatus,
      active: JT.ACTIVE_STATUSES.reduce((sum, s) => sum + byStatus[s], 0),
      interested: byStatus.Interested,
      applied: byStatus.Applied,
      assessments: byStatus.Assessment,
      interviews: byStatus.Interview,
      offers: byStatus.Offer,
      rejected: byStatus.Rejected,
      withdrawn: byStatus.Withdrawn,
      submitted,
      responseRate: pct(responded, submitted),
      interviewRate: pct(interviewed, submitted),
      overdue: F().getOverdueFollowUps(apps, today).length,
      upcoming: F().getUpcomingFollowUps(apps, today).length,
      updatedThisWeek: apps.filter((a) => U.diffDays(U.localDateOf(a.updatedAt), today) <= 7).length,
      contacts: apps.filter(A().hasContact).length,
    };
  }

  /** How many applications have ever reached each pipeline stage (funnel). */
  function getFunnel(apps) {
    return JT.PIPELINE.map((stage) => ({
      stage,
      current: apps.filter((a) => a.status === stage).length,
      reached: apps.filter((a) => A().hasReached(a, stage)).length,
    }));
  }

  function getRecentlyUpdated(apps, limit = 5) {
    return [...apps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }

  /** Flattens every record into a timeline of activity events (newest first). */
  function getActivityEvents(apps) {
    const events = [];
    apps.forEach((app) => {
      events.push({ type: 'created', at: app.createdAt, app });
      app.statusHistory.forEach((h, i) => events.push({ type: 'status', status: h.status, at: h.at, app, initial: i === 0 }));
      app.followUpLog.forEach((f) => events.push({ type: 'followup', at: f.completedAt, app, note: f.note }));
      app.notesLog.forEach((n) => events.push({ type: 'note', at: n.at, app, text: n.text }));
    });
    events.forEach((e) => { e.date = U.localDateOf(e.at); });
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }

  /** GitHub-style activity grid ending with the current week. */
  function getHeatmap(events, today = U.todayISO(), weeks = 18) {
    const counts = {};
    events.forEach((e) => {
      if (e.type === 'status' && e.initial) return; // counted by "created"
      counts[e.date] = (counts[e.date] || 0) + 1;
    });
    const t = U.parseISODate(today);
    const mondayOffset = (t.getDay() + 6) % 7; // Monday-first weeks
    const start = U.addDays(today, -mondayOffset - (weeks - 1) * 7);
    const cells = [];
    let max = 0;
    for (let i = 0; i < weeks * 7; i += 1) {
      const date = U.addDays(start, i);
      const count = counts[date] || 0;
      max = Math.max(max, count);
      cells.push({ date, count, future: date > today });
    }
    cells.forEach((c) => {
      c.level = c.count === 0 ? 0 : Math.min(4, Math.ceil((c.count / Math.max(max, 1)) * 4));
    });
    const months = [];
    for (let w = 0; w < weeks; w += 1) {
      const d = U.parseISODate(cells[w * 7].date);
      const prev = w > 0 ? U.parseISODate(cells[(w - 1) * 7].date) : null;
      months.push(!prev || prev.getMonth() !== d.getMonth() ? U.MONTHS[d.getMonth()] : '');
    }
    const total = cells.reduce((s, c) => s + c.count, 0);
    return { cells, weeks, months, max, total };
  }

  /** Unique recruiter contacts, each linked to the applications they belong to. */
  function getContacts(apps) {
    const map = new Map();
    apps.filter(A().hasContact).forEach((app) => {
      const r = app.recruiter;
      const key = (r.email || r.name || r.phone).toLowerCase();
      if (!map.has(key)) map.set(key, { key, name: r.name, email: r.email, phone: r.phone, apps: [] });
      const c = map.get(key);
      c.name = c.name || r.name;
      c.email = c.email || r.email;
      c.phone = c.phone || r.phone;
      c.apps.push(app);
    });
    return [...map.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }

  JT.analytics = { getApplicationStats, getFunnel, getRecentlyUpdated, getActivityEvents, getHeatmap, getContacts };
})(globalThis.JT = globalThis.JT || {});
