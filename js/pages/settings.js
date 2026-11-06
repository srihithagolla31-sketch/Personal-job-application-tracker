/* =========================================================
   pages/settings.js — preferences, export/import, reset
   ========================================================= */

function renderSettings() {
  document.getElementById("s-name").value = settings.userName || "";
  document.getElementById("s-days").value = String(settings.followUpDays || 7);
  const themeInput = document.getElementById(`t-${settings.theme || "light"}`);
  if (themeInput) themeInput.checked = true;
}

function setupSettings() {
  document.getElementById("s-name").addEventListener("change", (e) => {
    settings.userName = e.target.value.trim();
    if (saveSettings(settings)) toast(settings.userName ? `Nice to meet you, ${settings.userName.split(" ")[0]}!` : "Name removed.");
  });
  document.getElementById("s-days").addEventListener("change", (e) => {
    settings.followUpDays = Number(e.target.value);
    if (saveSettings(settings)) toast(`We'll suggest following up after ${settings.followUpDays} days.`);
  });
  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener("change", () => {
      settings.theme = input.value;
      saveSettings(settings);
      applyTheme(settings.theme);
      renderNav();
    });
  });
  document.getElementById("import-file").addEventListener("change", importBackup);
}

/* ---------- CSV export ---------- */
function toCsv(list) {
  const columns = [
    ["Company", (a) => a.company], ["Job title", (a) => a.jobTitle], ["Status", (a) => a.status],
    ["Job type", (a) => a.jobType], ["Location", (a) => a.location], ["Source", (a) => a.source],
    ["Priority", (a) => a.priority], ["Application date", (a) => a.applicationDate],
    ["Deadline", (a) => a.deadline], ["Interview date", (a) => a.interviewDate],
    ["Follow-up date", (a) => a.followUpDate], ["Follow-up completed", (a) => (a.followUpCompleted ? "Yes" : "No")],
    ["Recruiter name", (a) => a.recruiter.name], ["Recruiter email", (a) => a.recruiter.email],
    ["Recruiter phone", (a) => a.recruiter.phone], ["Salary / stipend", (a) => a.salary],
    ["Job URL", (a) => a.jobUrl], ["Notes", (a) => a.notes]
  ];
  // Wrap every value in quotes and double any quotes inside it (the CSV rule)
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = columns.map(([name]) => cell(name)).join(",");
  const rows = list.map((app) => columns.map(([, get]) => cell(get(app))).join(","));
  return "﻿" + [header, ...rows].join("\r\n"); // ﻿ helps Excel read ₹ and other symbols
}

/* ---------- JSON backup restore ---------- */
function importBackup(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch {
      toast("That file isn't a valid Onward backup.", "error");
      return;
    }
    const list = Array.isArray(parsed) ? parsed : parsed.applications;
    if (!Array.isArray(list)) {
      toast("That file isn't a valid Onward backup.", "error");
      return;
    }
    const valid = list.map(normalizeApplication).filter(Boolean);
    const skipped = list.length - valid.length;
    if (!valid.length) {
      toast("No valid applications were found in that file.", "error");
      return;
    }
    const ok = await confirmDialog({
      title: "Restore this backup?",
      message: `This will replace your current ${plural(apps.length, "application")} with ${plural(valid.length, "application")} from the file.${skipped ? ` ${skipped} invalid record(s) will be skipped.` : ""}`,
      confirmLabel: "Restore backup"
    });
    if (ok) commit(valid, `Restored ${plural(valid.length, "application")}.`);
  };
  reader.readAsText(file);
}

registerActions({
  "export-csv": () => {
    if (!apps.length) { toast("There are no applications to export yet.", "info"); return; }
    downloadFile(`onward-applications-${todayStr()}.csv`, toCsv(apps), "text/csv;charset=utf-8");
    toast(`Exported ${plural(apps.length, "application")} to CSV.`);
  },
  "export-json": () => {
    const backup = { app: "Onward", version: DATA_VERSION, exportedAt: new Date().toISOString(), applications: apps };
    downloadFile(`onward-backup-${todayStr()}.json`, JSON.stringify(backup, null, 2), "application/json");
    toast("Backup downloaded. Keep it somewhere safe.");
  },
  "reset-demo": async () => {
    const ok = await confirmDialog({
      title: "Reset to demo data?",
      message: "Your current applications will be replaced with the sample applications.",
      confirmLabel: "Reset demo data",
      danger: true
    });
    if (ok) commit(createSampleApplications(), "Demo data restored.", "info");
  },
  "clear-all": async () => {
    const ok = await confirmDialog({
      title: "Delete all applications?",
      message: "Every application will be removed from this browser. This action cannot be undone from the tracker.",
      confirmLabel: "Delete everything",
      danger: true
    });
    if (ok) commit([], "All applications deleted. A fresh start!", "info");
  }
});

setupSettings();
initPage(renderSettings);
