/**
 * storage.js — the only module that touches localStorage.
 * Every read is validated and every write is wrapped so a full or blocked
 * storage never crashes the app (PRD §10.5).
 */
(function (JT) {
  'use strict';

  const KEYS = {
    apps: 'jobtracker_applications',
    settings: 'jobtracker_settings',
    version: 'jobtracker_data_version',
    game: 'jobtracker_game',
    corrupt: 'jobtracker_applications_corrupt_backup',
  };
  const DATA_VERSION = '2';

  const DEFAULT_SETTINGS = {
    playerName: 'Player One',
    sound: false,
    reduceMotion: false,
    listView: 'table',
    sort: 'updated',
    showClosedFollowUps: false,
    liveBg: true,
  };

  function safeGet(key) {
    try { return { ok: true, value: localStorage.getItem(key) }; } catch (error) { return { ok: false, error }; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); return { ok: true }; } catch (error) { return { ok: false, error }; }
  }

  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
  }

  /**
   * Returns { apps, status, invalid } where status is one of:
   *  ok | seeded | partial | corrupt | unavailable
   */
  function loadApplications() {
    const read = safeGet(KEYS.apps);
    if (!read.ok) {
      return { apps: JT.applications.buildSampleApplications(), status: 'unavailable', invalid: 0 };
    }
    if (read.value === null) {
      const apps = JT.applications.buildSampleApplications();
      saveApplications(apps);
      safeSet(KEYS.version, DATA_VERSION);
      return { apps, status: 'seeded', invalid: 0 };
    }
    let parsed;
    try {
      parsed = JSON.parse(read.value);
    } catch (_) {
      safeSet(KEYS.corrupt, read.value);
      return { apps: [], status: 'corrupt', invalid: 0 };
    }
    if (!Array.isArray(parsed)) {
      safeSet(KEYS.corrupt, read.value);
      return { apps: [], status: 'corrupt', invalid: 0 };
    }
    const { records, invalid } = JT.applications.normalizeAll(parsed);
    return { apps: records, status: invalid ? 'partial' : 'ok', invalid };
  }

  function saveApplications(apps) {
    return safeSet(KEYS.apps, JSON.stringify(apps));
  }

  function loadSettings() {
    const read = safeGet(KEYS.settings);
    let parsed = {};
    if (read.ok && read.value) {
      try { parsed = JSON.parse(read.value) || {}; } catch (_) { parsed = {}; }
    }
    const s = { ...DEFAULT_SETTINGS };
    if (typeof parsed.playerName === 'string' && parsed.playerName.trim()) s.playerName = parsed.playerName.trim().slice(0, 40);
    if (typeof parsed.sound === 'boolean') s.sound = parsed.sound;
    if (typeof parsed.reduceMotion === 'boolean') s.reduceMotion = parsed.reduceMotion;
    if (['table', 'board'].includes(parsed.listView)) s.listView = parsed.listView;
    if (parsed.sort && JT.filters.SORTS[parsed.sort]) s.sort = parsed.sort;
    if (typeof parsed.showClosedFollowUps === 'boolean') s.showClosedFollowUps = parsed.showClosedFollowUps;
    if (typeof parsed.liveBg === 'boolean') s.liveBg = parsed.liveBg;
    return s;
  }

  const saveSettings = (settings) => safeSet(KEYS.settings, JSON.stringify(settings));

  function loadGame() {
    const read = safeGet(KEYS.game);
    if (!read.ok || !read.value) return null;
    try {
      const g = JSON.parse(read.value);
      return {
        unlocked: g && typeof g.unlocked === 'object' && !Array.isArray(g.unlocked) ? g.unlocked : {},
        lastLevel: Number.isInteger(g && g.lastLevel) ? g.lastLevel : 1,
      };
    } catch (_) {
      return null;
    }
  }

  const saveGame = (game) => safeSet(KEYS.game, JSON.stringify(game));

  function resetToSample() {
    const apps = JT.applications.buildSampleApplications();
    safeRemove(KEYS.game);
    safeRemove(KEYS.corrupt);
    safeSet(KEYS.version, DATA_VERSION);
    return { apps, result: saveApplications(apps) };
  }

  function clearAll() {
    safeRemove(KEYS.game);
    safeRemove(KEYS.corrupt);
    return saveApplications([]);
  }

  function usageBytes() {
    let total = 0;
    Object.values(KEYS).forEach((k) => {
      const r = safeGet(k);
      if (r.ok && r.value) total += (k.length + r.value.length) * 2; // UTF-16
    });
    return total;
  }

  JT.storage = {
    KEYS, DATA_VERSION, DEFAULT_SETTINGS, loadApplications, saveApplications, loadSettings, saveSettings,
    loadGame, saveGame, resetToSample, clearAll, usageBytes,
  };
})(globalThis.JT = globalThis.JT || {});
