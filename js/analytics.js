/* =========================================================
   analytics.js — every dashboard number is CALCULATED here
   from the applications array. Nothing is hard-coded or stored twice.
   ========================================================= */

function countByStatus(apps) {
  const counts = {};
  STATUSES.forEach((s) => (counts[s] = 0));
  apps.forEach((app) => counts[app.status]++);
  return counts;
}

function getApplicationStats(apps, today = todayStr()) {
  const byStatus = countByStatus(apps);
  return {
    total: apps.length,
    active: apps.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
    byStatus,
    interviews: byStatus.Interview,
    offers: byStatus.Offer,
    rejected: byStatus.Rejected,
    overdue: getOverdueFollowUps(apps, today).length,
    upcoming: getUpcomingFollowUps(apps, today).length
  };
}

function getRecentlyUpdated(apps, limit = 5) {
  return [...apps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

/* ---------- Momentum: celebrate EFFORT, not only results ---------- */
function getMomentum(apps, today = todayStr()) {
  const thisWeek = startOfWeek(today);
  const inThisWeek = (date) => date >= thisWeek && date <= today;

  // Real applications only (not "Interested" bookmarks)
  const applied = apps.filter((a) => a.status !== "Interested" || a.statusHistory.length > 1);

  const appliedThisWeek = applied.filter((a) => inThisWeek(a.applicationDate)).length;
  const followUpsThisWeek = apps.reduce(
    (sum, a) => sum + a.followUpHistory.filter((f) => inThisWeek(f.doneOn)).length, 0
  );
  const stepsForwardThisWeek = apps.reduce(
    (sum, a) => sum + a.statusHistory.filter((h) =>
      ["Assessment", "Interview", "Offer"].includes(h.status) && inThisWeek(h.date)).length, 0
  );

  // Applications per week for the last 8 weeks (oldest -> newest)
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    weeks.push({
      start,
      count: applied.filter((a) => a.applicationDate >= start && a.applicationDate <= end).length
    });
  }

  // Streak: weeks in a row with at least one application.
  // If this week has none YET, we start counting from last week (the week isn't over).
  let streak = 0;
  let index = weeks.length - 1;
  if (weeks[index].count === 0) index--;
  while (index >= 0 && weeks[index].count > 0) {
    streak++;
    index--;
  }

  return { appliedThisWeek, followUpsThisWeek, stepsForwardThisWeek, weeks, streak };
}

/* ---------- What's working: which source gets you to the next round ---------- */
function reachedNextRound(app) {
  return app.statusHistory.some((h) => ["Assessment", "Interview", "Offer"].includes(h.status));
}

function getSourceInsights(apps) {
  const applied = apps.filter((a) => a.status !== "Interested");
  const rows = SOURCES.map((source) => {
    const group = applied.filter((a) => a.source === source);
    const progressed = group.filter(reachedNextRound).length;
    return {
      source,
      total: group.length,
      progressed,
      rate: group.length ? progressed / group.length : 0
    };
  }).filter((row) => row.total > 0);

  rows.sort((a, b) => b.rate - a.rate || b.total - a.total);

  // Only call something "best" when there's at least 2 applications behind it
  const best = rows.find((r) => r.total >= 2 && r.progressed > 0) || null;
  return { rows, best };
}

/* ---------- The journey (pipeline) ---------- */
function getPipeline(apps) {
  const counts = countByStatus(apps);
  return {
    stages: ACTIVE_STATUSES.map((status) => ({ status, count: counts[status] })),
    rejected: counts.Rejected,
    withdrawn: counts.Withdrawn
  };
}

/* ---------- Friendly line under the greeting ---------- */
function getEncouragement(apps, momentum, plan) {
  if (apps.length === 0) return "Your job search starts here. Add your first application to keep every opportunity organised.";
  const offers = apps.filter((a) => a.status === "Offer").length;
  const urgent = plan.filter((p) => p.action.urgency === "now").length;

  if (offers > 0 && urgent === 0) return `You have ${plural(offers, "offer")} on the table. Take a moment — you earned this.`;
  if (momentum.appliedThisWeek >= 3) return `${momentum.appliedThisWeek} applications this week. That's real momentum — keep it going.`;
  if (urgent > 0) return `${plural(urgent, "thing needs", "things need")} you today. Knock ${urgent === 1 ? "it" : "them"} out and the rest of the day is yours.`;
  if (momentum.appliedThisWeek === 0) return "A fresh week. One application today gets the ball rolling.";
  return "You're on top of things. Maybe one more application today?";
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
