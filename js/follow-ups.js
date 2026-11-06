/* =========================================================
   follow-ups.js — the follow-up date rules from PRD section 10.6
   - Upcoming: date is today or later, and not completed
   - Overdue:  date is before today, and not completed
   - Completed: the student marked it done
   - Rejected / Withdrawn applications are hidden from active follow-ups
   ========================================================= */

function hasActiveFollowUp(app) {
  return Boolean(app.followUpDate) && !app.followUpCompleted && !CLOSED_STATUSES.includes(app.status);
}

// Returns "overdue" | "today" | "upcoming" | "completed" | "none"
function getFollowUpState(app, today = todayStr()) {
  if (!app.followUpDate) return "none";
  if (app.followUpCompleted) return "completed";
  if (CLOSED_STATUSES.includes(app.status)) return "none";
  if (app.followUpDate < today) return "overdue";
  if (app.followUpDate === today) return "today";
  return "upcoming";
}

function getOverdueFollowUps(apps, today = todayStr()) {
  return apps
    .filter((app) => getFollowUpState(app, today) === "overdue")
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
}

function getDueTodayFollowUps(apps, today = todayStr()) {
  return apps.filter((app) => getFollowUpState(app, today) === "today");
}

function getUpcomingFollowUps(apps, today = todayStr()) {
  // "today" counts as upcoming too (PRD: "today or in the future")
  return apps
    .filter((app) => ["today", "upcoming"].includes(getFollowUpState(app, today)))
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
}

// Every completed follow-up, newest first: [{ app, due, doneOn }]
function getCompletedFollowUps(apps) {
  const done = [];
  apps.forEach((app) => {
    app.followUpHistory.forEach((entry) => done.push({ app, due: entry.due, doneOn: entry.doneOn }));
  });
  return done.sort((a, b) => b.doneOn.localeCompare(a.doneOn));
}

// Short text for badges: "3 days overdue", "Due today", "Due in 2 days"
function followUpLabel(app, today = todayStr()) {
  const state = getFollowUpState(app, today);
  if (state === "overdue") return `${plural(daysBetween(app.followUpDate, today), "day")} overdue`;
  if (state === "today") return "Due today";
  if (state === "upcoming") {
    const days = daysBetween(today, app.followUpDate);
    return days === 1 ? "Due tomorrow" : `Due ${formatDate(app.followUpDate)}`;
  }
  if (state === "completed") return "Done";
  return "";
}
