/* =========================================================
   utils.js — small helper functions used everywhere
   (dates, ids, safe HTML, URL params, downloads)
   ========================================================= */

/* ---------- Dates ----------
   We store every date as a plain "YYYY-MM-DD" string.
   Why? Because new Date().toISOString() uses UTC time, and in India
   (UTC+5:30) that gives YESTERDAY's date before 5:30 AM. Using local
   date strings avoids wrong "overdue" labels. "YYYY-MM-DD" strings can
   also be compared directly: "2026-11-02" < "2026-11-10" is true. */

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Turn a Date object into "YYYY-MM-DD" using the LOCAL calendar
function toDateStr(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayStr() {
  return toDateStr(new Date());
}

// "2026-11-05" -> Date at local midnight
function parseDateStr(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isValidDateStr(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = parseDateStr(str);
  return toDateStr(d) === str; // rejects things like 2026-02-31
}

function addDays(str, days) {
  const d = parseDateStr(str);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

// Whole days from a to b (b - a). Uses UTC math so daylight-saving never breaks it.
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// "2026-11-05" -> "5 Nov" (adds the year if it isn't this year)
function formatDate(str) {
  if (!isValidDateStr(str)) return "—";
  const d = parseDateStr(str);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" })
  });
}

// Human words for a date compared with today: "today", "tomorrow", "in 3 days", "2 days ago"
function relativeDay(str) {
  const diff = daysBetween(todayStr(), str);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1) return `in ${diff} days`;
  return `${-diff} days ago`;
}

// Monday of the week that contains this date
function startOfWeek(str) {
  const d = parseDateStr(str);
  const day = (d.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  d.setDate(d.getDate() - day);
  return toDateStr(d);
}

function plural(n, word, pluralWord) {
  return `${n} ${n === 1 ? word : pluralWord || word + "s"}`;
}

// "Copperleaf Systems" -> "Copperleaf Systems'", "Zoho" -> "Zoho's"
function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/* ---------- IDs ---------- */
function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return "APP-" + window.crypto.randomUUID().slice(0, 8);
  }
  // Fallback for older browsers
  return "APP-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------- Safe HTML ----------
   Anything the user typed must be escaped before we put it into innerHTML.
   Otherwise typing <img src=x onerror=alert(1)> as a company name would run code. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Validation helpers ---------- */
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str);
}

function isValidPhone(str) {
  return /^[+\d][\d\s\-()]{6,18}$/.test(str);
}

/* ---------- URL query params ---------- */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/* ---------- Downloads (CSV / JSON export) ---------- */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/* ---------- Clipboard ---------- */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers that block the clipboard API
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
