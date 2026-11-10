/* =========================================================
   pages/form.js — the full Add / Edit application form
   form.html          -> add a new application
   form.html?id=APP-1 -> edit that application
   ========================================================= */

const editId = getParam("id");
const FIELDS = ["company", "jobTitle", "jobType", "location", "source", "jobUrl", "applicationDate", "status",
  "priority", "deadline", "interviewDate", "salary", "recruiterName", "recruiterEmail", "recruiterPhone",
  "followUpDate", "notes"];
const VALIDATED = ["company", "jobTitle", "applicationDate", "status", "jobUrl", "recruiterEmail",
  "recruiterPhone", "followUpDate", "interviewDate", "deadline"];

function fillSelect(id, options, selected) {
  document.getElementById(id).innerHTML =
    options.map((o) => `<option ${o === selected ? "selected" : ""}>${o}</option>`).join("");
}

// Read every field into a plain object
function readForm() {
  const data = {};
  FIELDS.forEach((field) => {
    const el = document.getElementById("f-" + field);
    data[field] = el ? el.value.trim() : "";
  });
  return data;
}

function writeForm(app) {
  const values = {
    ...app,
    recruiterName: app.recruiter.name,
    recruiterEmail: app.recruiter.email,
    recruiterPhone: app.recruiter.phone
  };
  FIELDS.forEach((field) => {
    const el = document.getElementById("f-" + field);
    if (el) el.value = values[field] ?? "";
  });
}

function setupForm() {
  fillSelect("f-jobType", JOB_TYPES, "Internship");
  fillSelect("f-source", SOURCES, "Other");
  fillSelect("f-priority", PRIORITIES, "Medium");
  fillSelect("f-status", STATUSES, "Applied");

  const form = document.getElementById("app-form");

  if (editId) {
    const app = findApplication(apps, editId);
    if (!app) {
      form.classList.add("d-none");
      document.getElementById("form-title").textContent = "Application not found";
      document.getElementById("form-sub").textContent = "";
      document.getElementById("not-found").innerHTML = `<div class="panel">${emptyState({
        iconName: "search",
        title: "We couldn't find that application",
        text: "It may have been deleted. You can go back to your list or add a new one.",
        actionHtml: `<a class="btn btn-primary" href="applications.html">Go to applications</a>`
      })}</div>`;
      return;
    }
    document.title = `Edit ${app.company} · Onward`;
    document.getElementById("form-title").textContent = `Edit ${app.company}`;
    document.getElementById("form-sub").textContent = "Update anything that changed. Status changes are added to the application's history.";
    document.getElementById("save-btn").textContent = "Save changes";
    document.getElementById("cancel-link").href = `details.html?id=${encodeURIComponent(app.id)}`;
    document.getElementById("back-link").href = `details.html?id=${encodeURIComponent(app.id)}`;
    writeForm(app);
  } else {
    document.getElementById("f-applicationDate").value = todayStr();
  }

  explainStatus("f-status", "f-status-explain");

  // Smart paste on the job link
  document.getElementById("f-jobUrl").addEventListener("input", (e) => {
    const guess = guessFromJobUrl(e.target.value.trim());
    const hint = document.getElementById("f-jobUrl-hint");
    if (!guess || editId) { hint.innerHTML = ""; return; }
    const filled = [];
    const company = document.getElementById("f-company");
    if (guess.company && !company.value.trim()) {
      company.value = guess.company;
      filled.push(`company <strong>${escapeHtml(guess.company)}</strong>`);
    }
    const title = document.getElementById("f-jobTitle");
    if (guess.jobTitle && !title.value.trim()) {
      title.value = guess.jobTitle;
      title.dispatchEvent(new Event("change")); // keeps the "intern" -> Internship rule below working
      filled.push(`job title <strong>${escapeHtml(guess.jobTitle)}</strong>`);
    }
    document.getElementById("f-source").value = guess.source;
    filled.push(`source <strong>${escapeHtml(guess.source)}</strong>`);
    hint.innerHTML = `${icon("sparkles")} Filled in ${filled.join(" and ")} from the link.`;
  });

  // Job title containing "intern" -> set job type to Internship
  document.getElementById("f-jobTitle").addEventListener("change", (e) => {
    if (!editId && /intern/i.test(e.target.value)) document.getElementById("f-jobType").value = "Internship";
  });

  document.getElementById("suggest-followup").addEventListener("click", () => {
    const base = document.getElementById("f-applicationDate").value || todayStr();
    const start = base > todayStr() ? base : todayStr();
    document.getElementById("f-followUpDate").value = addDays(start, Number(settings.followUpDays) || 7);
  });

  // Clear a field's error as soon as the user fixes it
  form.addEventListener("input", (e) => {
    if (e.target.classList.contains("is-invalid")) {
      e.target.classList.remove("is-invalid");
      e.target.removeAttribute("aria-invalid");
    }
  });

  form.addEventListener("submit", onSubmit);

  // Jump to the recruiter section if the link asked for it (form.html?id=…#recruiter)
  if (window.location.hash === "#recruiter") {
    setTimeout(() => document.getElementById("f-recruiterName").focus(), 100);
  }
}

function onSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = readForm();
  const errors = validateApplication(data);
  showFieldErrors(form, "f-", errors, VALIDATED);

  const summary = document.getElementById("form-summary");
  if (Object.keys(errors).length) {
    const missingRequired = errors.company || errors.jobTitle || errors.applicationDate;
    summary.textContent = missingRequired
      ? "Please enter the company name, job title, and application date before saving."
      : "A few details need a quick fix — they're highlighted below.";
    summary.classList.remove("d-none");
    form.querySelector(".is-invalid")?.focus();
    return;
  }
  summary.classList.add("d-none");

  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true; // stop double-submits

  let next;
  let id = editId;
  const before = editId ? findApplication(apps, editId) : null;
  if (editId) {
    next = updateApplication(apps, editId, data);
  } else {
    const result = addApplication(apps, data);
    next = result.apps;
    id = result.app.id;
  }

  if (!saveApplications(next)) {
    saveBtn.disabled = false;
    toast(STORAGE_ERROR, "error");
    return;
  }

  const statusChanged = before && before.status !== data.status;
  if (statusChanged && data.status === "Offer") setFlash(`An offer from ${data.company}! All that effort paid off.`, "success");
  else setFlash(editId ? "Changes saved." : "Application saved successfully. You can update its status or schedule a follow-up anytime.");
  window.location.href = `details.html?id=${encodeURIComponent(id)}${statusChanged && data.status === "Offer" ? "&celebrate=1" : ""}`;
}

initPage(() => {});
setupForm();
