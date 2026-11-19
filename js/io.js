/**
 * io.js: CSV / JSON export and validated import (PRD §6.2).
 */
(function (JT) {
  'use strict';

  const CSV_FIELDS = [
    'id', 'company', 'jobTitle', 'jobType', 'location', 'priority', 'status', 'applicationDate', 'deadline',
    'interviewDate', 'jobUrl', 'salary', 'recruiterName', 'recruiterEmail', 'recruiterPhone', 'followUpDate',
    'followUpNote', 'followUpCompleted', 'notes', 'createdAt', 'updatedAt',
  ];

  const FORMULA_START = /^[=+\-@\t\r]/;

  /** Quote a CSV cell and neutralise spreadsheet formula injection. */
  function csvCell(value) {
    let s = value === undefined || value === null ? '' : String(value);
    if (FORMULA_START.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCSV(apps) {
    const rows = apps.map((a) => {
      const flat = { ...JT.applications.toFormData(a), id: a.id, followUpCompleted: a.followUpCompleted, createdAt: a.createdAt, updatedAt: a.updatedAt };
      return CSV_FIELDS.map((f) => csvCell(flat[f])).join(',');
    });
    return `${CSV_FIELDS.join(',')}\r\n${rows.join('\r\n')}`;
  }

  /** RFC-4180-ish parser: quoted cells, escaped quotes, newlines inside quotes. */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const src = String(text).replace(/^﻿/, '');
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
        else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i += 1;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  const unescapeFormula = (s) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

  function fromCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('That CSV file has no application rows.');
    const header = rows[0].map((h) => h.trim());
    const missing = ['company', 'jobTitle', 'applicationDate', 'status'].filter((h) => !header.includes(h));
    if (missing.length) throw new Error(`The CSV is missing required columns: ${missing.join(', ')}.`);
    const raw = rows.slice(1).map((r) => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = unescapeFormula((r[i] || '').trim()); });
      obj.followUpCompleted = obj.followUpCompleted === 'true';
      if (!obj.id) obj.id = JT.utils.uid('APP');
      return obj;
    });
    return JT.applications.normalizeAll(raw);
  }

  function toJSON(apps) {
    return JSON.stringify({ app: 'JobTrack', version: JT.storage.DATA_VERSION, exportedAt: new Date().toISOString(), applications: apps }, null, 2);
  }

  function fromJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { throw new Error('That file is not valid JSON.'); }
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.applications) ? parsed.applications : null;
    if (!list) throw new Error('No applications were found in that JSON file.');
    return JT.applications.normalizeAll(list);
  }

  /**
   * Merges imported records into the current list by id. CSV rows don't
   * carry history, so existing history/logs are kept for matching ids.
   */
  function mergeImported(current, imported, { keepHistory = false } = {}) {
    const byId = new Map(current.map((a) => [a.id, a]));
    let added = 0;
    let updated = 0;
    imported.forEach((rec) => {
      const existing = byId.get(rec.id);
      if (!existing) { byId.set(rec.id, rec); added += 1; return; }
      updated += 1;
      if (!keepHistory) { byId.set(rec.id, rec); return; }
      const history = existing.status === rec.status
        ? existing.statusHistory
        : [...existing.statusHistory, { status: rec.status, at: new Date().toISOString() }];
      byId.set(rec.id, {
        ...rec,
        statusHistory: history,
        followUpLog: existing.followUpLog,
        notesLog: existing.notesLog,
        createdAt: existing.createdAt,
      });
    });
    return { apps: [...byId.values()], added, updated };
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  JT.io = { CSV_FIELDS, toCSV, parseCSV, fromCSV, toJSON, fromJSON, mergeImported, download };
})(globalThis.JT = globalThis.JT || {});
