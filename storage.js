/* =========================================================
   storage.js — the data model + saving/loading with localStorage
   Every page calls loadApplications() first and saveApplications() after a change.
   ========================================================= */

/* ---------- The data model (shared lists) ---------- */
const STATUSES = ["Interested", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];
const ACTIVE_STATUSES = ["Interested", "Applied", "Assessment", "Interview", "Offer"];
const CLOSED_STATUSES = ["Rejected", "Withdrawn"];
const JOB_TYPES = ["Internship", "Full-time", "Part-time", "Other"];
const PRIORITIES = ["High", "Medium", "Low"];
const SOURCES = ["Campus placement", "LinkedIn", "Internshala", "Naukri", "Unstop", "Referral", "Company website", "Other"];

/* ---------- localStorage keys (from the PRD) ---------- */
const STORAGE_KEYS = {
  applications: "jobtracker_applications",
  settings: "jobtracker_settings",
  version: "jobtracker_data_version"
};
const DATA_VERSION = "1";

const DEFAULT_SETTINGS = {
  userName: "",
  followUpDays: 7,
  theme: "light",            // "light" | "dark" | "system"
  sortBy: "updated"          // remembered sort on the Applications page
};

// If something goes wrong while loading, we remember it here so the page can show a warning
let storageWarning = null;

function getStorageWarning() {
  return storageWarning;
}

/* ---------- Normalising a record ----------
   Old, imported or hand-edited data might be missing fields.
   normalizeApplication() returns a clean record, or null if it's unusable. */
function normalizeApplication(raw) {
  if (!raw || typeof raw !== "object") return null;

  const company = typeof raw.company === "string" ? raw.company.trim() : "";
  const jobTitle = typeof raw.jobTitle === "string" ? raw.jobTitle.trim() : "";
  if (!company || !jobTitle) return null;
  if (!isValidDateStr(raw.applicationDate)) return null;
  if (!STATUSES.includes(raw.status)) return null;

  const text = (v) => (typeof v === "string" ? v.trim() : "");
  const date = (v) => (isValidDateStr(v) ? v : "");
  const recruiter = raw.recruiter && typeof raw.recruiter === "object" ? raw.recruiter : {};
  const now = new Date().toISOString();

  return {
    id: text(raw.id) || generateId(),
    company,
    jobTitle,
    jobType: JOB_TYPES.includes(raw.jobType) ? raw.jobType : "Other",
    location: text(raw.location),
    source: SOURCES.includes(raw.source) ? raw.source : "Other",
    jobUrl: text(raw.jobUrl),
    applicationDate: raw.applicationDate,
    status: raw.status,
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : "Medium",
    deadline: date(raw.deadline),
    interviewDate: date(raw.interviewDate),
    salary: text(raw.salary),
    recruiter: {
      name: text(recruiter.name),
      email: text(recruiter.email),
      phone: text(recruiter.phone)
    },
    followUpDate: date(raw.followUpDate),
    followUpCompleted: Boolean(raw.followUpCompleted),
    followUpHistory: Array.isArray(raw.followUpHistory)
      ? raw.followUpHistory.filter((f) => f && isValidDateStr(f.doneOn))
      : [],
    notes: text(raw.notes),
    statusHistory: Array.isArray(raw.statusHistory) && raw.statusHistory.length
      ? raw.statusHistory.filter((h) => h && STATUSES.includes(h.status) && isValidDateStr(h.date))
      : [{ status: raw.status, date: raw.applicationDate }],
    createdAt: text(raw.createdAt) || now,
    updatedAt: text(raw.updatedAt) || now
  };
}

/* ---------- Load ---------- */
function loadApplications() {
  storageWarning = null;
  let rawText;

  try {
    rawText = localStorage.getItem(STORAGE_KEYS.applications);
  } catch {
    storageWarning = "This browser is blocking storage, so changes can't be saved. Try a normal (non-private) window.";
    return [];
  }

  // First launch: nothing saved yet -> start with the sample data
  if (rawText === null) {
    const sample = createSampleApplications();
    saveApplications(sample);
    return sample;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    storageWarning = "Your saved data couldn't be read (it may be damaged). You can reset to demo data in Settings.";
    return [];
  }

  if (!Array.isArray(parsed)) {
    storageWarning = "Your saved data is in an unexpected format. You can reset to demo data in Settings.";
    return [];
  }

  // Keep every valid record, skip the broken ones (the PRD's "partial" state)
  const apps = parsed.map(normalizeApplication).filter(Boolean);
  const skipped = parsed.length - apps.length;
  if (skipped > 0) {
    storageWarning = `${plural(skipped, "saved record")} couldn't be read and ${skipped === 1 ? "was" : "were"} skipped. Everything else is safe.`;
  }
  return apps;
}

/* ---------- Save ---------- */
function saveApplications(apps) {
  try {
    localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify(apps));
    localStorage.setItem(STORAGE_KEYS.version, DATA_VERSION);
    return true;
  } catch {
    return false; // pages show: "We couldn't save your changes in this browser…"
  }
}

/* ---------- Settings ---------- */
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings));
    return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/* ---------- Reset helpers (used on the Settings page) ---------- */
function resetToSampleData() {
  return saveApplications(createSampleApplications());
}

function clearAllApplications() {
  return saveApplications([]);
}
