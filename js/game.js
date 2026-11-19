/**
 * game.js — the progression layer. XP, level, streak and quest progress are
 * DERIVED from the application records (never stored), so they can't drift
 * out of sync with the data. Only "achievement unlocked at" timestamps and the
 * last-seen level are persisted, purely to know when to celebrate.
 *
 * Anti-farming: status XP is awarded once per status per application, notes
 * cap at 5 per application, and each daily quest pays out once per day.
 */
(function (JT) {
  'use strict';

  const U = JT.utils;

  const XP_RULES = {
    created: 10,
    followup: 15,
    note: 5,
    notesCapPerApp: 5,
    quest: 20,
    status: { Interested: 0, Applied: 15, Assessment: 25, Interview: 40, Offer: 120, Rejected: 10, Withdrawn: 0 },
  };

  const RANKS = [
    [1, 'Rookie'], [2, 'Scout'], [3, 'Applicant'], [4, 'Contender'], [5, 'Challenger'],
    [6, 'Interview Ace'], [8, 'Closer'], [10, 'Career Legend'],
  ];

  /** Cumulative XP needed to reach `level` (L1 = 0, L2 = 100, L3 = 300, L4 = 600 …). */
  const xpForLevel = (level) => 50 * level * (level - 1);
  const levelFromXp = (xp) => Math.max(1, Math.floor((1 + Math.sqrt(1 + (0.08 * Math.max(0, xp)))) / 2));
  const rankFor = (level) => RANKS.reduce((r, [min, name]) => (level >= min ? name : r), RANKS[0][1]);

  const DAILY_QUESTS = [
    { id: 'log', title: 'Log a new application', icon: 'bi-plus-square', target: 1, count: (evs) => evs.filter((e) => e.type === 'created').length },
    { id: 'move', title: 'Update 2 application statuses', icon: 'bi-arrow-up-right-square', target: 2, count: (evs) => evs.filter((e) => e.type === 'status' && !e.initial).length },
    { id: 'follow', title: 'Complete a follow-up', icon: 'bi-check2-square', target: 1, count: (evs) => evs.filter((e) => e.type === 'followup').length },
  ];

  function questProgress(dayEvents) {
    return DAILY_QUESTS.map((q) => {
      const current = Math.min(q.count(dayEvents), q.target);
      return { ...q, current, done: current >= q.target };
    });
  }

  function computeStreaks(dates, today) {
    const set = new Set(dates);
    let current = 0;
    let cursor = set.has(today) ? today : U.addDays(today, -1);
    while (set.has(cursor)) { current += 1; cursor = U.addDays(cursor, -1); }
    let best = 0;
    let run = 0;
    let prev = null;
    [...set].sort().forEach((d) => {
      run = prev && U.diffDays(prev, d) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    });
    return { current, best: Math.max(best, current), activeToday: set.has(today) };
  }

  /** Full player snapshot derived from the records. */
  function getPlayer(apps, today = U.todayISO()) {
    const events = JT.analytics.getActivityEvents(apps);
    const ascending = [...events].reverse();
    const seenStatus = new Set();
    const notesPerApp = {};
    const breakdown = { applications: 0, progress: 0, followups: 0, notes: 0, quests: 0 };

    ascending.forEach((e) => {
      let xp = 0;
      if (e.type === 'created') { xp = XP_RULES.created; breakdown.applications += xp; }
      if (e.type === 'status') {
        const key = `${e.app.id}:${e.status}`;
        if (!seenStatus.has(key)) { seenStatus.add(key); xp = XP_RULES.status[e.status] || 0; breakdown.progress += xp; }
      }
      if (e.type === 'followup') { xp = XP_RULES.followup; breakdown.followups += xp; }
      if (e.type === 'note') {
        notesPerApp[e.app.id] = (notesPerApp[e.app.id] || 0) + 1;
        if (notesPerApp[e.app.id] <= XP_RULES.notesCapPerApp) { xp = XP_RULES.note; breakdown.notes += xp; }
      }
      e.xp = xp;
    });

    const byDay = {};
    events.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e); });
    let questsCompleted = 0;
    Object.values(byDay).forEach((dayEvents) => {
      questsCompleted += questProgress(dayEvents).filter((q) => q.done).length;
    });
    breakdown.quests = questsCompleted * XP_RULES.quest;

    const xp = Object.values(breakdown).reduce((s, v) => s + v, 0);
    const level = levelFromXp(xp);
    const floor = xpForLevel(level);
    const next = xpForLevel(level + 1);
    const activityDates = events.filter((e) => !(e.type === 'status' && e.initial)).map((e) => e.date);

    return {
      xp,
      level,
      rank: rankFor(level),
      floor,
      next,
      intoLevel: xp - floor,
      levelSpan: next - floor,
      progress: Math.round(((xp - floor) / (next - floor)) * 100),
      breakdown,
      questsCompleted,
      quests: questProgress(byDay[today] || []),
      streak: computeStreaks(activityDates, today),
      events,
      todayXp: (byDay[today] || []).reduce((s, e) => s + (e.xp || 0), 0)
        + questProgress(byDay[today] || []).filter((q) => q.done).length * XP_RULES.quest,
    };
  }

  const TIERS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

  const ACHIEVEMENTS = [
    { id: 'first_step', title: 'First Step', desc: 'Log your first application.', icon: 'bi-flag', tier: 'bronze', progress: (c) => [c.apps.length, 1] },
    { id: 'momentum', title: 'Momentum', desc: 'Track 5 applications.', icon: 'bi-lightning-charge', tier: 'bronze', progress: (c) => [c.apps.length, 5] },
    { id: 'pipeline', title: 'Pipeline Builder', desc: 'Track 15 applications.', icon: 'bi-diagram-3', tier: 'silver', progress: (c) => [c.apps.length, 15] },
    { id: 'test_ready', title: 'Test Ready', desc: 'Reach an assessment stage.', icon: 'bi-code-slash', tier: 'bronze', progress: (c) => [c.reached('Assessment'), 1] },
    { id: 'face_time', title: 'Face Time', desc: 'Land your first interview.', icon: 'bi-camera-video', tier: 'silver', progress: (c) => [c.reached('Interview'), 1] },
    { id: 'hat_trick', title: 'Hat Trick', desc: 'Reach the interview stage 3 times.', icon: 'bi-stars', tier: 'gold', progress: (c) => [c.reached('Interview'), 3] },
    { id: 'offer', title: 'Offer Unlocked', desc: 'Receive a job offer.', icon: 'bi-trophy', tier: 'gold', progress: (c) => [c.reached('Offer'), 1] },
    { id: 'follow_through', title: 'Follow Through', desc: 'Complete your first follow-up.', icon: 'bi-reply', tier: 'bronze', progress: (c) => [c.followups, 1] },
    { id: 'relentless', title: 'Relentless', desc: 'Complete 10 follow-ups.', icon: 'bi-arrow-repeat', tier: 'gold', progress: (c) => [c.followups, 10] },
    { id: 'networker', title: 'Networker', desc: 'Save 3 recruiter contacts.', icon: 'bi-person-lines-fill', tier: 'silver', progress: (c) => [c.contacts, 3] },
    { id: 'on_fire', title: 'On Fire', desc: 'Keep a 3-day activity streak.', icon: 'bi-fire', tier: 'bronze', progress: (c) => [c.player.streak.best, 3] },
    { id: 'unstoppable', title: 'Unstoppable', desc: 'Keep a 7-day activity streak.', icon: 'bi-rocket-takeoff', tier: 'silver', progress: (c) => [c.player.streak.best, 7] },
    { id: 'thick_skin', title: 'Thick Skin', desc: 'Log 3 rejections and keep going.', icon: 'bi-shield-check', tier: 'silver', progress: (c) => [c.reached('Rejected'), 3] },
    { id: 'wide_net', title: 'Wide Net', desc: 'Apply across 3 job types.', icon: 'bi-grid-3x3-gap', tier: 'bronze', progress: (c) => [new Set(c.apps.map((a) => a.jobType)).size, 3] },
    { id: 'note_taker', title: 'Note Taker', desc: 'Write 10 timestamped notes.', icon: 'bi-journal-text', tier: 'bronze', progress: (c) => [c.notes, 10] },
    {
      id: 'caught_up', title: 'All Caught Up', desc: 'Have 3+ follow-ups scheduled with none overdue.', icon: 'bi-check2-all', tier: 'silver',
      progress: (c) => [c.stats.overdue === 0 ? Math.min(c.stats.upcoming, 3) : 0, 3],
    },
  ];

  /**
   * Evaluates every achievement. `unlockedStore` is { id: timestamp } of
   * achievements already earned — once earned, a badge stays earned.
   */
  function evaluateAchievements(apps, player, unlockedStore = {}, today = U.todayISO()) {
    const stats = JT.analytics.getApplicationStats(apps, today);
    const ctx = {
      apps,
      stats,
      player,
      reached: (s) => apps.filter((a) => JT.applications.hasReached(a, s)).length,
      followups: apps.reduce((s, a) => s + a.followUpLog.length, 0),
      notes: apps.reduce((s, a) => s + a.notesLog.length, 0),
      contacts: JT.analytics.getContacts(apps).length,
    };
    return ACHIEVEMENTS.map((a) => {
      const [current, target] = a.progress(ctx);
      const earnedNow = current >= target;
      return {
        ...a,
        current: Math.min(current, target),
        target,
        pct: Math.round((Math.min(current, target) / target) * 100),
        unlocked: earnedNow || Boolean(unlockedStore[a.id]),
        earnedNow,
        unlockedAt: unlockedStore[a.id] || null,
      };
    });
  }

  JT.game = { XP_RULES, RANKS, TIERS, DAILY_QUESTS, ACHIEVEMENTS, xpForLevel, levelFromXp, rankFor, computeStreaks, getPlayer, evaluateAchievements };
})(globalThis.JT = globalThis.JT || {});
