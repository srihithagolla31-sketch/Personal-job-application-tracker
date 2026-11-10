/* =========================================================
   pages/details.js — one application, everything about it
   details.html?id=APP-1001
   ========================================================= */

const detailId = getParam("id");

function renderDetails() {
  const holder = document.getElementById("details");
  const app = findApplication(apps, detailId);

  if (!app) {
    document.title = "Not found · Onward";
    holder.innerHTML = `<div class="panel mt-3">${emptyState({
      iconName: "search",
      title: "We couldn't find that application",
      text: "It may have been deleted, or the link is incomplete.",
      actionHtml: `<a class="btn btn-primary" href="applications.html">Back to my applications</a>`
    })}</div>`;
    return;
  }

  document.title = `${app.company} · Onward`;
  const action = getNextAction(app);
  const id = escapeHtml(app.id);
  const fuState = getFollowUpState(app);

  holder.innerHTML = `
    <!-- Header -->
    <section class="detail-hero" aria-labelledby="detail-title">
      <div class="detail-head">
        ${companyAvatar(app.company, "avatar-lg")}
        <div class="flex-grow-1" style="min-width: 220px;">
          <div class="detail-company">${escapeHtml(app.company)}</div>
          <h1 class="detail-title" id="detail-title">${escapeHtml(app.jobTitle)}</h1>
          <div class="meta-row">
            <span>${icon("briefcase")} ${app.jobType}</span>
            ${app.location ? `<span>${icon("pin")} ${escapeHtml(app.location)}</span>` : ""}
            <span>${icon("search")} Found on ${escapeHtml(app.source)}</span>
            <span>${priorityLabel(app.priority)} priority</span>
            ${app.jobUrl ? `<span><a href="${escapeHtml(app.jobUrl)}" target="_blank" rel="noopener noreferrer">${icon("external")} View job posting<span class="visually-hidden"> (opens in a new tab)</span></a></span>` : ""}
          </div>
        </div>
        <div class="d-flex gap-2">
          <a class="btn btn-light" href="form.html?id=${encodeURIComponent(app.id)}">${icon("edit")} Edit</a>
          <button class="btn btn-icon" type="button" data-action="delete-app" aria-label="Delete this application" title="Delete">${icon("trash")}</button>
        </div>
      </div>

      <div class="status-switch">
        <p class="status-switch-label" id="status-label">Where is it now? Tap to move it along</p>
        <div class="status-options" role="group" aria-labelledby="status-label">
          ${ACTIVE_STATUSES.map((s) => statusOption(s, app)).join("")}
        </div>
        <div class="status-closed">
          <span>Off the trail:</span>
          ${CLOSED_STATUSES.map((s) => statusOption(s, app)).join("")}
        </div>
      </div>
    </section>

    ${action ? `
      <!-- ★ Coach: the one next step for this application -->
      <section class="coach-callout" aria-label="Suggested next step">
        <span class="today-icon kind-${action.kind}">${icon("sparkles")}</span>
        <div>
          <div class="label">Your next step</div>
          <div class="title">${escapeHtml(action.title)}</div>
          <p>${escapeHtml(action.why)}</p>
          <div class="today-actions">
            ${action.buttons.filter((b) => b.action !== "open").map((b, i) => `
              <button type="button" class="btn btn-sm ${i === 0 ? "btn-primary" : "btn-light"}" data-action="${b.action}"
                data-id="${id}" ${b.template ? `data-template="${b.template}"` : ""}>${b.label}</button>`).join("")}
            ${action.kind === "interview" ? `<a class="btn btn-sm btn-primary" href="#notes-title">Jump to notes</a>` : ""}
          </div>
        </div>
      </section>` : ""}

    <div class="row g-4">
      <div class="col-lg-8">
        <section class="panel mb-4" aria-labelledby="overview-title">
          <h2 class="panel-title mb-3" id="overview-title">Overview</h2>
          <dl class="info-grid">
            <div><dt>Status</dt><dd>${statusBadge(app.status)}</dd></div>
            <div><dt>Applied on</dt><dd>${formatDate(app.applicationDate)}</dd></div>
            <div><dt>Deadline</dt><dd>${app.deadline ? `${formatDate(app.deadline)} <span class="text-secondary">(${relativeDay(app.deadline)})</span>` : "—"}</dd></div>
            <div><dt>Interview</dt><dd>${app.interviewDate ? `${formatDate(app.interviewDate)} <span class="text-secondary">(${relativeDay(app.interviewDate)})</span>` : "—"}</dd></div>
            <div><dt>Salary / stipend</dt><dd>${app.salary ? escapeHtml(app.salary) : "—"}</dd></div>
            <div><dt>Last updated</dt><dd>${relativeDay(toDateStr(new Date(app.updatedAt)))}</dd></div>
          </dl>
        </section>

        <section class="panel mb-4" aria-labelledby="notes-title">
          <div class="panel-header mb-2">
            <h2 class="panel-title" id="notes-title">Notes</h2>
            <a class="link-subtle small" href="form.html?id=${encodeURIComponent(app.id)}">Edit notes</a>
          </div>
          ${app.notes
            ? `<p class="notes-text">${escapeHtml(app.notes)}</p>`
            : `<p class="text-secondary mb-0">No notes yet. Add interview prep, questions to ask, or how you applied.</p>`}
        </section>

        <section class="panel" aria-labelledby="history-title">
          <h2 class="panel-title mb-3" id="history-title">Journey so far</h2>
          <ol class="timeline">
            ${[...app.statusHistory].reverse().map((h, i) => `
              <li>
                <span class="tl-dot seg-${STATUS_META[h.status].cls}" aria-hidden="true"></span>
                <strong>${h.status}</strong><span class="tl-date">${formatDate(h.date)}${i === 0 ? " · current" : ""}</span>
              </li>`).join("")}
          </ol>
        </section>
      </div>

      <div class="col-lg-4">
        <!-- Follow-up -->
        <section class="side-card fu-state-${fuState}" aria-labelledby="fu-title">
          <h2 class="side-title" id="fu-title">${icon("bell")} Follow-up</h2>
          ${renderFollowUpCard(app, fuState)}
        </section>

        <!-- Recruiter contact -->
        <section class="side-card" aria-labelledby="contact-title">
          <h2 class="side-title" id="contact-title">${icon("user")} Who to contact</h2>
          ${renderContact(app)}
        </section>
      </div>
    </div>`;
}

function statusOption(s, app) {
  const reached = app.statusHistory.some((h) => h.status === s);
  return `
    <button type="button" class="status-option press opt-${STATUS_META[s].cls} ${reached ? "is-past" : ""}" data-action="set-status"
      data-id="${escapeHtml(app.id)}" data-status="${s}" aria-pressed="${s === app.status}" title="${STATUS_META[s].hint}">
      <span>${icon(STATUS_META[s].icon)} ${s}</span>
      <small>${STATUS_META[s].hint}</small>
    </button>`;
}

function renderFollowUpCard(app, state) {
  const id = escapeHtml(app.id);
  const closed = CLOSED_STATUSES.includes(app.status);
  const rescheduleMenu = `
    <div class="dropdown">
      <button class="btn btn-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">Reschedule</button>
      <ul class="dropdown-menu">
        <li><button class="dropdown-item" type="button" data-action="reschedule" data-id="${id}" data-days="3">In 3 days</button></li>
        <li><button class="dropdown-item" type="button" data-action="reschedule" data-id="${id}" data-days="7">In 1 week</button></li>
        <li><button class="dropdown-item" type="button" data-action="reschedule" data-id="${id}">Pick a date…</button></li>
      </ul>
    </div>`;

  let html = "";
  if (state === "overdue" || state === "today" || state === "upcoming") {
    html = `
      <p class="fu-big">${formatDate(app.followUpDate)}</p>
      <p class="mb-3">${followUpChip(app)}</p>
      ${state === "overdue" ? `<p class="small text-secondary">This follow-up is overdue. Review the application and decide whether to contact the company or reschedule it.</p>` : ""}
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-primary btn-sm" type="button" data-action="message" data-id="${id}">${icon("mail")} Write message</button>
        <button class="btn btn-light btn-sm" type="button" data-action="complete" data-id="${id}">${icon("check")} Mark follow-up complete</button>
        ${rescheduleMenu}
      </div>`;
  } else if (closed) {
    html = `<p class="text-secondary mb-0">This application is ${app.status.toLowerCase()}, so follow-ups are paused.</p>`;
  } else {
    html = `
      <p class="text-secondary">${state === "completed" ? `Done ${icon("check")} Want to check in again later?` : "No follow-up scheduled."}</p>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-light btn-sm" type="button" data-action="reschedule" data-id="${id}" data-days="7">${icon("calendar")} Schedule in 1 week</button>
        <button class="btn btn-light btn-sm" type="button" data-action="reschedule" data-id="${id}">Pick a date…</button>
      </div>`;
  }

  if (app.followUpHistory.length) {
    html += `
      <p class="small fw-semibold mt-3 mb-1">Previous follow-ups</p>
      <ul class="list-unstyled small text-secondary mb-0">
        ${[...app.followUpHistory].reverse().map((f) => `<li>${icon("check")} Done on ${formatDate(f.doneOn)}</li>`).join("")}
      </ul>`;
  }
  return html;
}

function renderContact(app) {
  const r = app.recruiter;
  if (!r.name && !r.email && !r.phone) {
    return `
      <p class="text-secondary">No contact saved. Many postings don't list one — that's fine.</p>
      <a class="btn btn-light btn-sm" href="form.html?id=${encodeURIComponent(app.id)}#recruiter">${icon("plus")} Add contact</a>`;
  }
  return `
    ${r.name ? `<div class="contact-line">${icon("user")}<strong>${escapeHtml(r.name)}</strong></div>` : ""}
    ${r.email ? `<div class="contact-line">${icon("mail")}<a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>
      <button class="btn btn-icon btn-sm ms-auto" type="button" data-action="copy-email" data-email="${escapeHtml(r.email)}" aria-label="Copy email address" title="Copy">${icon("copy")}</button></div>` : ""}
    ${r.phone ? `<div class="contact-line">${icon("phone")}<a href="tel:${escapeHtml(r.phone.replace(/[^\d+]/g, ""))}">${escapeHtml(r.phone)}</a></div>` : ""}
    <div class="d-flex flex-wrap gap-2 mt-3">
      <a class="btn btn-light btn-sm" href="form.html?id=${encodeURIComponent(app.id)}#recruiter">${icon("edit")} Edit</a>
      <button class="btn btn-light btn-sm" type="button" data-action="clear-contact">${icon("x")} Clear contact</button>
    </div>`;
}

registerActions({
  "delete-app": async () => {
    const app = findApplication(apps, detailId);
    const ok = await confirmDialog({
      title: "Delete this application?",
      message: `${escapeHtml(app.jobTitle)} at ${escapeHtml(app.company)} will be removed. This action cannot be undone from the tracker.`,
      confirmLabel: "Delete application",
      danger: true
    });
    if (!ok) return;
    const next = deleteApplication(apps, detailId);
    if (!saveApplications(next)) { toast(STORAGE_ERROR, "error"); return; }
    setFlash(`Deleted ${app.company} — ${app.jobTitle}.`, "info");
    window.location.href = "applications.html";
  },
  "clear-contact": async () => {
    const ok = await confirmDialog({
      title: "Clear recruiter contact?",
      message: "The name, email and phone for this application will be removed.",
      confirmLabel: "Clear contact"
    });
    if (ok) commit(clearRecruiter(apps, detailId), "Recruiter contact cleared.", "info");
  },
  "copy-email": async (el) => {
    const ok = await copyText(el.dataset.email);
    toast(ok ? "Email address copied." : "Couldn't copy — select the email and copy it manually.", ok ? "success" : "error");
  }
});

initPage(renderDetails);
if (getParam("celebrate")) {
  celebrate();
  history.replaceState(null, "", `details.html?id=${encodeURIComponent(detailId)}`);
}
