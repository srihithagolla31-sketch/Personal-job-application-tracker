/* =========================================================
   pages/dashboard.js — draws the dashboard from the apps array
   ========================================================= */

const KIND_ICONS = {
  interview: "chat",
  "followup-overdue": "alert",
  "followup-today": "bell",
  deadline: "target",
  offer: "award",
  "no-reply": "clock"
};
let showAllSteps = false;

function renderDashboard() {
  const today = todayStr();
  const plan = getTodayPlan(apps, today);
  const momentum = getMomentum(apps, today);
  const stats = getApplicationStats(apps, today);

  renderGreeting(plan, momentum);
  renderTodayPlan(plan);
  renderMomentum(momentum);
  renderStats(stats);
  renderPipeline();
  renderFollowUpPreview(today);
  renderRecent();
  renderSources();
}

/* ---------- Greeting ---------- */
function renderGreeting(plan, momentum) {
  const name = settings.userName ? `, ${settings.userName.split(" ")[0]}` : "";
  document.getElementById("today-date").textContent =
    new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("greeting").textContent = `${greeting()}${name}`;
  document.getElementById("encouragement").textContent = getEncouragement(apps, momentum, plan);

  const side = document.getElementById("hero-side");
  side.innerHTML = momentum.streak > 0
    ? `<div class="streak-card">
         <span class="streak-flame">${icon("flame")}</span>
         <div>
           <p class="streak-number">${plural(momentum.streak, "week")}</p>
           <p class="streak-text">in a row with at least one application. Keep the streak alive!</p>
         </div>
       </div>`
    : `<div class="streak-card">
         <span class="streak-flame muted">${icon("flame")}</span>
         <div>
           <p class="streak-number">Start a streak</p>
           <p class="streak-text">Apply to one role this week to light it up.</p>
         </div>
       </div>`;
}

/* ---------- ★ Your next steps (the coach) ---------- */
function renderTodayPlan(plan) {
  const list = document.getElementById("today-list");
  const count = document.getElementById("today-count");
  const urgent = plan.filter((p) => p.action.urgency === "now").length;
  count.textContent = plan.length ? `${urgent} urgent · ${plan.length} total` : "All clear";
  count.classList.toggle("is-clear", plan.length === 0);

  if (apps.length === 0) {
    list.innerHTML = `<li>${emptyState({
      iconName: "sparkles",
      title: "Your job search starts here",
      text: "Add your first application to keep every opportunity organised. We'll tell you what to do next.",
      actionHtml: `<button class="btn btn-primary" data-action="open-quick-add">${icon("plus")} Add your first application</button>`
    })}</li>`;
    return;
  }
  if (plan.length === 0) {
    list.innerHTML = `<li>${emptyState({
      iconName: "check",
      title: "You're all caught up",
      text: "Nothing needs you right now. A great moment to find one more role to apply for.",
      actionHtml: `<button class="btn btn-primary" data-action="open-quick-add">${icon("plus")} Add application</button>`
    })}</li>`;
    return;
  }

  const visible = showAllSteps ? plan : plan.slice(0, 5);
  list.innerHTML = visible.map(({ app, action }) => `
    <li class="today-item urgency-${action.urgency}">
      <span class="today-icon kind-${action.kind}">${icon(KIND_ICONS[action.kind])}</span>
      <div class="today-body">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <a class="today-title" href="details.html?id=${encodeURIComponent(app.id)}">${escapeHtml(action.title)}</a>
          <span class="urgency-tag">${action.urgency === "now" ? "Today" : "Soon"}</span>
        </div>
        <p class="today-why">${escapeHtml(action.why)}</p>
        <div class="today-actions">
          ${action.buttons.map((b, i) => `
            <button type="button" class="btn btn-sm ${i === 0 ? "btn-primary" : "btn-light"}"
              data-action="${b.action}" data-id="${escapeHtml(app.id)}" ${b.template ? `data-template="${b.template}"` : ""}>
              ${b.label}
            </button>`).join("")}
        </div>
      </div>
    </li>`).join("") +
    (plan.length > 5
      ? `<li class="today-more"><button type="button" class="btn btn-link btn-sm" data-action="toggle-steps">
           ${showAllSteps ? "Show fewer" : `Show ${plan.length - 5} more`}</button></li>`
      : "");
}

/* ---------- Momentum ---------- */
function renderMomentum(m) {
  const max = Math.max(1, ...m.weeks.map((w) => w.count));
  const summary = m.weeks.map((w) => `week of ${formatDate(w.start)}: ${w.count}`).join(", ");
  document.getElementById("momentum").innerHTML = `
    <div class="mini-stats">
      <div class="mini-stat"><span class="mini-number">${m.appliedThisWeek}</span><span class="mini-label">applied</span></div>
      <div class="mini-stat"><span class="mini-number">${m.followUpsThisWeek}</span><span class="mini-label">follow-ups sent</span></div>
      <div class="mini-stat"><span class="mini-number">${m.stepsForwardThisWeek}</span><span class="mini-label">steps forward</span></div>
    </div>
    <div class="week-chart" role="img" aria-label="Applications per week for the last 8 weeks: ${summary}">
      ${m.weeks.map((w, i) => `
        <div class="week-col ${i === m.weeks.length - 1 ? "is-current" : ""}">
          <span class="week-count">${w.count || ""}</span>
          <span class="week-bar" style="height:${Math.max(4, (w.count / max) * 100)}%"></span>
          <span class="week-label">${i === m.weeks.length - 1 ? "This wk" : formatDate(w.start)}</span>
        </div>`).join("")}
    </div>
    <p class="chart-caption">Applications sent per week</p>
    <div class="momentum-tip">${icon("sparkles")}<div><strong>Tip of the day</strong>${escapeHtml(tipOfTheDay())}</div></div>`;
}

// A different practical tip each day (picked by the day of the year)
const TIPS = [
  "Follow up 7–10 days after applying. A short, polite note is enough.",
  "Keep a 'brag list' of projects and wins — it makes interviews much easier.",
  "Ask a senior for a referral. A referral can help your application get noticed.",
  "Tailor the first two lines of your resume to each role. Recruiters skim.",
  "After every interview, write down the questions you were asked. Future you will thank you.",
  "Rejections aren't a verdict on you. Note one lesson and move on to the next one.",
  "Check the eligibility criteria (CGPA, branch, batch) before you apply to a campus drive.",
  "Two focused applications beat ten copy-paste ones."
];
function tipOfTheDay() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((new Date() - start) / 86400000);
  return TIPS[day % TIPS.length];
}

/* ---------- Summary cards ---------- */
function renderStats(s) {
  const cards = [
    { label: "Total applications", value: s.total, sub: `${s.active} still active`, iconName: "briefcase", href: "applications.html", tone: "violet" },
    { label: "Interviews", value: s.interviews, sub: s.interviews ? "You're getting noticed" : "They'll come", iconName: "chat", href: "applications.html?status=Interview", tone: "blue" },
    { label: "Offers", value: s.offers, sub: s.offers ? "Well deserved!" : "Keep going", iconName: "award", href: "applications.html?status=Offer", tone: "green" },
    { label: "Overdue follow-ups", value: s.overdue, sub: `${s.upcoming} upcoming`, iconName: "bell", href: "follow-ups.html", tone: s.overdue ? "amber" : "slate" }
  ];
  document.getElementById("stats").innerHTML = cards.map((c) => `
    <div class="col-6 col-lg-3">
      <a class="stat-card tone-${c.tone}" href="${c.href}">
        <span class="stat-icon">${icon(c.iconName)}</span>
        <span class="stat-value">${c.value}</span>
        <span class="stat-label">${c.label}</span>
        <span class="stat-sub">${c.sub}</span>
      </a>
    </div>`).join("");
}

/* ---------- Journey / pipeline ---------- */
function renderPipeline() {
  const p = getPipeline(apps);
  const activeTotal = p.stages.reduce((sum, s) => sum + s.count, 0);
  const holder = document.getElementById("pipeline");

  if (apps.length === 0) {
    holder.innerHTML = `<p class="text-secondary mb-0">Your journey will appear here once you add an application.</p>`;
    return;
  }

  holder.innerHTML = `
    <div class="pipeline-bar" aria-hidden="true">
      ${p.stages.filter((s) => s.count > 0).map((s) => `
        <span class="pipeline-seg seg-${STATUS_META[s.status].cls}" style="flex:${s.count}"></span>`).join("")}
      ${activeTotal === 0 ? `<span class="pipeline-seg seg-empty" style="flex:1"></span>` : ""}
    </div>
    <ol class="pipeline-steps">
      ${p.stages.map((s) => `
        <li>
          <a class="pipeline-step" href="applications.html?status=${s.status}">
            <span class="step-dot seg-${STATUS_META[s.status].cls}"></span>
            <span class="step-count">${s.count}</span>
            <span class="step-name">${s.status}</span>
          </a>
        </li>`).join("")}
    </ol>
    <p class="pipeline-closed">
      ${icon("undo")} Closed: <a href="applications.html?status=Rejected">${p.rejected} rejected</a> ·
      <a href="applications.html?status=Withdrawn">${p.withdrawn} withdrawn</a>
      ${p.rejected ? `<span class="closed-note">— every "no" is practice for the "yes".</span>` : ""}
    </p>`;
}

/* ---------- Follow-ups preview ---------- */
function renderFollowUpPreview(today) {
  const items = [...getOverdueFollowUps(apps, today), ...getUpcomingFollowUps(apps, today)].slice(0, 5);
  const holder = document.getElementById("upcoming");
  if (items.length === 0) {
    holder.innerHTML = emptyState({
      iconName: "bell",
      title: "No follow-ups due",
      text: "When you set a follow-up date on an application, it shows up here."
    });
    return;
  }
  holder.innerHTML = `<ul class="row-list">${items.map((app) => `
    <li class="row-item">
      ${companyAvatar(app.company)}
      <a class="row-main" href="details.html?id=${encodeURIComponent(app.id)}">
        <span class="row-title">${escapeHtml(app.company)}</span>
        <span class="row-sub">${escapeHtml(app.jobTitle)}</span>
      </a>
      ${followUpChip(app)}
      <button class="btn btn-icon btn-sm" type="button" data-action="message" data-id="${escapeHtml(app.id)}"
        aria-label="Write follow-up message to ${escapeHtml(app.company)}" title="Write message">${icon("mail")}</button>
    </li>`).join("")}</ul>`;
}

/* ---------- Recently updated ---------- */
function renderRecent() {
  const holder = document.getElementById("recent");
  const items = getRecentlyUpdated(apps, 5);
  if (items.length === 0) {
    holder.innerHTML = emptyState({ iconName: "briefcase", title: "Nothing here yet", text: "Applications you add or update will appear here." });
    return;
  }
  holder.innerHTML = `<ul class="row-list">${items.map((app) => `
    <li class="row-item">
      ${companyAvatar(app.company)}
      <a class="row-main" href="details.html?id=${encodeURIComponent(app.id)}">
        <span class="row-title">${escapeHtml(app.company)}</span>
        <span class="row-sub">${escapeHtml(app.jobTitle)} · updated ${relativeDay(toDateStr(new Date(app.updatedAt)))}</span>
      </a>
      ${statusBadge(app.status)}
    </li>`).join("")}</ul>`;
}

/* ---------- What's working ---------- */
function renderSources() {
  const { rows, best } = getSourceInsights(apps);
  const holder = document.getElementById("sources");
  if (rows.length === 0) {
    holder.innerHTML = `<p class="text-secondary mb-0">Apply to a few roles and we'll show you which sources get you to the next round most often.</p>`;
    return;
  }
  holder.innerHTML = `
    ${best ? `<div class="insight">${icon("trend")}<p><strong>${escapeHtml(best.source)}</strong> is working best for you:
      ${best.progressed} of ${best.total} applications reached the next round.
      ${best.source === "Referral" ? "Ask a senior for one more referral this week?" : "Consider putting more of your energy there."}</p></div>` : ""}
    <ul class="source-list">
      ${rows.map((r) => `
        <li class="source-row">
          <span class="source-name">${escapeHtml(r.source)}</span>
          <span class="source-track" aria-hidden="true"><span class="source-fill" style="width:${Math.round(r.rate * 100)}%"></span></span>
          <span class="source-value">${Math.round(r.rate * 100)}% <span class="text-secondary">(${r.progressed} of ${r.total})</span></span>
        </li>`).join("")}
    </ul>`;
}

registerActions({
  "toggle-steps": () => { showAllSteps = !showAllSteps; renderDashboard(); }
});

initPage(renderDashboard);
