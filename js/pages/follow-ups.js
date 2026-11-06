/* =========================================================
   pages/follow-ups.js — overdue, today, upcoming, completed
   ========================================================= */

function renderFollowUpsPage() {
  const today = todayStr();
  const overdue = getOverdueFollowUps(apps, today);
  const dueToday = getDueTodayFollowUps(apps, today);
  const upcoming = getUpcomingFollowUps(apps, today).filter((a) => a.followUpDate !== today);
  const completed = getCompletedFollowUps(apps).slice(0, 10);

  document.getElementById("fu-summary").innerHTML = `
    <div class="fu-summary-card ${overdue.length ? "is-overdue" : ""}"><div class="num">${overdue.length}</div><div class="lbl">Overdue</div></div>
    <div class="fu-summary-card"><div class="num">${dueToday.length}</div><div class="lbl">Due today</div></div>
    <div class="fu-summary-card"><div class="num">${upcoming.length}</div><div class="lbl">Upcoming</div></div>`;

  const groups = document.getElementById("fu-groups");
  if (!overdue.length && !dueToday.length && !upcoming.length && !completed.length) {
    groups.innerHTML = `<div class="panel">${emptyState({
      iconName: "bell",
      title: "No follow-ups yet",
      text: "Set a follow-up date on any application and it will appear here. We'll tell you when it's due.",
      actionHtml: `<a class="btn btn-primary" href="applications.html">Choose an application</a>`
    })}</div>`;
    return;
  }

  groups.innerHTML = `
    ${group("Overdue", "#DC2626", overdue, "overdue")}
    ${group("Due today", "var(--sun)", dueToday, "today")}
    ${group("Upcoming", "var(--primary)", upcoming, "upcoming")}
    ${!overdue.length && !dueToday.length && !upcoming.length
      ? `<div class="panel mb-4">${emptyState({ iconName: "check", title: "You're all caught up", text: "No follow-ups are due. Nice work staying on top of things." })}</div>`
      : ""}
    ${completed.length ? `
      <section class="fu-group" aria-labelledby="g-done">
        <h2 class="fu-group-title" id="g-done"><span class="bubble" style="background:#12A672"></span>Completed</h2>
        ${completed.map((c) => `
          <div class="fu-item">
            ${companyAvatar(c.app.company)}
            <a class="row-main" href="details.html?id=${encodeURIComponent(c.app.id)}">
              <span class="row-title">${escapeHtml(c.app.company)}</span>
              <span class="row-sub">${escapeHtml(c.app.jobTitle)}</span>
            </a>
            <span class="fu-chip fu-completed">${icon("check")} Done ${formatDate(c.doneOn)}</span>
          </div>`).join("")}
      </section>` : ""}`;
}

function group(title, color, list, state) {
  if (!list.length) return "";
  const slug = state;
  return `
    <section class="fu-group" aria-labelledby="g-${slug}">
      <h2 class="fu-group-title" id="g-${slug}"><span class="bubble" style="background:${color}"></span>${title} · ${list.length}</h2>
      ${list.map((app) => {
        const id = escapeHtml(app.id);
        return `
        <div class="fu-item is-${state}">
          ${companyAvatar(app.company)}
          <a class="row-main" href="details.html?id=${encodeURIComponent(app.id)}">
            <span class="row-title">${escapeHtml(app.company)}</span>
            <span class="row-sub">${escapeHtml(app.jobTitle)} · ${app.status}${app.recruiter.name ? ` · ${escapeHtml(app.recruiter.name)}` : ""}</span>
          </a>
          ${followUpChip(app)}
          <div class="fu-item-actions">
            <button class="btn btn-primary btn-sm" type="button" data-action="message" data-id="${id}">${icon("mail")} Write message</button>
            <button class="btn btn-light btn-sm" type="button" data-action="complete" data-id="${id}" aria-label="Mark follow-up with ${escapeHtml(app.company)} complete">${icon("check")} Done</button>
            <div class="dropdown">
              <button class="btn btn-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"
                aria-label="Reschedule follow-up with ${escapeHtml(app.company)}">Reschedule</button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><button class="dropdown-item" type="button" data-action="reschedule" data-id="${id}" data-days="3">In 3 days</button></li>
                <li><button class="dropdown-item" type="button" data-action="reschedule" data-id="${id}" data-days="7">In 1 week</button></li>
                <li><button class="dropdown-item" type="button" data-action="reschedule" data-id="${id}">Pick a date…</button></li>
              </ul>
            </div>
          </div>
        </div>`;
      }).join("")}
    </section>`;
}

initPage(renderFollowUpsPage);
