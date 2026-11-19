/**
 * follow-ups.js — follow-up state rules (PRD §10.6).
 *  upcoming  : date >= today and not completed
 *  overdue   : date <  today and not completed
 *  completed : explicitly marked complete by the student
 *  inactive  : application is Rejected/Withdrawn (hidden from active lists by default)
 */
(function (JT) {
  'use strict';

  const U = JT.utils;

  const STATE_META = {
    overdue: { label: 'Overdue', icon: 'bi-exclamation-triangle-fill', tone: 'overdue' },
    today: { label: 'Due today', icon: 'bi-alarm-fill', tone: 'today' },
    upcoming: { label: 'Upcoming', icon: 'bi-calendar-event', tone: 'upcoming' },
    completed: { label: 'Done', icon: 'bi-check2-circle', tone: 'completed' },
    inactive: { label: 'Inactive', icon: 'bi-pause-circle', tone: 'inactive' },
    none: { label: 'Not scheduled', icon: 'bi-dash-circle', tone: 'none' },
  };

  function getFollowUpState(app, today = U.todayISO(), { includeClosed = false } = {}) {
    if (!app.followUpDate) return 'none';
    if (!includeClosed && JT.CLOSED_STATUSES.includes(app.status)) return 'inactive';
    if (app.followUpCompleted) return 'completed';
    if (app.followUpDate < today) return 'overdue';
    if (app.followUpDate === today) return 'today';
    return 'upcoming';
  }

  const byDateAsc = (a, b) => a.followUpDate.localeCompare(b.followUpDate) || a.company.localeCompare(b.company);

  function getOverdueFollowUps(apps, today = U.todayISO(), opts = {}) {
    return apps.filter((a) => getFollowUpState(a, today, opts) === 'overdue').sort(byDateAsc);
  }

  function getUpcomingFollowUps(apps, today = U.todayISO(), opts = {}) {
    return apps.filter((a) => ['today', 'upcoming'].includes(getFollowUpState(a, today, opts))).sort(byDateAsc);
  }

  function getCompletedFollowUps(apps) {
    const out = [];
    apps.forEach((app) => app.followUpLog.forEach((entry) => out.push({ app, ...entry })));
    return out.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  function completeFollowUp(apps, id, now = new Date()) {
    const app = apps.find((a) => a.id === id);
    if (!app) throw new Error('This application no longer exists.');
    if (!app.followUpDate) throw new Error('There is no follow-up scheduled for this application.');
    if (app.followUpCompleted) throw new Error('This follow-up is already complete.');
    const ts = now.toISOString();
    return apps.map((a) =>
      a.id === id
        ? {
            ...a,
            followUpCompleted: true,
            followUpLog: [...a.followUpLog, { date: a.followUpDate, completedAt: ts, note: a.followUpNote || '' }],
            updatedAt: ts,
          }
        : a,
    );
  }

  function scheduleFollowUp(apps, id, date, note, now = new Date()) {
    const err = JT.validation.validateFollowUpDate(date);
    if (err) throw new Error(err);
    const ts = now.toISOString();
    return apps.map((a) =>
      a.id === id
        ? {
            ...a,
            followUpDate: date,
            followUpNote: typeof note === 'string' ? note.trim().slice(0, 1000) : a.followUpNote,
            followUpCompleted: false,
            updatedAt: ts,
          }
        : a,
    );
  }

  function clearFollowUp(apps, id, now = new Date()) {
    const ts = now.toISOString();
    return apps.map((a) => (a.id === id ? { ...a, followUpDate: '', followUpNote: '', followUpCompleted: false, updatedAt: ts } : a));
  }

  /** Follow-ups grouped by date for the calendar view. */
  function getFollowUpsByDate(apps, today = U.todayISO(), opts = {}) {
    const map = {};
    apps.forEach((app) => {
      const state = getFollowUpState(app, today, opts);
      if (['overdue', 'today', 'upcoming', 'completed'].includes(state)) {
        (map[app.followUpDate] = map[app.followUpDate] || []).push({ app, state });
      }
    });
    return map;
  }

  JT.followUps = {
    STATE_META, getFollowUpState, getOverdueFollowUps, getUpcomingFollowUps, getCompletedFollowUps,
    completeFollowUp, scheduleFollowUp, clearFollowUp, getFollowUpsByDate,
  };
})(globalThis.JT = globalThis.JT || {});
