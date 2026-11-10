/* =========================================================
   ui.js — pieces of interface shared by every page:
   navbar, status badges, toasts, confirm dialog, quick add,
   message composer, celebrations, and the "commit" save flow.
   ========================================================= */

const APP_NAME = "Onward";

/* ---------- Page state ----------
   apps     -> the array of application records (the single source of truth)
   settings -> user preferences
   pageRender -> each page sets this to its own render() function */
let apps = [];
let settings = { ...DEFAULT_SETTINGS };
let pageRender = () => {};
const pageActions = {}; // extra click actions a page registers

const STATUS_META = {
  Interested: { icon: "star", cls: "interested", hint: "You like it, not applied yet" },
  Applied: { icon: "send", cls: "applied", hint: "Sent! Waiting to hear back" },
  Assessment: { icon: "clipboard", cls: "assessment", hint: "They sent you a test or task" },
  Interview: { icon: "chat", cls: "interview", hint: "They want to talk to you" },
  Offer: { icon: "award", cls: "offer", hint: "They said yes!" },
  Rejected: { icon: "x-circle", cls: "rejected", hint: "Not this time" },
  Withdrawn: { icon: "undo", cls: "withdrawn", hint: "You stepped back" }
};

/* ---------- Theme ---------- */
function applyTheme(theme) {
  const dark = theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");
}

/* ---------- Small render helpers (return HTML strings) ---------- */
function statusBadge(status) {
  const meta = STATUS_META[status];
  return `<span class="status-badge status-${meta.cls}">${icon(meta.icon)}<span>${status}</span></span>`;
}

// Coloured circle with the company's initials. The colour comes from the name, so it's always the same.
function companyAvatar(company, size = "") {
  const initials = company.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  let hash = 0;
  for (const ch of company) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return `<span class="avatar avatar-${hash % 6} ${size}" aria-hidden="true">${escapeHtml(initials)}</span>`;
}

function followUpChip(app) {
  const state = getFollowUpState(app);
  if (state === "none") return `<span class="text-secondary-soft">—</span>`;
  const icons = { overdue: "alert", today: "bell", upcoming: "calendar", completed: "check" };
  return `<span class="fu-chip fu-${state}">${icon(icons[state])}${escapeHtml(followUpLabel(app))}</span>`;
}

function priorityLabel(priority) {
  return `<span class="priority priority-${priority.toLowerCase()}"><span class="dot" aria-hidden="true"></span>${priority}</span>`;
}

function emptyState({ iconName = "inbox", title, text, actionHtml = "" }) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon(iconName)}</div>
      <p class="empty-title">${title}</p>
      <p class="empty-text">${text}</p>
      ${actionHtml}
    </div>`;
}

/* ---------- Navbar + footer ---------- */
function renderNav() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const active = document.body.dataset.page;
  const overdue = getOverdueFollowUps(apps).length + getDueTodayFollowUps(apps).length;
  const links = [
    { page: "dashboard", href: "index.html", label: "Home", iconName: "home" },
    { page: "applications", href: "applications.html", label: "Applications", iconName: "briefcase" },
    { page: "follow-ups", href: "follow-ups.html", label: "Follow-ups", iconName: "bell", badge: overdue },
    { page: "settings", href: "settings.html", label: "Settings", iconName: "sliders" }
  ];
  const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
  const current = (l) => (l.page === active ? 'aria-current="page"' : "");
  const badge = (l) => (l.badge ? `<span class="nav-badge" aria-label="${l.badge} need attention">${l.badge}</span>` : "");
  const tab = (l) => `
    <a class="tab ${l.page === active ? "active" : ""}" href="${l.href}" ${current(l)}>
      ${icon(l.iconName)}<span>${l.label}</span>${badge(l)}
    </a>`;

  header.innerHTML = `
    <nav class="app-nav" aria-label="Main navigation">
      <div class="container-xl">
        <div class="app-nav-inner">
          <a class="brand" href="index.html">
            <span class="brand-mark" aria-hidden="true">${icon("send")}</span>
            <span>${APP_NAME}</span>
          </a>
          <ul class="nav-row d-none d-md-flex">
            ${links.map((l) => `
              <li>
                <a class="nav-pill ${l.page === active ? "active" : ""}" href="${l.href}" ${current(l)}>
                  ${icon(l.iconName)} ${l.label} ${badge(l)}
                </a>
              </li>`).join("")}
          </ul>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-icon" type="button" data-action="toggle-theme"
              aria-label="${isDark ? "Switch to light mode" : "Switch to dark mode"}" title="Toggle dark mode">
              ${icon(isDark ? "sun" : "moon")}
            </button>
            <button class="btn btn-primary d-none d-md-inline-flex" type="button"
              data-action="open-quick-add" aria-label="Add application" title="Add application (shortcut: N)">
              ${icon("plus")} <span class="d-none d-lg-inline">Add application</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
    <nav class="tabbar d-md-none" aria-label="Main navigation for phones">
      ${tab(links[0])}${tab(links[1])}
      <button id="fab" class="tab-add" type="button" data-action="open-quick-add" aria-label="Add application">${icon("plus")}</button>
      ${tab(links[2])}${tab(links[3])}
    </nav>`;
}

function renderFooter() {
  const footer = document.getElementById("site-footer");
  if (!footer) return;
  footer.innerHTML = `
    <div class="container-xl footer-inner">
      <span>${icon("shield")} Your data stays in this browser. No account, no tracking.</span>
      <span class="d-none d-md-inline-flex">Shortcuts: <kbd>N</kbd> new application · <kbd>/</kbd> search</span>
    </div>`;
}

/* ---------- Alerts (storage problems) ---------- */
function renderStorageWarning() {
  const holder = document.getElementById("alerts");
  const warning = getStorageWarning();
  if (!holder) return;
  holder.innerHTML = warning
    ? `<div class="alert alert-warning d-flex gap-2 align-items-start" role="alert">${icon("alert")}<div>${escapeHtml(warning)}</div></div>`
    : "";
}

/* ---------- Toasts ---------- */
function toast(message, type = "success", link = null) {
  let container = document.getElementById("toast-area");
  if (!container) {
    document.body.insertAdjacentHTML("beforeend",
      `<div id="toast-area" class="toast-container position-fixed bottom-0 end-0 p-3" aria-live="polite" aria-atomic="false"></div>`);
    container = document.getElementById("toast-area");
  }
  const icons = { success: "check", error: "alert", info: "sparkles", gentle: "sparkles" };
  const el = document.createElement("div");
  el.className = `toast app-toast toast-${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = `
    <div class="d-flex align-items-start gap-2 p-3">
      <span class="toast-icon">${icon(icons[type] || "check")}</span>
      <div class="flex-grow-1">${escapeHtml(message)}
        ${link ? `<a class="toast-link" href="${link.href}">${escapeHtml(link.label)} ${icon("arrow-right")}</a>` : ""}
      </div>
      <button type="button" class="btn-close btn-close-sm" data-bs-dismiss="toast" aria-label="Dismiss"></button>
    </div>`;
  container.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: type === "error" ? 8000 : 5000 });
  el.addEventListener("hidden.bs.toast", () => el.remove());
  t.show();
}

// A message that survives a page change (e.g. "Saved!" after the form redirects)
function setFlash(message, type = "success") {
  try { sessionStorage.setItem("onward_flash", JSON.stringify({ message, type })); } catch { /* ignore */ }
}
function showFlash() {
  try {
    const flash = JSON.parse(sessionStorage.getItem("onward_flash"));
    sessionStorage.removeItem("onward_flash");
    if (flash) toast(flash.message, flash.type);
  } catch { /* ignore */ }
}

/* ---------- Saving: the one place every change goes through ---------- */
const STORAGE_ERROR = "We couldn't save your changes in this browser. Please try again. Your latest changes may not have been stored.";

function commit(newApps, message, type = "success") {
  if (!saveApplications(newApps)) {
    toast(STORAGE_ERROR, "error");
    return false;
  }
  apps = newApps;
  renderNav();
  pageRender();
  if (message) toast(message, type);
  return true;
}

/* ---------- Confirm dialog (returns a Promise<boolean>) ---------- */
function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    document.getElementById("confirmModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal fade" id="confirmModal" tabindex="-1" aria-labelledby="confirmTitle" aria-describedby="confirmText" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered confirm-dialog">
          <div class="modal-content">
            <div class="modal-body p-4">
              <div class="confirm-icon ${danger ? "danger" : ""}">${icon(danger ? "trash" : "alert")}</div>
              <h2 class="h5 mt-3" id="confirmTitle">${title}</h2>
              <p class="text-secondary mb-0" id="confirmText">${message}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" id="confirmYes">${confirmLabel}</button>
            </div>
          </div>
        </div>
      </div>`);
    const el = document.getElementById("confirmModal");
    const modal = new bootstrap.Modal(el);
    let answer = false;
    el.querySelector("#confirmYes").addEventListener("click", () => { answer = true; modal.hide(); });
    el.addEventListener("hidden.bs.modal", () => { el.remove(); resolve(answer); });
    el.addEventListener("shown.bs.modal", () => el.querySelector(".btn-light").focus());
    modal.show();
  });
}

/* ---------- Pick a date (for rescheduling) ---------- */
function pickDate({ title, initial }) {
  return new Promise((resolve) => {
    document.getElementById("dateModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal fade" id="dateModal" tabindex="-1" aria-labelledby="dateTitle" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered confirm-dialog">
          <form class="modal-content" novalidate>
            <div class="modal-body p-4">
              <h2 class="h5" id="dateTitle">${title}</h2>
              <label class="form-label mt-2" for="pickDateInput">Follow-up date</label>
              <input type="date" class="form-control" id="pickDateInput" min="${todayStr()}" value="${initial}" required aria-describedby="pickDateError">
              <div class="invalid-feedback" id="pickDateError">Please choose today or a later date.</div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Schedule follow-up</button>
            </div>
          </form>
        </div>
      </div>`);
    const el = document.getElementById("dateModal");
    const input = el.querySelector("input");
    const modal = new bootstrap.Modal(el);
    let answer = null;
    el.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!isValidDateStr(input.value) || input.value < todayStr()) {
        input.classList.add("is-invalid");
        input.setAttribute("aria-invalid", "true");
        return;
      }
      answer = input.value;
      modal.hide();
    });
    el.addEventListener("shown.bs.modal", () => input.focus());
    el.addEventListener("hidden.bs.modal", () => { el.remove(); resolve(answer); });
    modal.show();
  });
}

/* ---------- Celebrations & kind words ---------- */
function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#C8F24A", "#FFD23F", "#FF9F7F", "#9BD8FF", "#C9BCFF", "#FFB3D9"];
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("i");
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.6 + "s";
    piece.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3600);
}

// Called after any status change. Turns a data update into a human moment.
function reactToStatus(app, newStatus) {
  const stillActive = apps.filter((a) => ACTIVE_STATUSES.includes(a.status)).length;
  if (newStatus === "Offer") {
    celebrate();
    toast(`An offer from ${app.company}! All that effort paid off. Take a moment to enjoy this.`, "success");
  } else if (newStatus === "Rejected") {
    toast(`That one stings, and that's okay. You still have ${plural(stillActive, "active application")} — every "no" is practice for the "yes".`, "gentle");
  } else if (newStatus === "Interview") {
    toast(`Interview stage at ${app.company} — that's a big step! Add the date so we can remind you to prepare.`, "success");
  } else if (newStatus === "Assessment") {
    toast(`You're through to the assessment at ${app.company}. Nice work!`, "success");
  } else {
    toast(`Status updated to ${newStatus}.`, "success");
  }
}

function changeStatus(id, newStatus) {
  const app = findApplication(apps, id);
  if (!app || app.status === newStatus) return;
  if (commit(updateApplicationStatus(apps, id, newStatus))) {
    reactToStatus(app, newStatus);
  }
}

/* ---------- Quick add (★ add an application in ~20 seconds) ---------- */
function buildQuickAdd() {
  if (document.getElementById("quickAddModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="quickAddModal" tabindex="-1" aria-labelledby="quickAddTitle" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" id="quickAddForm" novalidate>
          <div class="modal-header">
            <div>
              <h2 class="modal-title h5" id="quickAddTitle">${icon("zap")} Quick add</h2>
              <p class="small text-secondary mb-0">Paste the link, check the details, save. That's it.</p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-danger d-none" id="qa-summary" role="alert">Please enter the company name, job title, and application date before saving.</div>
            <div class="mb-3">
              <label class="form-label" for="qa-link">Job link <span class="optional">optional</span></label>
              <div class="input-with-icon">
                ${icon("link")}
                <input type="url" class="form-control" id="qa-link" name="jobUrl" placeholder="Paste a job link and we'll fill in what we can" aria-describedby="qa-link-hint qa-link-error">
              </div>
              <div class="form-text smart-hint" id="qa-link-hint" aria-live="polite"></div>
              <div class="invalid-feedback" id="qa-link-error"></div>
            </div>
            <div class="row g-3">
              <div class="col-sm-6">
                <label class="form-label" for="qa-company">Company <span class="req" aria-hidden="true">*</span></label>
                <input class="form-control" id="qa-company" name="company" required aria-required="true" aria-describedby="qa-company-error" autocomplete="off">
                <div class="invalid-feedback" id="qa-company-error"></div>
              </div>
              <div class="col-sm-6">
                <label class="form-label" for="qa-jobTitle">Job title <span class="req" aria-hidden="true">*</span></label>
                <input class="form-control" id="qa-jobTitle" name="jobTitle" required aria-required="true" aria-describedby="qa-jobTitle-error" autocomplete="off">
                <div class="invalid-feedback" id="qa-jobTitle-error"></div>
              </div>
              <div class="col-6">
                <label class="form-label" for="qa-status">Status</label>
                <select class="form-select" id="qa-status" name="status">
                  ${STATUSES.slice(0, 4).map((s) => `<option ${s === "Applied" ? "selected" : ""}>${s}</option>`).join("")}
                </select>
                <div class="status-explain" id="qa-status-explain"></div>
              </div>
              <div class="col-6">
                <label class="form-label" for="qa-source">Found it on</label>
                <select class="form-select" id="qa-source" name="source">
                  ${SOURCES.map((s) => `<option ${s === "Other" ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </div>
              <div class="col-sm-6">
                <label class="form-label" for="qa-applicationDate">Application date <span class="req" aria-hidden="true">*</span></label>
                <input type="date" class="form-control" id="qa-applicationDate" name="applicationDate" required aria-required="true" aria-describedby="qa-applicationDate-error">
                <div class="invalid-feedback" id="qa-applicationDate-error"></div>
              </div>
              <div class="col-sm-6 d-flex align-items-end">
                <div class="form-check reminder-check">
                  <input class="form-check-input" type="checkbox" id="qa-remind" checked>
                  <label class="form-check-label" for="qa-remind" id="qa-remind-label">Remind me to follow up</label>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer justify-content-between">
            <a class="small link-subtle" href="form.html">Need more fields? Use the full form</a>
            <button type="submit" class="btn btn-primary">${icon("check")} Save application</button>
          </div>
        </form>
      </div>
    </div>`);

  const form = document.getElementById("quickAddForm");
  const linkInput = document.getElementById("qa-link");
  const hint = document.getElementById("qa-link-hint");

  // Smart paste: fill company, job title + source from the link
  const onLink = () => {
    const guess = guessFromJobUrl(linkInput.value.trim());
    if (!guess) { hint.innerHTML = ""; return; }
    const filled = [];
    const companyInput = document.getElementById("qa-company");
    if (guess.company && !companyInput.value.trim()) {
      companyInput.value = guess.company;
      filled.push(`company <strong>${escapeHtml(guess.company)}</strong>`);
    }
    const titleInput = document.getElementById("qa-jobTitle");
    if (guess.jobTitle && !titleInput.value.trim()) {
      titleInput.value = guess.jobTitle;
      filled.push(`job title <strong>${escapeHtml(guess.jobTitle)}</strong>`);
    }
    if (guess.source) {
      document.getElementById("qa-source").value = guess.source;
      filled.push(`source <strong>${escapeHtml(guess.source)}</strong>`);
    }
    hint.innerHTML = filled.length ? `${icon("sparkles")} Filled in ${filled.join(" and ")} from the link.` : "";
  };
  linkInput.addEventListener("input", onLink);
  explainStatus("qa-status", "qa-status-explain");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = {
      jobUrl: linkInput.value.trim(),
      company: form.company.value,
      jobTitle: form.jobTitle.value,
      status: form.status.value,
      source: form.source.value,
      applicationDate: form.applicationDate.value,
      jobType: /intern/i.test(form.jobTitle.value) ? "Internship" : "Other",
      priority: "Medium"
    };
    const errors = validateApplication(data);
    showFieldErrors(form, "qa-", errors, ["company", "jobTitle", "applicationDate", "jobUrl"]);
    document.getElementById("qa-summary").classList.toggle("d-none", !(errors.company || errors.jobTitle || errors.applicationDate));
    if (Object.keys(errors).length) {
      form.querySelector(".is-invalid")?.focus();
      return;
    }
    if (document.getElementById("qa-remind").checked && data.status !== "Interested") {
      data.followUpDate = addDays(todayStr() > data.applicationDate ? todayStr() : data.applicationDate, Number(settings.followUpDays) || 7);
    }
    const result = addApplication(apps, data);
    bootstrap.Modal.getInstance(document.getElementById("quickAddModal")).hide();
    if (commit(result.apps)) {
      toast("Application saved successfully. You can update its status or schedule a follow-up anytime.", "success",
        { href: `details.html?id=${encodeURIComponent(result.app.id)}`, label: "View application" });
    }
  });
}

function openQuickAdd() {
  buildQuickAdd();
  const form = document.getElementById("quickAddForm");
  form.reset();
  form.querySelectorAll(".is-invalid").forEach((el) => { el.classList.remove("is-invalid"); el.removeAttribute("aria-invalid"); });
  document.getElementById("qa-summary").classList.add("d-none");
  document.getElementById("qa-link-hint").innerHTML = "";
  form.applicationDate.value = todayStr();
  form.applicationDate.max = todayStr();
  form.status.dispatchEvent(new Event("change"));
  document.getElementById("qa-remind-label").textContent = `Remind me to follow up in ${settings.followUpDays || 7} days`;
  const el = document.getElementById("quickAddModal");
  el.addEventListener("shown.bs.modal", () => document.getElementById("qa-link").focus(), { once: true });
  bootstrap.Modal.getOrCreateInstance(el).show();
}

// Shared by the quick add and the full form: says what the chosen status means in plain words
function explainStatus(selectId, explainId) {
  const select = document.getElementById(selectId);
  const show = () => { document.getElementById(explainId).textContent = STATUS_META[select.value]?.hint || ""; };
  select.addEventListener("change", show);
  show();
}

// Shared by the quick add and the full form: show/hide messages under fields
function showFieldErrors(form, idPrefix, errors, fields) {
  fields.forEach((field) => {
    const input = document.getElementById(idPrefix + field);
    const message = document.getElementById(`${idPrefix}${field}-error`);
    if (!input) return;
    if (errors[field]) {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
      if (message) message.textContent = errors[field];
    } else {
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
      if (message) message.textContent = "";
    }
  });
}

/* ---------- Message composer (★ we draft, you send) ---------- */
function openComposer(id, templateKey) {
  const app = findApplication(apps, id);
  if (!app) return;
  document.getElementById("composerModal")?.remove();
  const key = templateKey || messageTemplateFor(app);

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="composerModal" tabindex="-1" aria-labelledby="composerTitle" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <div class="d-flex align-items-center gap-3">
              ${companyAvatar(app.company)}
              <div>
                <h2 class="modal-title h5" id="composerTitle">Write to ${escapeHtml(app.company)}</h2>
                <p class="small text-secondary mb-0">We draft it, you send it. Nothing is sent without you.</p>
              </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label" for="composer-template">Message type</label>
                <select class="form-select" id="composer-template">
                  ${Object.entries(MESSAGE_TEMPLATES).map(([k, label]) => `<option value="${k}" ${k === key ? "selected" : ""}>${label}</option>`).join("")}
                </select>
              </div>
              <div class="col-md-6">
                <span class="form-label d-block">To</span>
                <div class="composer-to">${app.recruiter.email
                  ? `${icon("mail")} ${escapeHtml(app.recruiter.name || "")} &lt;${escapeHtml(app.recruiter.email)}&gt;`
                  : `${icon("user")} No email saved. Copy the message and send it on LinkedIn, or <a href="form.html?id=${encodeURIComponent(app.id)}#recruiter">add a contact</a>.`}</div>
              </div>
              <div class="col-12">
                <label class="form-label" for="composer-subject">Subject</label>
                <input class="form-control" id="composer-subject">
              </div>
              <div class="col-12">
                <label class="form-label" for="composer-body">Message <span class="optional">edit anything you like</span></label>
                <textarea class="form-control composer-body" id="composer-body" rows="11"></textarea>
                ${settings.userName ? "" : `<div class="form-text">${icon("sparkles")} Tip: add your name in <a href="settings.html">Settings</a> and we'll sign messages for you.</div>`}
              </div>
            </div>
            <div class="composer-after d-none mt-3" id="composer-after" role="status">
              ${icon("check")}
              <span>Copied! Sent it?</span>
              ${hasActiveFollowUp(app) ? `<button type="button" class="btn btn-sm btn-success" id="composer-mark-done">Mark follow-up as done</button>` : ""}
            </div>
          </div>
          <div class="modal-footer">
            <a class="btn btn-light" id="composer-mailto" href="#">${icon("mail")} Open in email app</a>
            <button type="button" class="btn btn-primary" id="composer-copy">${icon("copy")} Copy message</button>
          </div>
        </div>
      </div>
    </div>`);

  const el = document.getElementById("composerModal");
  const subject = el.querySelector("#composer-subject");
  const body = el.querySelector("#composer-body");
  const mailto = el.querySelector("#composer-mailto");

  const updateMailto = () => {
    mailto.href = `mailto:${encodeURIComponent(app.recruiter.email || "")}?subject=${encodeURIComponent(subject.value)}&body=${encodeURIComponent(body.value)}`;
  };
  const fill = (k) => {
    const msg = buildMessage(app, k, settings.userName);
    subject.value = msg.subject;
    body.value = msg.body;
    updateMailto();
  };
  fill(key);

  el.querySelector("#composer-template").addEventListener("change", (e) => fill(e.target.value));
  subject.addEventListener("input", updateMailto);
  body.addEventListener("input", updateMailto);
  el.querySelector("#composer-copy").addEventListener("click", async () => {
    const ok = await copyText(`Subject: ${subject.value}\n\n${body.value}`);
    if (ok) el.querySelector("#composer-after").classList.remove("d-none");
    else toast("Couldn't copy automatically. Select the text and press Ctrl+C.", "error");
  });
  el.querySelector("#composer-mark-done")?.addEventListener("click", () => {
    bootstrap.Modal.getInstance(el).hide();
    commit(completeFollowUp(apps, app.id), `Follow-up with ${app.company} marked as done. Nice — that's the step most people skip.`);
  });
  el.addEventListener("hidden.bs.modal", () => el.remove());
  new bootstrap.Modal(el).show();
}

/* ---------- Click actions shared by all pages ----------
   Any button with data-action="..." is handled here (event delegation),
   so buttons that are re-rendered still work. */
const sharedActions = {
  "open-quick-add": () => openQuickAdd(),
  "toggle-theme": () => {
    const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
    settings.theme = isDark ? "light" : "dark";
    saveSettings(settings);
    applyTheme(settings.theme);
    renderNav();
    pageRender();
  },
  open: (el) => { window.location.href = `details.html?id=${encodeURIComponent(el.dataset.id)}`; },
  message: (el) => openComposer(el.dataset.id, el.dataset.template),
  complete: (el) => {
    const app = findApplication(apps, el.dataset.id);
    commit(completeFollowUp(apps, el.dataset.id), `Follow-up with ${app.company} marked as done. Nice — that's the step most people skip.`);
  },
  snooze: (el) => {
    const days = Number(el.dataset.days || 3);
    const app = findApplication(apps, el.dataset.id);
    commit(scheduleFollowUp(apps, el.dataset.id, addDays(todayStr(), days)),
      `Got it. We'll remind you about ${app.company} ${relativeDay(addDays(todayStr(), days))}.`, "info");
  },
  reschedule: async (el) => {
    const app = findApplication(apps, el.dataset.id);
    let date;
    if (el.dataset.days) date = addDays(todayStr(), Number(el.dataset.days));
    else date = await pickDate({ title: `Reschedule follow-up with ${escapeHtml(app.company)}`, initial: addDays(todayStr(), 7) });
    if (!date) return;
    commit(scheduleFollowUp(apps, app.id, date), `Follow-up with ${app.company} scheduled for ${formatDate(date)}.`, "info");
  },
  "mark-applied": (el) => {
    const id = el.dataset.id;
    const app = findApplication(apps, id);
    const next = apps.map((a) => a.id === id
      ? { ...withStatus(a, "Applied"), applicationDate: todayStr(),
          followUpDate: addDays(todayStr(), Number(settings.followUpDays) || 7), followUpCompleted: false }
      : a);
    commit(next, `Applied to ${app.company}! We'll remind you to follow up in ${settings.followUpDays || 7} days.`);
  },
  "set-status": (el) => changeStatus(el.dataset.id, el.dataset.status)
};

function registerActions(actions) {
  Object.assign(pageActions, actions);
}

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const name = el.dataset.action;
  const handler = pageActions[name] || sharedActions[name];
  if (handler) {
    event.preventDefault();
    handler(el, event);
  }
});

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener("keydown", (event) => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable;
  if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.querySelector(".modal.show")) return;
  if (event.key === "n" || event.key === "N") {
    event.preventDefault();
    openQuickAdd();
  } else if (event.key === "/") {
    const search = document.getElementById("search");
    if (search) { event.preventDefault(); search.focus(); }
  }
});

/* ---------- Start a page ----------
   Every page script calls initPage(renderFunction). */
function initPage(render) {
  settings = loadSettings();
  applyTheme(settings.theme);
  apps = loadApplications();
  pageRender = render;
  renderNav();
  renderFooter();
  renderStorageWarning();
  render();
  showFlash();
}

// Follow the system theme live if the user picked "system"
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (settings.theme === "system") { applyTheme("system"); renderNav(); pageRender(); }
});
