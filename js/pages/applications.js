/* =========================================================
   pages/applications.js — search, filter, sort and list
   ========================================================= */

// UI-only state (not saved with the applications)
const filters = {
  search: "",
  status: getParam("status") && STATUSES.includes(getParam("status")) ? getParam("status") : "",
  jobType: "",
  priority: "",
  followUp: getParam("followup") || ""
};
let sortBy = "updated";

function setupControls() {
  settings = loadSettings();
  sortBy = SORT_OPTIONS[settings.sortBy] ? settings.sortBy : "updated";

  document.getElementById("search-wrap").insertAdjacentHTML("afterbegin", icon("search"));
  document.getElementById("filter-type").insertAdjacentHTML("beforeend",
    JOB_TYPES.map((t) => `<option>${t}</option>`).join(""));
  document.getElementById("filter-priority").insertAdjacentHTML("beforeend",
    PRIORITIES.map((p) => `<option>${p}</option>`).join(""));
  document.getElementById("sort").innerHTML =
    Object.entries(SORT_OPTIONS).map(([key, label]) => `<option value="${key}" ${key === sortBy ? "selected" : ""}>${label}</option>`).join("");

  document.getElementById("search").addEventListener("input", (e) => { filters.search = e.target.value; renderResults(); });
  document.getElementById("filter-type").addEventListener("change", (e) => { filters.jobType = e.target.value; renderResults(); });
  document.getElementById("filter-priority").addEventListener("change", (e) => { filters.priority = e.target.value; renderResults(); });
  document.getElementById("sort").addEventListener("change", (e) => {
    sortBy = e.target.value;
    settings.sortBy = sortBy;        // remember the choice (a "display preference" in the PRD)
    saveSettings(settings);
    renderResults();
  });
  document.getElementById("clear-filters").addEventListener("click", clearFilters);

  // Clicking anywhere on a table row opens that application
  document.getElementById("results").addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (row && !e.target.closest("a, button")) {
      window.location.href = `details.html?id=${encodeURIComponent(row.dataset.id)}`;
    }
  });
}

function clearFilters() {
  filters.search = ""; filters.status = ""; filters.jobType = ""; filters.priority = ""; filters.followUp = "";
  document.getElementById("search").value = "";
  document.getElementById("filter-type").value = "";
  document.getElementById("filter-priority").value = "";
  history.replaceState(null, "", "applications.html");
  renderApplicationsPage();
}

function renderApplicationsPage() {
  renderChips();
  renderResults();
}

function renderChips() {
  const counts = countByStatus(apps);
  const chips = [{ value: "", label: "All", count: apps.length },
    ...STATUSES.map((s) => ({ value: s, label: s, count: counts[s] }))];
  document.getElementById("status-chips").innerHTML = chips.map((c) => `
    <button type="button" class="filter-chip" data-action="filter-status" data-status="${c.value}"
      aria-pressed="${filters.status === c.value}">
      ${c.value ? icon(STATUS_META[c.value].icon) : ""}${c.label}<span class="chip-count">${c.count}</span>
    </button>`).join("");
}

function renderResults() {
  const results = sortApplications(filterApplications(apps, filters), sortBy);
  const holder = document.getElementById("results");
  const anyFilter = filters.search || filters.status || filters.jobType || filters.priority || filters.followUp;

  document.getElementById("clear-filters").classList.toggle("d-none", !anyFilter);
  document.getElementById("result-count").textContent = anyFilter
    ? `Showing ${results.length} of ${plural(apps.length, "application")}${filters.followUp === "overdue" ? " · overdue follow-ups only" : ""}`
    : plural(apps.length, "application");
  document.getElementById("page-sub").textContent = apps.length
    ? `${apps.filter((a) => ACTIVE_STATUSES.includes(a.status)).length} active · ${apps.filter((a) => CLOSED_STATUSES.includes(a.status)).length} closed`
    : "Every opportunity in one place.";

  if (apps.length === 0) {
    holder.innerHTML = `<div class="panel">${emptyState({
      iconName: "sparkles",
      title: "Your job search starts here",
      text: "Add your first application to keep every opportunity organised.",
      actionHtml: `<button class="btn btn-primary" data-action="open-quick-add">${icon("plus")} Add application</button>`
    })}</div>`;
    return;
  }

  if (results.length === 0) {
    holder.innerHTML = `<div class="panel">${emptyState({
      iconName: "search",
      title: "No applications found",
      text: "No applications match your search. Try another company name or change the filters.",
      actionHtml: `<button class="btn btn-light" data-action="clear-filters">Clear all filters</button>`
    })}</div>`;
    return;
  }

  holder.innerHTML = `
    <!-- Laptop / tablet: table -->
    <div class="app-table-wrap d-none d-md-block">
      <div class="table-responsive">
        <table class="table app-table">
          <caption class="visually-hidden">Your job applications</caption>
          <thead>
            <tr>
              <th scope="col">Company &amp; role</th>
              <th scope="col">Status</th>
              <th scope="col">Applied</th>
              <th scope="col">Follow-up</th>
              <th scope="col">Priority</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            ${results.map((app) => `
              <tr data-id="${escapeHtml(app.id)}">
                <td>
                  <div class="cell-company">
                    ${companyAvatar(app.company)}
                    <div>
                      <a href="details.html?id=${encodeURIComponent(app.id)}">${escapeHtml(app.company)}</a>
                      <small>${escapeHtml(app.jobTitle)}${app.location ? ` · ${escapeHtml(app.location)}` : ""}</small>
                    </div>
                  </div>
                </td>
                <td>${statusBadge(app.status)}</td>
                <td class="text-nowrap">${formatDate(app.applicationDate)}</td>
                <td>${followUpChip(app)}</td>
                <td>${priorityLabel(app.priority)}</td>
                <td class="text-end text-nowrap">
                  <a class="btn btn-icon btn-sm" href="form.html?id=${encodeURIComponent(app.id)}" aria-label="Edit ${escapeHtml(app.company)} application" title="Edit">${icon("edit")}</a>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Phone: stacked cards -->
    <ul class="app-cards d-md-none">
      ${results.map((app) => `
        <li>
          <a class="app-card" href="details.html?id=${encodeURIComponent(app.id)}">
            <div class="app-card-top">
              ${companyAvatar(app.company)}
              <div class="row-main">
                <span class="row-title">${escapeHtml(app.company)}</span>
                <span class="row-sub">${escapeHtml(app.jobTitle)}</span>
              </div>
            </div>
            <div class="app-card-meta">
              ${statusBadge(app.status)}
              ${hasActiveFollowUp(app) ? followUpChip(app) : ""}
              <span>${icon("calendar")} Applied ${formatDate(app.applicationDate)}</span>
            </div>
          </a>
        </li>`).join("")}
    </ul>`;
}

registerActions({
  "filter-status": (el) => {
    filters.status = el.dataset.status;
    renderApplicationsPage();
  },
  "clear-filters": () => clearFilters()
});

setupControls();
initPage(renderApplicationsPage);
