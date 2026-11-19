/**
 * utils.js — date helpers, formatting, validation primitives, ids.
 * All dates for applications/follow-ups are local calendar dates stored as
 * "YYYY-MM-DD" strings, so overdue checks never drift across timezones.
 */
(function (JT) {
  'use strict';

  const DAY_MS = 86400000;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function todayISO(now = new Date()) {
    return toISODate(now);
  }

  function isValidISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function parseISODate(value) {
    if (!isValidISODate(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(iso, n) {
    const d = parseISODate(iso);
    if (!d) return '';
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  /** Whole calendar days from `fromIso` to `toIso` (positive = toIso is later). */
  function diffDays(fromIso, toIso) {
    const a = parseISODate(fromIso);
    const b = parseISODate(toIso);
    if (!a || !b) return NaN;
    return Math.round((b - a) / DAY_MS);
  }

  /** Local calendar date of an ISO timestamp. */
  function localDateOf(timestamp) {
    const d = new Date(timestamp);
    return Number.isNaN(d.getTime()) ? '' : toISODate(d);
  }

  function validTimestamp(value) {
    if (typeof value !== 'string' || !value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function formatDate(iso, { short = false } = {}) {
    const d = parseISODate(iso);
    if (!d) return '—';
    const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    if (short && d.getFullYear() === new Date().getFullYear()) return base;
    return `${base} ${d.getFullYear()}`;
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return `${formatDate(toISODate(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function relativeDays(iso, today = todayISO()) {
    const n = diffDays(today, iso);
    if (Number.isNaN(n)) return '';
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? `in ${n} days` : `${-n} days ago`;
  }

  function timeAgo(ts, now = Date.now()) {
    const t = new Date(ts).getTime();
    if (Number.isNaN(t)) return '';
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d}d ago`;
    return formatDate(localDateOf(ts));
  }

  function uid(prefix = 'APP') {
    let core;
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      core = globalThis.crypto.randomUUID();
    } else {
      // Fallback for older browsers / insecure contexts.
      core = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    }
    return `${prefix}-${core}`;
  }

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
  }

  function debounce(fn, ms = 150) {
    let t;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isValidEmail = (v) => typeof v === 'string' && EMAIL_RE.test(v.trim());

  function isValidUrl(v) {
    try {
      const u = new URL(String(v).trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function isValidPhone(v) {
    if (typeof v !== 'string') return false;
    const t = v.trim();
    return /^\+?[\d\s().-]{6,24}$/.test(t) && (t.match(/\d/g) || []).length >= 6;
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
  }

  /** Stable index 0..n-1 from a string — used to pick a monogram tone. */
  function hashIndex(str, n) {
    let h = 0;
    for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % n;
  }

  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  JT.utils = {
    DAY_MS, MONTHS, toISODate, todayISO, isValidISODate, parseISODate, addDays, diffDays,
    localDateOf, validTimestamp, formatDate, formatDateTime, relativeDays, timeAgo, uid,
    escapeHtml, debounce, isValidEmail, isValidUrl, isValidPhone, initials, hashIndex, plural, clamp,
  };
})(globalThis.JT = globalThis.JT || {});
