/* =========================================================
   filters.js — search, filter and sort for the Applications page
   ========================================================= */

const SORT_OPTIONS = {
  updated: "Recently updated",
  "applied-new": "Applied date (newest)",
  "applied-old": "Applied date (oldest)",
  company: "Company (A–Z)",
  followup: "Follow-up date (soonest)"
};

// Search company, job title and recruiter name (case-insensitive)
function matchesSearch(app, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [app.company, app.jobTitle, app.recruiter.name]
    .some((field) => field.toLowerCase().includes(q));
}

/* filters = { search, status, jobType, priority, followUp }
   Empty values ("") mean "all". */
function filterApplications(apps, filters) {
  return apps.filter((app) => {
    if (!matchesSearch(app, filters.search || "")) return false;
    if (filters.status && app.status !== filters.status) return false;
    if (filters.jobType && app.jobType !== filters.jobType) return false;
    if (filters.priority && app.priority !== filters.priority) return false;
    if (filters.followUp === "overdue" && getFollowUpState(app) !== "overdue") return false;
    if (filters.followUp === "active" && !hasActiveFollowUp(app)) return false;
    if (filters.active && !ACTIVE_STATUSES.includes(app.status)) return false;
    return true;
  });
}

function sortApplications(apps, sortBy) {
  const list = [...apps]; // never sort the original array in place
  switch (sortBy) {
    case "applied-new":
      return list.sort((a, b) => b.applicationDate.localeCompare(a.applicationDate));
    case "applied-old":
      return list.sort((a, b) => a.applicationDate.localeCompare(b.applicationDate));
    case "company":
      return list.sort((a, b) => a.company.localeCompare(b.company));
    case "followup":
      // Applications with an active follow-up first (soonest first), the rest after
      return list.sort((a, b) => {
        const fa = hasActiveFollowUp(a) ? a.followUpDate : "9999-12-31";
        const fb = hasActiveFollowUp(b) ? b.followUpDate : "9999-12-31";
        return fa.localeCompare(fb);
      });
    case "updated":
    default:
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
