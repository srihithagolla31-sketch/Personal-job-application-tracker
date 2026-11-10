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

  renderSampleNote();
  renderGreeting(plan, momentum);
  renderNextUp(plan);
  renderPipeline();
  renderStats(stats);
  renderTodayPlan(plan);
  renderQuests();
  renderExplore();
  renderFollowUpPreview(today);
  renderRecent();
  renderMomentum(momentum);
  renderSources();
}

/* ---------- "These are pretend applications" ---------- */
function renderSampleNote() {
  const hasSamples = withoutSamples(apps).length < apps.length;
  document.getElementById("sample-note").innerHTML = hasSamples
    ? `<div class="sample-note">${icon("sparkles")}
         <p>These are pretend applications, so you can look around first.</p>
         <button class="btn btn-light btn-sm" type="button" data-action="clear-samples">Clear them and start mine</button>
       </div>`
    : "";
}

/* ---------- Greeting ---------- */
function renderGreeting(plan, momentum) {
  const name = settings.userName ? settings.userName.split(" ")[0] : "";
  document.getElementById("today-date").textContent =
    new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("greeting").innerHTML = name
    ? `${greeting()},<br><span class="marker">${escapeHtml(name)}</span>`
    : `<span class="marker">${greeting()}!</span>`;
  document.getElementById("encouragement").textContent = getEncouragement(apps, momentum, plan);

  document.getElementById("hero-streak").innerHTML = momentum.streak > 0
    ? `<span class="streak"><span class="streak-flame">${icon("flame")}</span>${plural(momentum.streak, "week")} in a row</span>`
    : `<span class="streak"><span class="streak-flame muted">${icon("flame")}</span>Apply once to start a streak</span>`;
}

/* ---------- ★ The one thing to do next ---------- */
function stepButtons(action, app) {
  return action.buttons.map((b, i) => `
    <button type="button" class="btn btn-sm ${i === 0 ? "btn-primary" : "btn-light"}"
      data-action="${b.action}" data-id="${escapeHtml(app.id)}" ${b.template ? `data-template="${b.template}"` : ""}>
      ${b.label}
    </button>`).join("");
}

function renderNextUp(plan) {
  const holder = document.getElementById("hero-side");
  if (plan.length === 0) {
    const first = apps.length === 0;
    holder.innerHTML = `
      <div class="next-up press is-clear" data-action="open-quick-add">
        <span class="next-up-tag">${icon(first ? "zap" : "check")} ${first ? "Start here" : "All clear"}</span>
        <button type="button" class="next-up-title border-0 bg-transparent p-0 text-start">${first ? "Add your first application" : "Nothing needs you right now"}</button>
        <p class="next-up-why mb-0">${first ? "Found a role you like? Paste the link and we'll do the rest." : "A great moment to find one more role to apply for."}</p>
      </div>`;
    return;
  }
  const { app, action } = plan[0];
  holder.innerHTML = `
    <article class="next-up press">
      <span class="next-up-tag">${icon("zap")} Do this next</span>
      <a class="next-up-title stretched-link" href="details.html?id=${encodeURIComponent(app.id)}">${escapeHtml(action.title)}</a>
      <p class="next-up-why">${escapeHtml(action.why)}</p>
      <div class="today-actions">${stepButtons(action, app)}</div>
    </article>`;
}

/* ---------- ★ The rest of the plan (the coach) ---------- */
function renderTodayPlan(plan) {
  const list = document.getElementById("today-list");
  const count = document.getElementById("today-count");
  const rest = plan.slice(1); // plan[0] is the big "Do this next" card
  const urgent = rest.filter((p) => p.action.urgency === "now").length;
  count.textContent = rest.length ? `${urgent} urgent · ${rest.length} total` : "All clear";
  count.classList.toggle("is-clear", rest.length === 0);

  if (rest.length === 0) {
    list.innerHTML = `<li>${emptyState({
      iconName: "check",
      title: apps.length ? "Nothing else on your list" : "Your to-do list lives here",
      text: apps.length ? "Finish what's above and you're done for today." : "Once you add an application, we'll tell you what to do and when."
    })}</li>`;
    return;
  }

  const visible = showAllSteps ? rest : rest.slice(0, 3);
  list.innerHTML = visible.map(({ app, action }) => `
    <li class="today-item press urgency-${action.urgency}">
      <span class="today-icon kind-${action.kind}">${icon(KIND_ICONS[action.kind])}</span>
      <div class="today-body">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <a class="today-title stretched-link" href="details.html?id=${encodeURIComponent(app.id)}">${escapeHtml(action.title)}</a>
          <span class="urgency-tag">${action.urgency === "now" ? "Today" : "Soon"}</span>
        </div>
        <p class="today-why">${escapeHtml(action.why)}</p>
        <div class="today-actions">${stepButtons(action, app)}</div>
      </div>
    </li>`).join("") +
    (rest.length > 3
      ? `<li class="today-more"><button type="button" class="btn btn-link btn-sm" data-action="toggle-steps">
           ${showAllSteps ? "Show fewer" : `Show ${rest.length - 3} more`}</button></li>`
      : "");
}

/* ---------- Starter quests ---------- */
function renderQuests() {
  const quests = getStarterQuests(apps, settings);
  const done = quests.filter((q) => q.done).length;
  const body = (q) => `
    <span class="q-tick">${icon(q.done ? "check" : q.iconName)}</span>
    <span class="quest-text"><strong>${q.title}</strong>${q.done ? "" : `<small>${q.why}</small>`}</span>
    ${q.done ? "" : `<span class="go">${icon("arrow-right")}</span>`}`;
  document.getElementById("quests").innerHTML = `
    <div class="quest-progress">
      <span class="quest-track" aria-hidden="true"><span class="quest-fill" style="width:${(done / quests.length) * 100}%"></span></span>
      <span>${done} of ${quests.length} done</span>
    </div>
    <ul class="quest-list">
      ${quests.map((q) => `<li>${q.done
        ? `<div class="quest is-done">${body(q)}</div>`
        : q.href
          ? `<a class="quest press on-surface" href="${q.href}">${body(q)}</a>`
          : `<button type="button" class="quest press on-surface" data-action="${q.action}">${body(q)}</button>`}</li>`).join("")}
    </ul>`;
}

/* ---------- Where to look ---------- */
const PLACES_TO_LOOK = [
  { name: "Internshala", text: "Internships made for students, many open to first-years.", href: "https://internshala.com/internships/", tone: "tone-blue" },
  { name: "Unstop", text: "Competitions and hackathons that look great on a resume.", href: "https://unstop.com/competitions", tone: "tone-violet" },
  { name: "LinkedIn Jobs", text: "Search \"intern\" plus a skill you enjoy.", href: "https://www.linkedin.com/jobs/", tone: "tone-green" },
  { name: "Google Summer of Code", text: "Paid open source work, for coders new to open source.", href: "https://summerofcode.withgoogle.com/", tone: "tone-amber" }
];
function renderExplore() {
  document.getElementById("explore").innerHTML = PLACES_TO_LOOK.map((p) => `
    <div class="col-6 col-lg-3">
      <a class="explore-card press ${p.tone}" href="${p.href}" target="_blank" rel="noopener noreferrer">
        <strong>${p.name}</strong>
        <span class="txt">${p.text}</span>
        <span class="go">${icon("external")}</span>
        <span class="visually-hidden">(opens in a new tab)</span>
      </a>
    </div>`).join("");
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
    { label: "Applications", value: s.total, sub: `${s.active} still active`, iconName: "briefcase", href: "applications.html", tone: "violet" },
    { label: "Interviews", value: s.interviews, sub: s.interviews ? "You're getting noticed" : "They'll come", iconName: "chat", href: "applications.html?status=Interview", tone: "blue" },
    { label: "Offers", value: s.offers, sub: s.offers ? "Well deserved!" : "Keep going", iconName: "award", href: "applications.html?status=Offer", tone: "green" },
    { label: "Follow-ups overdue", value: s.overdue, sub: `${s.upcoming} coming up`, iconName: "bell", href: "follow-ups.html", tone: s.overdue ? "amber" : "slate" }
  ];
  document.getElementById("stats").innerHTML = cards.map((c) => `
    <div class="col-6 col-lg-3">
      <a class="stat-card press tone-${c.tone}" href="${c.href}">
        <span class="stat-head"><span class="stat-value">${c.value}</span><span class="go">${icon("arrow-right")}</span></span>
        <span class="stat-label">${c.label}</span>
        <span class="stat-sub">${c.sub}</span>
      </a>
    </div>`).join("");
}

/* ---------- The trail (pipeline) ---------- */
function renderPipeline() {
  const p = getPipeline(apps);
  const furthest = [...p.stages].reverse().find((s) => s.count > 0)?.status;

  document.getElementById("pipeline").innerHTML = `
    <div class="trail">
      <svg class="trail-line" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 40C120 40 130 160 250 160S380 40 500 40 630 160 750 160 880 40 1000 40"/>
      </svg>
      <ol class="trail-stops">
        ${p.stages.map((s) => {
          const here = apps.filter((a) => a.status === s.status);
          return `
          <li>
            ${s.status === furthest ? `<span class="here-tag">Furthest so far</span>` : ""}
            <a class="stop press seg-${STATUS_META[s.status].cls}" href="applications.html?status=${s.status}">
              <span class="stop-top">
                <span class="stop-count">${s.count}</span>
                <span class="stop-icon">${icon(STATUS_META[s.status].icon)}</span>
              </span>
              <span class="stop-name">${s.status}</span>
              <span class="stop-hint">${STATUS_META[s.status].hint}</span>
              <span class="stop-faces">
                ${here.slice(0, 3).map((a) => companyAvatar(a.company)).join("")}
                ${here.length > 3 ? `<span class="more">+${here.length - 3}</span>` : ""}
              </span>
            </a>
          </li>`;
        }).join("")}
      </ol>
    </div>
    ${p.rejected || p.withdrawn ? `
    <p class="pipeline-closed">
      ${icon("undo")} Off the trail: <a href="applications.html?status=Rejected">${p.rejected} rejected</a> ·
      <a href="applications.html?status=Withdrawn">${p.withdrawn} withdrawn</a>
      ${p.rejected ? `<span>Every "no" is practice for the "yes".</span>` : ""}
    </p>` : ""}`;
}

/* ---------- Follow-ups preview ---------- */
function renderFollowUpPreview(today) {
  const items = [...getOverdueFollowUps(apps, today), ...getUpcomingFollowUps(apps, today)].slice(0, 5);
  const holder = document.getElementById("upcoming");
  if (items.length === 0) {
    holder.innerHTML = emptyState({
      iconName: "bell",
      title: "No follow-ups due",
      text: "Tick the reminder box when you add an application, and it shows up here.",
      actionHtml: `<button class="btn btn-primary" data-action="open-quick-add">${icon("plus")} Add application</button>`
    });
    return;
  }
  holder.innerHTML = `<ul class="row-list">${items.map((app) => `
    <li class="row-item">
      ${companyAvatar(app.company)}
      <a class="row-main stretched-link" href="details.html?id=${encodeURIComponent(app.id)}">
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
    holder.innerHTML = emptyState({
      iconName: "briefcase", title: "Nothing here yet", text: "Applications you add or update will appear here.",
      actionHtml: `<a class="btn btn-light" href="#explore-title">See where to look</a>`
    });
    return;
  }
  holder.innerHTML = `<ul class="row-list">${items.map((app) => `
    <li class="row-item">
      ${companyAvatar(app.company)}
      <a class="row-main stretched-link" href="details.html?id=${encodeURIComponent(app.id)}">
        <span class="row-title">${escapeHtml(app.company)}</span>
        <span class="row-sub">${escapeHtml(app.jobTitle)} · updated ${relativeDay(toDateStr(new Date(app.updatedAt)))}</span>
      </a>
      ${statusBadge(app.status)}
      <span class="go">${icon("chevron-right")}</span>
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
  "toggle-steps": () => { showAllSteps = !showAllSteps; renderDashboard(); },
  "clear-samples": async () => {
    const ok = await confirmDialog({
      title: "Clear the pretend applications?",
      message: "The demo companies will be removed. Anything you added yourself stays.",
      confirmLabel: "Clear them"
    });
    if (ok) commit(withoutSamples(apps), "All clear! This list is all yours now.");
  }
});

initPage(renderDashboard);
