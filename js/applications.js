/* =========================================================
   applications.js — create, update, delete, validate
   These functions never touch the page (no DOM). They take the
   applications array and return a NEW array, which keeps them easy to test.
   ========================================================= */

/* ---------- Validation ----------
   Returns an object like { company: "Please enter…" }. Empty object = valid. */
function validateApplication(data) {
  const errors = {};

  if (!data.company || !data.company.trim()) errors.company = "Please enter the company name.";
  if (!data.jobTitle || !data.jobTitle.trim()) errors.jobTitle = "Please enter the job title.";

  if (!data.applicationDate) errors.applicationDate = "Please choose the application date.";
  else if (!isValidDateStr(data.applicationDate)) errors.applicationDate = "Please enter a valid date.";
  else if (data.applicationDate > todayStr() && data.status !== "Interested") {
    errors.applicationDate = "The application date can't be in the future.";
  }

  if (!STATUSES.includes(data.status)) errors.status = "Please choose a status.";

  if (data.jobUrl && !isValidUrl(data.jobUrl)) errors.jobUrl = "Please enter a full link starting with https://";
  if (data.recruiterEmail && !isValidEmail(data.recruiterEmail)) errors.recruiterEmail = "Please enter a valid email, like name@company.com";
  if (data.recruiterPhone && !isValidPhone(data.recruiterPhone)) errors.recruiterPhone = "Please enter a valid phone number.";

  if (data.followUpDate) {
    if (!isValidDateStr(data.followUpDate)) errors.followUpDate = "Please enter a valid date.";
    else if (data.applicationDate && data.followUpDate < data.applicationDate) {
      errors.followUpDate = "The follow-up date can't be before the application date.";
    }
  }
  if (data.interviewDate && !isValidDateStr(data.interviewDate)) errors.interviewDate = "Please enter a valid date.";
  if (data.deadline && !isValidDateStr(data.deadline)) errors.deadline = "Please enter a valid date.";

  return errors;
}

/* ---------- Create ----------
   formData is a flat object from the form. We build the full record. */
function createApplication(formData) {
  const now = new Date().toISOString();
  const status = formData.status || "Applied";
  return normalizeApplication({
    id: generateId(),
    company: formData.company,
    jobTitle: formData.jobTitle,
    jobType: formData.jobType,
    location: formData.location,
    source: formData.source,
    jobUrl: formData.jobUrl,
    applicationDate: formData.applicationDate,
    status,
    priority: formData.priority,
    deadline: formData.deadline,
    interviewDate: formData.interviewDate,
    salary: formData.salary,
    recruiter: {
      name: formData.recruiterName,
      email: formData.recruiterEmail,
      phone: formData.recruiterPhone
    },
    followUpDate: formData.followUpDate,
    followUpCompleted: false,
    followUpHistory: [],
    notes: formData.notes,
    statusHistory: [{ status, date: todayStr() < formData.applicationDate ? todayStr() : formData.applicationDate }],
    createdAt: now,
    updatedAt: now
  });
}

function addApplication(apps, formData) {
  const app = createApplication(formData);
  return { apps: [app, ...apps], app };
}

/* ---------- Update (edit form) ---------- */
function updateApplication(apps, id, formData) {
  return apps.map((app) => {
    if (app.id !== id) return app;

    const followUpChanged = (formData.followUpDate || "") !== app.followUpDate;
    let updated = {
      ...app,
      company: formData.company.trim(),
      jobTitle: formData.jobTitle.trim(),
      jobType: formData.jobType,
      location: (formData.location || "").trim(),
      source: formData.source,
      jobUrl: (formData.jobUrl || "").trim(),
      applicationDate: formData.applicationDate,
      priority: formData.priority,
      deadline: formData.deadline || "",
      interviewDate: formData.interviewDate || "",
      salary: (formData.salary || "").trim(),
      recruiter: {
        name: (formData.recruiterName || "").trim(),
        email: (formData.recruiterEmail || "").trim(),
        phone: (formData.recruiterPhone || "").trim()
      },
      followUpDate: formData.followUpDate || "",
      // A new follow-up date means a new, not-yet-done follow-up
      followUpCompleted: followUpChanged ? false : app.followUpCompleted,
      notes: (formData.notes || "").trim(),
      updatedAt: new Date().toISOString()
    };
    if (formData.status !== app.status) updated = withStatus(updated, formData.status);
    return updated;
  });
}

/* ---------- Status ---------- */
function withStatus(app, status) {
  if (!STATUSES.includes(status)) throw new Error("Invalid application status.");
  if (app.status === status) return app;
  return {
    ...app,
    status,
    statusHistory: [...app.statusHistory, { status, date: todayStr() }],
    updatedAt: new Date().toISOString()
  };
}

function updateApplicationStatus(apps, id, status) {
  return apps.map((app) => (app.id === id ? withStatus(app, status) : app));
}

/* ---------- Delete ---------- */
function deleteApplication(apps, id) {
  return apps.filter((app) => app.id !== id);
}

function findApplication(apps, id) {
  return apps.find((app) => app.id === id) || null;
}

/* ---------- Follow-ups ---------- */
function completeFollowUp(apps, id) {
  return apps.map((app) => {
    if (app.id !== id || !app.followUpDate || app.followUpCompleted) return app;
    return {
      ...app,
      followUpCompleted: true,
      followUpHistory: [...app.followUpHistory, { due: app.followUpDate, doneOn: todayStr() }],
      updatedAt: new Date().toISOString()
    };
  });
}

function scheduleFollowUp(apps, id, dateStr) {
  return apps.map((app) =>
    app.id === id
      ? { ...app, followUpDate: dateStr, followUpCompleted: false, updatedAt: new Date().toISOString() }
      : app
  );
}

function clearRecruiter(apps, id) {
  return apps.map((app) =>
    app.id === id
      ? { ...app, recruiter: { name: "", email: "", phone: "" }, updatedAt: new Date().toISOString() }
      : app
  );
}

/* ---------- Smart paste: guess company, title + source from a job link ----------
   e.g. https://careers.zoho.com/jobs/123      -> company "Zoho", source "Company website"
        https://www.linkedin.com/jobs/view/1   -> source "LinkedIn" (company unknown)
        https://boards.greenhouse.io/razorpay  -> company "Razorpay"
        https://internshala.com/internship/detail/python-development-internship-in-pune-at-acme-labs1791882889
                                               -> company "Acme Labs", title "Python Development Internship" */
const JOB_BOARDS = {
  "linkedin.com": "LinkedIn",
  "internshala.com": "Internshala",
  "naukri.com": "Naukri",
  "unstop.com": "Unstop",
  "indeed.com": "Other",
  "indeed.co.in": "Other",
  "wellfound.com": "Other",
  "instahyre.com": "Other",
  "glassdoor.co.in": "Other",
  "glassdoor.com": "Other",
  "foundit.in": "Other"
};
// Hiring platforms that put the company name in the path
const ATS_PATH_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com"];
// Job boards whose links end in "<title>-at-<company><id>"
const AT_SLUG_BOARDS = ["LinkedIn", "Internshala"];

function titleCase(word) {
  return word
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function guessFromJobSlug(pathname) {
  const slug = pathname.split("/").filter(Boolean).pop() || "";
  const at = slug.lastIndexOf("-at-");
  if (at === -1) return { company: "", jobTitle: "" };
  const company = slug.slice(at + 4).replace(/-?\d{6,}$/, "");
  const jobTitle = slug
    .slice(0, at)
    .replace(/^((fresher|remote|part-time|work-from-home)-)+/, "")
    .replace(/-(internship|job)-in-.+$/, "-$1")
    .replace(/-job$/, "")
    .replace(/-intern-internship$/, "-intern");
  return { company: titleCase(company), jobTitle: titleCase(jobTitle) };
}

function guessFromJobUrl(link) {
  if (!isValidUrl(link)) return null;
  const url = new URL(link);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  for (const board in JOB_BOARDS) {
    if (host === board || host.endsWith("." + board)) {
      const source = JOB_BOARDS[board];
      const fromSlug = AT_SLUG_BOARDS.includes(source) ? guessFromJobSlug(url.pathname) : { company: "", jobTitle: "" };
      return { ...fromSlug, source };
    }
  }
  for (const ats of ATS_PATH_HOSTS) {
    if (host.endsWith(ats)) {
      const firstPart = url.pathname.split("/").filter(Boolean)[0] || "";
      return { company: firstPart ? titleCase(firstPart) : "", source: "Company website" };
    }
  }
  if (host.includes("myworkdayjobs.com")) {
    return { company: titleCase(host.split(".")[0]), source: "Company website" };
  }

  // Normal company site: take the main name from the domain
  const parts = host.split(".");
  const skip = ["careers", "jobs", "apply", "hiring", "career", "join", "work"];
  const meaningful = parts.filter((p) => !skip.includes(p));
  // drop endings like com / in / co / io
  const endings = ["com", "in", "co", "io", "org", "net", "ai", "dev", "tech", "app"];
  const nameParts = meaningful.filter((p) => !endings.includes(p));
  const name = nameParts[nameParts.length - 1] || "";
  if (!name || name === "example") return { company: "", source: "Company website" };
  return { company: titleCase(name), source: "Company website" };
}
