/**
 * app.js — controller: routing, rendering, events, modals, game feedback.
 * Data flows one way: action → pure function (applications/follow-ups) →
 * commit() → storage → render(). Every metric is re-derived on render.
 */
(function (JT) {
  'use strict';

  const U = JT.utils;
  const V = JT.views;
  const A = JT.applications;
  const FU = JT.followUps;
  const FX = JT.fx;
  const S = JT.storage;
  const esc = U.escapeHtml;
  const $ = (sel, root = document) => root.querySelector(sel);
  const today = () => U.todayISO();

  const state = {
    apps: [],
    settings: { ...S.DEFAULT_SETTINGS },
    game: { unlocked: {}, lastLevel: 1 },
    route: { name: '', param: null, query: new URLSearchParams() },
    ui: { filters: { ...JT.filters.DEFAULT_FILTERS }, calMonth: null, calSelected: null, contactQuery: '' },
    editingId: null,
    pendingFocus: null,
    booting: true,
    palette: { items: [], index: 0 },
  };
  const modals = {};

  /* ======================= Feedback ======================= */

  const TOAST_ICONS = {
    success: 'bi-check-circle-fill', danger: 'bi-x-octagon-fill', warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill', achieve: 'bi-trophy-fill',
  };

  function toast(message, tone = 'success', { action, timeout = 4200, html = false } = {}) {
    const stack = $('#toasts');
    const el = document.createElement('div');
    el.className = `jt-toast tone-${tone}`;
    el.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    el.innerHTML = `<i class="bi ${TOAST_ICONS[tone] || TOAST_ICONS.info}" aria-hidden="true"></i>
      <div class="jt-toast-body">${html ? message : esc(message)}</div>
      ${action ? `<button type="button" class="btn btn-sm btn-toast-action">${esc(action.label)}</button>` : ''}
      <button type="button" class="btn-close" aria-label="Dismiss notification"></button>`;
    el.dataset.flip = U.uid('toast');
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      JT.motion.toastOut(el, () => {
        const before = JT.motion.capture(stack);
        el.remove();
        JT.motion.flip(stack, before, { enterNew: false });
      });
    };
    el.querySelector('.btn-close').addEventListener('click', close);
    if (action) el.querySelector('.btn-toast-action').addEventListener('click', () => { close(); action.run(); });
    const beforeStack = JT.motion.capture(stack);
    stack.appendChild(el);
    while (stack.children.length > 4) stack.firstElementChild.remove();
    JT.motion.flip(stack, beforeStack, { enterNew: false });
    JT.motion.toastIn(el);
    setTimeout(close, action ? timeout + 3000 : timeout);
  }

  function confirmDialog({ title, message, confirmLabel = 'Delete', tone = 'danger', icon = 'bi-exclamation-triangle' }) {
    return new Promise((resolve) => {
      const el = $('#confirmModal');
      const ok = $('#confirmOk');
      $('#confirmTitle').textContent = title;
      $('#confirmMsg').textContent = message;
      ok.textContent = confirmLabel;
      ok.className = `btn btn-${tone}`;
      $('#confirmIcon').className = `confirm-icon tone-${tone}`;
      $('#confirmIcon').innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;
      let result = false;
      const onOk = () => { result = true; modals.confirm.hide(); };
      const onHidden = () => {
        ok.removeEventListener('click', onOk);
        el.removeEventListener('hidden.bs.modal', onHidden);
        resolve(result);
      };
      ok.addEventListener('click', onOk);
      el.addEventListener('hidden.bs.modal', onHidden);
      el.addEventListener('shown.bs.modal', () => $('#confirmCancel').focus(), { once: true });
      modals.confirm.show();
    });
  }

  /* ======================= State changes ======================= */

  const getPlayer = () => JT.game.getPlayer(state.apps, today());

  function commit(nextApps, { message, tone = 'success', anchor, action, celebrateOffer = false, flash, pulse } = {}) {
    const before = getPlayer();
    state.apps = nextApps;
    const saved = S.saveApplications(nextApps);
    if (!saved.ok) {
      toast("We couldn't save your changes in this browser. Please try again. Your latest changes may not have been stored.", 'danger', { timeout: 9000 });
    }
    const after = getPlayer();
    const gained = after.xp - before.xp;
    if (message) toast(message, tone, { action });
    const origin = anchor && anchor.isConnected ? anchor : $('#hud');
    const originRect = origin.getBoundingClientRect();
    if (gained > 0) {
      FX.floatText(`+${gained} XP`, origin);
      FX.sound('xp');
    }
    if (celebrateOffer) { FX.confetti(); FX.sound('offer'); JT.world.quake(); }
    render();
    if (flash) document.querySelectorAll(`[data-flip$="-${CSS.escape(flash)}"]`).forEach((el) => JT.motion.flash(el));
    if (pulse) { const p = $(pulse); if (p) JT.motion.pulse(p); }
    if (gained > 0) {
      // Orbs start where the action happened (the anchor may have been re-rendered).
      const ghost = document.createElement('span');
      ghost.style.cssText = `position:fixed;left:${originRect.left}px;top:${originRect.top}px;width:${originRect.width}px;height:${originRect.height}px;pointer-events:none`;
      document.body.appendChild(ghost);
      JT.world.pulse(originRect.left + originRect.width / 2, originRect.top + originRect.height / 2, { amp: 0.2 });
      JT.motion.orbs(ghost, $('#hud'), { onArrive: () => { bumpHud(); JT.world.pulseAt($('#hud'), { amp: 0.14, life: 1.2 }); } });
      ghost.remove();
    }
    checkProgress(after);
  }

  function checkProgress(player) {
    const achievements = JT.game.evaluateAchievements(state.apps, player, state.game.unlocked, today());
    const fresh = achievements.filter((a) => a.earnedNow && !state.game.unlocked[a.id]);
    let changed = false;
    fresh.forEach((a, i) => {
      state.game.unlocked[a.id] = new Date().toISOString();
      changed = true;
      setTimeout(() => {
        toast(`<b>Achievement unlocked · ${esc(a.title)}</b><span class="d-block small opacity-75">${esc(a.desc)}</span>`, 'achieve', { html: true, timeout: 5200 });
        FX.sound('achieve');
      }, 700 + i * 900);
    });
    if (player.level > state.game.lastLevel) {
      state.game.lastLevel = player.level;
      changed = true;
      setTimeout(() => showLevelUp(player), 450);
    } else if (player.level < state.game.lastLevel) {
      state.game.lastLevel = player.level;
      changed = true;
    }
    if (changed) S.saveGame(state.game);
  }

  function baselineGame() {
    const player = getPlayer();
    const unlocked = {};
    const now = new Date().toISOString();
    JT.game.evaluateAchievements(state.apps, player, {}, today()).forEach((a) => { if (a.earnedNow) unlocked[a.id] = now; });
    state.game = { unlocked, lastLevel: player.level };
    S.saveGame(state.game);
  }

  function showLevelUp(player) {
    $('#levelNum').textContent = player.level;
    $('#levelTitle').textContent = `You reached level ${player.level}`;
    $('#levelRank').textContent = `Rank: ${player.rank}. ${player.next - player.xp} XP to level ${player.level + 1}.`;
    modals.level.show();
    FX.confetti();
    JT.world.quake();
    FX.sound('level');
  }

  function bumpHud() {
    const hud = $('#hud');
    hud.classList.remove('bump');
    void hud.offsetWidth;
    hud.classList.add('bump');
  }

  /* ======================= Routing & rendering ======================= */

  function parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'dashboard', param: parts[1] ? decodeURIComponent(parts[1]) : null, query: new URLSearchParams(qs || '') };
  }

  function onRoute() {
    const r = parseHash();
    const changed = r.name !== state.route.name || r.param !== state.route.param;
    state.route = r;
    if (r.name === 'applications' && [...r.query.keys()].length) {
      const { filters, invalid } = JT.filters.sanitizeFilters({
        query: r.query.get('q') || '',
        status: r.query.get('status') || 'all',
        jobType: r.query.get('type') || 'all',
        priority: r.query.get('priority') || 'all',
      });
      state.ui.filters = filters;
      if (filters.status !== 'all' && state.settings.listView === 'board') {
        state.settings.listView = 'table';
        S.saveSettings(state.settings);
      }
      if (invalid.length) toast('Some filters in that link weren’t recognised, so they were ignored.', 'warning');
      history.replaceState(null, '', '#/applications');
    }
    render({ routeChanged: changed });
  }

  function buildCtx() {
    const t = today();
    const player = getPlayer();
    return {
      apps: state.apps,
      today: t,
      settings: state.settings,
      ui: state.ui,
      player,
      stats: JT.analytics.getApplicationStats(state.apps, t),
      achievements: JT.game.evaluateAchievements(state.apps, player, state.game.unlocked, t),
    };
  }

  function focusSnapshot() {
    const el = document.activeElement;
    if (!el || el === document.body || !$('#main').contains(el)) return null;
    if (el.id) return { selector: `#${CSS.escape(el.id)}`, caret: typeof el.selectionStart === 'number' ? el.selectionStart : null };
    if (el.dataset && el.dataset.action) {
      let sel = `[data-action="${el.dataset.action}"]`;
      ['id', 'value', 'status', 'view', 'days', 'date'].forEach((k) => { if (el.dataset[k]) sel += `[data-${k}="${CSS.escape(el.dataset[k])}"]`; });
      return { selector: sel, caret: null };
    }
    return null;
  }

  function render({ routeChanged = false } = {}) {
    const main = $('#main');
    const snap = routeChanged ? null : focusSnapshot();
    let ctx;
    let title = 'Dashboard';
    try {
      ctx = buildCtx();
      let html;
      switch (state.route.name) {
        case 'dashboard': html = V.dashboard(ctx); break;
        case 'applications': html = V.applicationsShell(ctx); title = 'Applications'; break;
        case 'app': {
          ctx.app = A.getById(state.apps, state.route.param);
          html = V.details(ctx);
          title = ctx.app ? `${ctx.app.company} · ${ctx.app.jobTitle}` : 'Not found';
          break;
        }
        case 'followups': html = V.followUpsPage(ctx); title = 'Follow-ups'; break;
        case 'contacts': html = V.contactsPage(ctx); title = 'Contacts'; break;
        case 'trophies': html = V.trophiesPage(ctx); title = 'Trophies'; break;
        case 'settings': html = V.settingsPage(ctx); title = 'Settings'; break;
        default:
          title = 'Not found';
          html = `<div class="panel">${V.emptyState({ icon: 'bi-signpost', title: 'Page not found', text: 'That screen doesn’t exist.', action: '<a class="btn btn-primary" href="#/dashboard">Go to dashboard</a>' })}</div>`;
      }
      const before = routeChanged ? null : JT.motion.capture(main);
      main.innerHTML = html;
      if (state.route.name === 'applications') renderResults(ctx, { flip: false });
      if (before) JT.motion.flip(main, before);
    } catch (err) {
      console.error(err);
      main.innerHTML = `<div class="panel">${V.emptyState({ icon: 'bi-bug', title: 'Something went wrong showing this screen', text: 'Your saved data is untouched. Try going back to the dashboard.', action: '<a class="btn btn-primary" href="#/dashboard">Back to dashboard</a>' })}</div>`;
    }

    document.title = `${title} · JobTrack`;
    if (ctx) { updateNav(ctx); $('#hud').innerHTML = V.hud(ctx.player); JT.experience.ticker(ctx.player); }
    afterRender(main, routeChanged);

    if (routeChanged) {
      JT.world.setScene(state.route.name);
      window.scrollTo(0, 0);
      const nav = $('#mainNav');
      if (nav.classList.contains('show')) bootstrap.Collapse.getOrCreateInstance(nav).hide();
      const target = state.pendingFocus ? document.getElementById(state.pendingFocus) : null;
      state.pendingFocus = null;
      (target || main).focus({ preventScroll: true });
      if (!state.booting) JT.motion.pageEnter(main);
    } else if (snap) {
      const el = $(snap.selector);
      if (el) {
        el.focus({ preventScroll: true });
        if (snap.caret !== null) { try { el.setSelectionRange(snap.caret, snap.caret); } catch (_) { /* not a text input */ } }
      }
    }
  }

  function renderResults(ctx = buildCtx(), { flip = true } = {}) {
    const res = $('#results');
    if (!res) return;
    const before = flip ? JT.motion.capture(res) : null;
    res.innerHTML = V.results(ctx);
    if (before) JT.motion.flip(res, before);
    $('#results-count').innerHTML = state.apps.length ? V.resultsCount(ctx) : '';
  }

  function afterRender(root, animate) {
    root.querySelectorAll('[data-count]').forEach((el) => {
      if (animate) FX.countUp(el, el.dataset.count);
      else el.textContent = `${el.dataset.count}${el.dataset.suffix || ''}`;
    });
    // Bars and rings tween from their previous value (or from zero on a fresh screen).
    JT.motion.bars(root, { fromZero: animate });
    const step = root.querySelector('.step.current');
    if (step) step.parentElement.scrollLeft = Math.max(0, step.offsetLeft - step.parentElement.clientWidth / 2 + step.offsetWidth / 2);
  }

  function updateNav(ctx) {
    const name = state.route.name === 'app' ? 'applications' : state.route.name;
    document.querySelectorAll('[data-route]').forEach((a) => {
      const on = a.dataset.route === name;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const badge = $('#nav-overdue');
    badge.hidden = !ctx.stats.overdue;
    badge.textContent = ctx.stats.overdue;
    badge.setAttribute('aria-label', `${ctx.stats.overdue} overdue`);
    JT.motion.navInk();
  }

  /** Single "Cosmos" theme; only the motion preference varies. */
  function applyTheme() {
    document.documentElement.setAttribute('data-motion', state.settings.reduceMotion ? 'reduced' : 'full');
  }

  function saveSettings() {
    const r = S.saveSettings(state.settings);
    if (!r.ok) toast('Preferences could not be saved in this browser.', 'warning');
    FX.configure({ reduceMotion: state.settings.reduceMotion, sound: state.settings.sound });
    applyTheme();
  }

  /* ======================= Application form ======================= */

  function buildStatusPicker() {
    $('#status-picker').innerHTML = JT.STATUSES.map((s) => {
      const m = JT.STATUS_META[s];
      return `<input type="radio" class="btn-check" name="status" id="st-${s}" value="${s}">
        <label class="status-opt s-${m.tone}" for="st-${s}" title="${esc(m.hint)}"><i class="bi ${m.icon}" aria-hidden="true"></i>${s}</label>`;
    }).join('');
  }

  function clearFormErrors() {
    const form = $('#app-form');
    form.querySelectorAll('.is-invalid').forEach((el) => { el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.invalid-feedback').forEach((el) => { el.textContent = ''; });
    $('#form-summary').classList.add('d-none');
  }

  function showFieldError(key, msg) {
    const fb = document.getElementById(`err-${key}`);
    const input = key === 'status' ? $('#status-picker') : document.getElementById(`f-${key}`);
    if (fb) fb.textContent = msg || '';
    if (input) {
      input.classList.toggle('is-invalid', Boolean(msg));
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }

  function showFormErrors(errors) {
    clearFormErrors();
    Object.entries(errors).forEach(([k, msg]) => showFieldError(k, msg));
    const missingRequired = ['company', 'jobTitle', 'applicationDate'].some((k) => errors[k]);
    const summary = $('#form-summary');
    summary.innerHTML = `<i class="bi bi-exclamation-circle" aria-hidden="true"></i> ${esc(missingRequired ? JT.validation.MESSAGES.summary : 'A few fields need a quick fix before saving.')}`;
    summary.classList.remove('d-none');
  }

  function readForm() {
    const fd = new FormData($('#app-form'));
    const out = {};
    fd.forEach((v, k) => { out[k] = typeof v === 'string' ? v : ''; });
    return out;
  }

  function openForm(id = null, focusField = null) {
    const form = $('#app-form');
    const app = id ? A.getById(state.apps, id) : null;
    if (id && !app) { toast('This application no longer exists.', 'warning'); return; }
    form.reset();
    clearFormErrors();
    state.editingId = app ? app.id : null;
    const data = app ? A.toFormData(app) : { applicationDate: today(), status: 'Applied', priority: 'Medium', jobType: 'Internship' };
    Object.entries(data).forEach(([name, value]) => {
      const el = form.elements[name];
      if (el) el.value = value ?? '';
    });
    $('#appModalTitle').textContent = app ? 'Edit Application' : 'Add Job Application';
    $('#appModalEyebrow').textContent = app ? app.company : `New entry · +${JT.game.XP_RULES.created} XP`;
    $('#company-list').innerHTML = [...new Set(state.apps.map((a) => a.company))].map((c) => `<option value="${esc(c)}"></option>`).join('');
    $('#appModal').addEventListener('shown.bs.modal', () => {
      const target = (focusField && form.elements[focusField]) || form.elements.company;
      if (target && target.focus) target.focus();
    }, { once: true });
    modals.app.show();
  }

  function saveForm() {
    const data = readForm();
    const errors = JT.validation.validateApplication(data);
    if (Object.keys(errors).length) {
      showFormErrors(errors);
      const first = $('#app-form .is-invalid');
      if (first) (first.id === 'status-picker' ? first.querySelector('input') : first).focus();
      FX.shake($('#appModal .modal-content'));
      FX.sound('error');
      return;
    }
    const btn = $('#app-save');
    btn.disabled = true;
    try {
      const prev = state.editingId ? A.getById(state.apps, state.editingId) : null;
      const created = prev ? null : A.createApplication(data);
      const next = prev ? A.updateApplication(state.apps, prev.id, data) : [created, ...state.apps];
      const becameOffer = data.status === 'Offer' && (!prev || prev.status !== 'Offer');
      modals.app.hide();
      commit(next, {
        message: 'Application saved successfully. You can update its status or schedule a follow-up anytime.',
        anchor: $('#app-save'),
        celebrateOffer: becameOffer,
        flash: prev ? prev.id : created.id,
      });
    } catch (err) {
      if (err.fields) showFormErrors(err.fields); else toast(err.message, 'danger');
    } finally {
      btn.disabled = false;
    }
  }

  /* ======================= Actions ======================= */

  function setStatus(id, status, anchor) {
    const app = A.getById(state.apps, id);
    if (!app || app.status === status) return;
    try {
      const isOffer = status === 'Offer';
      commit(A.updateApplicationStatus(state.apps, id, status), {
        message: isOffer ? `Offer unlocked at ${app.company}! Huge win.` : `${app.company} moved to ${status}.`,
        tone: isOffer ? 'achieve' : 'success',
        anchor,
        celebrateOffer: isOffer,
        flash: id,
        pulse: '.step.current .step-dot',
      });
    } catch (err) {
      toast(err.message, 'danger');
    }
  }

  async function deleteApp(id) {
    const app = A.getById(state.apps, id);
    if (!app) return;
    const ok = await confirmDialog({
      title: `Delete ${app.company}?`,
      message: 'Delete this application? This action cannot be undone from the tracker.',
      confirmLabel: 'Delete application',
    });
    if (!ok) return;
    const onDetails = state.route.name === 'app';
    commit(A.deleteApplication(state.apps, id), { message: `Deleted ${app.company} — ${app.jobTitle}.`, tone: 'info' });
    if (onDetails) window.location.hash = '#/applications';
  }

  function completeFollowUp(id, anchor) {
    const app = A.getById(state.apps, id);
    if (!app) return;
    try {
      commit(FU.completeFollowUp(state.apps, id), {
        message: `Follow-up with ${app.company} marked complete.`,
        anchor,
        action: { label: 'Schedule next', run: () => openFollowModal(id) },
        flash: id,
      });
    } catch (err) {
      toast(err.message, 'warning');
    }
  }

  function snooze(id, days, anchor) {
    const app = A.getById(state.apps, id);
    if (!app) return;
    const date = U.addDays(today(), days);
    commit(FU.scheduleFollowUp(state.apps, id, date), { message: `${app.company} follow-up moved to ${U.formatDate(date)}.`, tone: 'info', anchor, flash: id });
  }

  function openFollowModal(id) {
    const app = A.getById(state.apps, id);
    if (!app) return;
    const t = today();
    const keep = app.followUpDate && !app.followUpCompleted && app.followUpDate >= t;
    $('#follow-id').value = id;
    $('#follow-date').value = keep ? app.followUpDate : U.addDays(t, 3);
    $('#follow-date').classList.remove('is-invalid');
    $('#err-follow-date').textContent = '';
    $('#follow-note').value = app.followUpCompleted ? '' : app.followUpNote;
    $('#followEyebrow').textContent = `${app.company} · ${app.jobTitle}`;
    $('#followTitle').textContent = app.followUpDate && !app.followUpCompleted ? 'Reschedule Follow-up' : 'Schedule Follow-up';
    $('#followModal').addEventListener('shown.bs.modal', () => $('#follow-date').focus(), { once: true });
    modals.follow.show();
  }

  function saveFollowUp(form) {
    const id = form.elements.id.value;
    const date = form.elements.date.value;
    const err = JT.validation.validateFollowUpDate(date);
    if (err) {
      $('#follow-date').classList.add('is-invalid');
      $('#err-follow-date').textContent = err;
      $('#follow-date').focus();
      return;
    }
    const app = A.getById(state.apps, id);
    if (!app) { modals.follow.hide(); return; }
    modals.follow.hide();
    commit(FU.scheduleFollowUp(state.apps, id, date, form.elements.note.value), {
      message: `Follow-up with ${app.company} scheduled for ${U.formatDate(date)} (${U.relativeDays(date, today())}).`,
      flash: id,
    });
  }

  async function clearFollowUpAction(id) {
    const app = A.getById(state.apps, id);
    if (!app) return;
    commit(FU.clearFollowUp(state.apps, id), { message: `Follow-up for ${app.company} cleared.`, tone: 'info' });
  }

  async function clearContact(id) {
    const app = A.getById(state.apps, id);
    if (!app) return;
    const ok = await confirmDialog({ title: 'Clear recruiter contact?', message: `Remove the recruiter details saved on ${app.company}? The application itself stays.`, confirmLabel: 'Clear contact', tone: 'warning', icon: 'bi-eraser' });
    if (ok) commit(A.clearContact(state.apps, id), { message: 'Contact details cleared.', tone: 'info' });
  }

  function addNote(form) {
    const input = form.elements.note;
    try {
      const next = A.addNote(state.apps, form.dataset.id, input.value);
      commit(next, { message: 'Note added.', anchor: form.querySelector('button') });
      const again = $('#note-input');
      if (again) again.focus();
    } catch (err) {
      input.classList.add('is-invalid');
      FX.shake(form);
      toast(err.message, 'warning');
    }
  }

  function deleteNote(id, noteId) {
    const prev = state.apps;
    commit(A.deleteNote(state.apps, id, noteId), {
      message: 'Note deleted.',
      tone: 'info',
      action: { label: 'Undo', run: () => commit(prev, { message: 'Note restored.' }) },
    });
  }

  function exportCsv() {
    if (!state.apps.length) { toast('There are no applications to export yet.', 'info'); return; }
    JT.io.download(`jobtrack-applications-${today()}.csv`, `﻿${JT.io.toCSV(state.apps)}`, 'text/csv;charset=utf-8');
    toast(`Exported ${U.plural(state.apps.length, 'application')} to CSV.`);
  }

  function exportJson() {
    JT.io.download(`jobtrack-backup-${today()}.json`, JT.io.toJSON(state.apps), 'application/json');
    toast('Backup downloaded as JSON.');
  }

  function handleImport(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('That file is larger than 5 MB.', 'danger'); return; }
    const reader = new FileReader();
    reader.onerror = () => toast('That file could not be read.', 'danger');
    reader.onload = async () => {
      try {
        const text = String(reader.result);
        const trimmed = text.trim();
        const isJson = /\.json$/i.test(file.name) || trimmed.startsWith('{') || trimmed.startsWith('[');
        const { records, invalid } = isJson ? JT.io.fromJSON(text) : JT.io.fromCSV(text);
        if (!records.length) throw new Error(`No valid applications were found${invalid ? ` — ${invalid} row(s) were invalid` : ''}.`);
        const ok = await confirmDialog({
          title: `Import ${U.plural(records.length, 'application')}?`,
          message: `Applications with matching IDs will be updated and new ones added.${invalid ? ` ${invalid} invalid row(s) will be skipped.` : ''}`,
          confirmLabel: 'Import', tone: 'primary', icon: 'bi-upload',
        });
        if (!ok) return;
        const { apps, added, updated } = JT.io.mergeImported(state.apps, records, { keepHistory: !isJson });
        commit(apps, { message: `Import complete: ${added} added, ${updated} updated${invalid ? `, ${invalid} skipped` : ''}.` });
      } catch (err) {
        toast(err.message, 'danger');
      }
    };
    reader.readAsText(file);
  }

  async function resetDemo() {
    const ok = await confirmDialog({
      title: 'Reset to demo data?',
      message: 'This replaces all your applications with the sample dataset and resets trophies. Export a backup first if you want to keep your data.',
      confirmLabel: 'Reset demo data', tone: 'warning', icon: 'bi-arrow-counterclockwise',
    });
    if (!ok) return;
    const { apps, result } = S.resetToSample();
    state.apps = apps;
    baselineGame();
    $('#banner').innerHTML = '';
    if (!result.ok) toast("We couldn't save the demo data in this browser.", 'danger');
    else toast('Demo data loaded. Explore away!', 'info');
    render();
  }

  async function clearAll() {
    const ok = await confirmDialog({
      title: 'Delete all applications?',
      message: `This permanently removes all ${state.apps.length} applications from this browser. This action cannot be undone from the tracker.`,
      confirmLabel: 'Delete everything',
    });
    if (!ok) return;
    const r = S.clearAll();
    state.apps = [];
    baselineGame();
    $('#banner').innerHTML = '';
    toast(r.ok ? 'All applications deleted. Fresh start!' : "We couldn't save your changes in this browser.", r.ok ? 'info' : 'danger');
    render();
  }

  function toggleSound() {
    state.settings.sound = !state.settings.sound;
    saveSettings();
    toast(state.settings.sound ? 'Sound effects on.' : 'Sound effects off.', 'info');
    FX.sound('tick');
    render();
  }

  function toggleView() {
    state.settings.listView = state.settings.listView === 'board' ? 'table' : 'board';
    saveSettings();
    render();
  }

  function showShortcuts() {
    $('#shortcuts-body').innerHTML = V.shortcutsTable();
    modals.shortcuts.show();
  }

  function focusSearch() {
    if (state.route.name === 'applications') { const s = $('#search-input'); if (s) s.focus(); return; }
    state.pendingFocus = 'search-input';
    window.location.hash = '#/applications';
  }

  function handleAction(action, el) {
    const id = el.dataset.id;
    switch (action) {
      case 'add-app': openForm(); break;
      case 'edit-app': openForm(id, el.dataset.focus); break;
      case 'delete-app': deleteApp(id); break;
      case 'complete-followup': completeFollowUp(id, el); break;
      case 'snooze': snooze(id, Number(el.dataset.days) || 3, el); break;
      case 'schedule-followup': openFollowModal(id); break;
      case 'clear-followup': clearFollowUpAction(id); break;
      case 'set-status': setStatus(id, el.dataset.status, el); break;
      case 'delete-note': deleteNote(id, el.dataset.note); break;
      case 'clear-contact': clearContact(id); break;
      case 'copy':
        if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.text).then(() => toast('Copied to clipboard.', 'info'), () => toast('Copy failed — select the text instead.', 'warning'));
        break;
      case 'set-view':
        state.settings.listView = el.dataset.view === 'board' ? 'board' : 'table';
        saveSettings();
        render();
        break;
      case 'filter-status':
        state.ui.filters = { ...state.ui.filters, status: el.dataset.value };
        render();
        break;
      case 'clear-filters':
        state.ui.filters = { ...JT.filters.DEFAULT_FILTERS };
        render();
        break;
      case 'export-csv': exportCsv(); break;
      case 'export-json': exportJson(); break;
      case 'import': { const f = $('#import-file'); if (f) f.click(); break; }
      case 'reset-demo': resetDemo(); break;
      case 'clear-all': clearAll(); break;
      case 'open-palette': openPalette(); break;
      case 'show-shortcuts': showShortcuts(); break;
      case 'scroll-overview': { const o = document.getElementById('overview'); if (o) o.scrollIntoView({ behavior: FX.motionOK() ? 'smooth' : 'auto', block: 'start' }); break; }
      case 'cal-prev':
      case 'cal-next': {
        const base = U.parseISODate(`${state.ui.calMonth || today().slice(0, 7)}-01`);
        base.setMonth(base.getMonth() + (action === 'cal-next' ? 1 : -1));
        state.ui.calMonth = U.toISODate(base).slice(0, 7);
        render();
        break;
      }
      case 'cal-day':
        state.ui.calSelected = state.ui.calSelected === el.dataset.date ? null : el.dataset.date;
        render();
        break;
      default: break;
    }
  }

  /* ======================= Command palette ======================= */

  function fuzzyScore(text, q) {
    const idx = text.indexOf(q);
    if (idx !== -1) return 200 - idx;
    let ti = 0;
    let score = 0;
    for (const ch of q) {
      if (ch === ' ') continue;
      const found = text.indexOf(ch, ti);
      if (found === -1) return 0;
      score += found === ti ? 3 : 1;
      ti = found + 1;
    }
    return score;
  }

  function paletteCommands(query) {
    const go = (r) => () => { window.location.hash = `#/${r}`; };
    const actions = [
      { label: 'Add application', icon: 'bi-plus-lg', hint: 'N', run: () => openForm() },
      { label: 'Search applications', icon: 'bi-search', hint: '/', run: focusSearch },
      { label: 'Export applications as CSV', icon: 'bi-filetype-csv', run: exportCsv },
      { label: 'Backup data as JSON', icon: 'bi-filetype-json', run: exportJson },
      { label: `${state.settings.sound ? 'Mute' : 'Enable'} sound effects`, icon: state.settings.sound ? 'bi-volume-mute' : 'bi-volume-up', run: toggleSound },
      { label: 'Toggle list / board view', icon: 'bi-kanban', hint: 'B', run: () => { if (state.route.name !== 'applications') window.location.hash = '#/applications'; toggleView(); } },
      { label: 'Show keyboard shortcuts', icon: 'bi-keyboard', hint: '?', run: showShortcuts },
    ];
    const nav = [['Dashboard', 'dashboard', 'bi-speedometer2'], ['Applications', 'applications', 'bi-collection'], ['Follow-ups', 'followups', 'bi-bell'],
      ['Contacts', 'contacts', 'bi-person-lines-fill'], ['Trophies', 'trophies', 'bi-award'], ['Settings', 'settings', 'bi-gear']]
      .map(([label, r, icon]) => ({ label: `Go to ${label}`, icon, hint: 'Page', run: go(r) }));
    const apps = state.apps.map((a) => ({ label: `${a.company} — ${a.jobTitle}`, icon: 'bi-briefcase', hint: a.status, run: go(`app/${encodeURIComponent(a.id)}`) }));
    const q = query.trim().toLowerCase();
    if (!q) return [...actions.slice(0, 4), ...nav, ...apps.slice(0, 4)];
    return [...actions, ...nav, ...apps]
      .map((c) => ({ c, s: fuzzyScore(c.label.toLowerCase(), q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.c);
  }

  function renderPalette() {
    const { items, index } = state.palette;
    const list = $('#palette-list');
    list.innerHTML = items.length
      ? items.map((c, i) => `<li role="option" id="pal-${i}" class="pal-item ${i === index ? 'on' : ''}" aria-selected="${i === index}" data-pal="${i}">
          <i class="bi ${c.icon}" aria-hidden="true"></i><span class="flex-grow-1 text-truncate">${esc(c.label)}</span>${c.hint ? `<span class="pal-hint">${esc(c.hint)}</span>` : ''}</li>`).join('')
      : '<li class="pal-empty">No matching commands.</li>';
    $('#palette-input').setAttribute('aria-activedescendant', items.length ? `pal-${index}` : '');
    const on = list.querySelector('.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }

  function openPalette() {
    if (document.querySelector('.modal.show')) return;
    const input = $('#palette-input');
    input.value = '';
    state.palette = { items: paletteCommands(''), index: 0 };
    renderPalette();
    $('#paletteModal').addEventListener('shown.bs.modal', () => input.focus(), { once: true });
    modals.palette.show();
  }

  function runPaletteItem(i) {
    const cmd = state.palette.items[i];
    if (!cmd) return;
    $('#paletteModal').addEventListener('hidden.bs.modal', () => cmd.run(), { once: true });
    modals.palette.hide();
  }

  /* ======================= Event wiring ======================= */

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const quick = e.target.closest('[data-quick-date]');
      if (quick) { $('#f-followUpDate').value = U.addDays(today(), Number(quick.dataset.quickDate)); return; }
      const fq = e.target.closest('[data-follow-quick]');
      if (fq) { $('#follow-date').value = U.addDays(today(), Number(fq.dataset.followQuick)); return; }
      const pal = e.target.closest('[data-pal]');
      if (pal) { runPaletteItem(Number(pal.dataset.pal)); return; }

      const row = e.target.closest('tr[data-row-href]');
      if (row && !e.target.closest('a, button, select, input, label')) { window.location.hash = row.dataset.rowHref; return; }

      const el = e.target.closest('[data-action]');
      if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
      e.preventDefault();
      handleAction(el.dataset.action, el);
    });

    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-action="status-change"]')) { setStatus(t.dataset.id, t.value, t); return; }
      if (t.matches('select[data-filter]')) {
        if (t.dataset.filter === 'sort') { state.settings.sort = t.value; saveSettings(); }
        else state.ui.filters = { ...state.ui.filters, [t.dataset.filter]: t.value };
        renderResults();
        return;
      }
      if (t.matches('[data-setting]')) {
        state.settings[t.dataset.setting] = t.checked;
        saveSettings();
        if (t.dataset.setting === 'sound' && t.checked) FX.sound('tick');
        if (t.dataset.setting === 'liveBg') JT.world.setEnabled(t.checked);
        if (t.dataset.setting === 'reduceMotion') JT.world.refresh();
        render();
        return;
      }
      if (t.id === 'import-file') { handleImport(t.files[0]); t.value = ''; return; }
      if (t.name === 'status' && t.closest('#status-picker')) showFieldError('status', '');
    });

    const runSearch = U.debounce(() => renderResults(), 120);
    const runContactSearch = U.debounce(() => render(), 150);
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('[data-filter="query"]')) { state.ui.filters = { ...state.ui.filters, query: t.value }; runSearch(); return; }
      if (t.matches('[data-contact-search]')) { state.ui.contactQuery = t.value; runContactSearch(); return; }
      if (t.id === 'palette-input') { state.palette = { items: paletteCommands(t.value), index: 0 }; renderPalette(); return; }
      if (t.classList.contains('is-invalid') && t.closest('.note-form')) t.classList.remove('is-invalid');
    });

    // Re-validate a field as soon as the user fixes it.
    $('#app-form').addEventListener('focusout', (e) => {
      const t = e.target;
      if (!t.name || !t.id || !t.id.startsWith('f-')) return;
      const errors = JT.validation.validateApplication(readForm());
      if (t.classList.contains('is-invalid') || errors[t.name]) {
        if (t.classList.contains('is-invalid') || t.value) showFieldError(t.name, errors[t.name]);
      }
    });

    document.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-form]');
      if (!form) return;
      e.preventDefault();
      switch (form.dataset.form) {
        case 'application': saveForm(); break;
        case 'note': addNote(form); break;
        case 'followup': saveFollowUp(form); break;
        case 'profile': {
          const name = form.elements.playerName.value.trim().slice(0, 40);
          state.settings.playerName = name || 'Player One';
          saveSettings();
          toast('Display name saved.');
          render();
          break;
        }
        default: break;
      }
    });

    // Kanban drag & drop
    let dragId = null;
    document.addEventListener('dragstart', (e) => {
      const card = e.target instanceof Element && e.target.closest('[data-drag-id]');
      if (!card) return;
      dragId = card.dataset.dragId;
      e.dataTransfer.setData('text/plain', dragId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
      document.body.classList.add('is-dragging');
    });
    document.addEventListener('dragend', () => {
      dragId = null;
      document.querySelectorAll('.dragging, .drop-hover').forEach((x) => x.classList.remove('dragging', 'drop-hover'));
      document.body.classList.remove('is-dragging');
    });
    document.addEventListener('dragover', (e) => {
      const col = e.target instanceof Element && e.target.closest('[data-drop-status]');
      if (!col || !dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.drop-hover').forEach((x) => { if (x !== col) x.classList.remove('drop-hover'); });
      col.classList.add('drop-hover');
    });
    document.addEventListener('drop', (e) => {
      const col = e.target instanceof Element && e.target.closest('[data-drop-status]');
      if (!col) return;
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      col.classList.remove('drop-hover');
      if (id) setStatus(id, col.dataset.dropStatus, col);
    });

    // Keyboard shortcuts
    let gPending = false;
    let gTimer = null;
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable;
      const key = e.key;
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'Enter' && t.closest('#app-form')) { e.preventDefault(); $('#app-form').requestSubmit(); return; }
      if (t.id === 'palette-input') {
        const n = state.palette.items.length;
        if (key === 'ArrowDown') { e.preventDefault(); state.palette.index = n ? (state.palette.index + 1) % n : 0; renderPalette(); }
        if (key === 'ArrowUp') { e.preventDefault(); state.palette.index = n ? (state.palette.index - 1 + n) % n : 0; renderPalette(); }
        if (key === 'Enter') { e.preventDefault(); runPaletteItem(state.palette.index); }
        return;
      }
      if (key === 'Escape' && t.id === 'search-input' && t.value) { t.value = ''; state.ui.filters = { ...state.ui.filters, query: '' }; renderResults(); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal.show')) return;

      if (gPending) {
        gPending = false;
        const map = { d: 'dashboard', a: 'applications', f: 'followups', c: 'contacts', t: 'trophies', s: 'settings' };
        const r = map[key.toLowerCase()];
        if (r) { e.preventDefault(); window.location.hash = `#/${r}`; }
        return;
      }
      switch (key) {
        case 'g': case 'G':
          gPending = true;
          clearTimeout(gTimer);
          gTimer = setTimeout(() => { gPending = false; }, 1200);
          break;
        case 'n': case 'N': e.preventDefault(); openForm(); break;
        case '/': e.preventDefault(); focusSearch(); break;
        case '?': e.preventDefault(); showShortcuts(); break;
        case 'b': case 'B': if (state.route.name === 'applications') { e.preventDefault(); toggleView(); } break;
        default: break;
      }
    });

    window.addEventListener('hashchange', () => {
      const next = parseHash();
      const sameScreen = next.name === state.route.name && next.param === state.route.param;
      if (state.booting || sameScreen) onRoute();
      else JT.experience.wipe(next.name, onRoute);
    });

    // Re-render when the day rolls over so overdue states stay correct.
    let lastDay = today();
    setInterval(() => {
      if (today() !== lastDay) { lastDay = today(); render(); }
    }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && today() !== lastDay) { lastDay = today(); render(); }
    });
  }

  /* ======================= Boot ======================= */

  function showLoadNotice(info) {
    const banner = $('#banner');
    if (info.status === 'corrupt') {
      banner.innerHTML = `<div class="alert alert-warning d-flex gap-3 align-items-start mt-3 mb-0" role="alert">
        <i class="bi bi-exclamation-triangle-fill fs-4" aria-hidden="true"></i>
        <div class="flex-grow-1"><b>We couldn’t read your saved applications.</b><div class="small">The saved data looks damaged. A copy was kept in this browser as <code>${S.KEYS.corrupt}</code>. You can start fresh or load demo data.</div></div>
        <button class="btn btn-sm btn-outline-secondary" data-action="reset-demo">Load demo data</button></div>`;
    } else if (info.status === 'unavailable') {
      banner.innerHTML = `<div class="alert alert-warning mt-3 mb-0 small" role="alert"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
        Browser storage is unavailable (private browsing or blocked site data). You’re seeing demo data, and changes won’t be kept after a refresh.</div>`;
    } else if (info.status === 'partial') {
      toast(`${U.plural(info.invalid, 'saved record')} couldn’t be read and ${info.invalid === 1 ? 'was' : 'were'} skipped. The rest loaded normally.`, 'warning', { timeout: 8000 });
    } else if (info.status === 'seeded') {
      toast('Demo data loaded so you can explore. Reset or clear it anytime in Settings.', 'info', { timeout: 6000 });
    }
  }

  function boot() {
    state.settings = S.loadSettings();
    applyTheme();
    FX.configure({ reduceMotion: state.settings.reduceMotion, sound: state.settings.sound });

    const info = S.loadApplications();
    state.apps = info.apps;

    modals.app = new bootstrap.Modal('#appModal');
    modals.confirm = new bootstrap.Modal('#confirmModal');
    modals.follow = new bootstrap.Modal('#followModal');
    modals.level = new bootstrap.Modal('#levelModal');
    modals.palette = new bootstrap.Modal('#paletteModal');
    modals.shortcuts = new bootstrap.Modal('#shortcutsModal');
    buildStatusPicker();
    bindEvents();
    JT.motion.init();
    JT.world.init({ enabled: state.settings.liveBg });
    JT.experience.init();
    document.addEventListener('show.bs.modal', (e) => JT.motion.modalIn(e.target));

    const savedGame = S.loadGame();
    if (savedGame) state.game = savedGame; else baselineGame();

    onRoute();
    showLoadNotice(info);
    checkProgress(getPlayer());

    // Boot splash: the logo draws itself, then the header logo + screen intro play.
    const bootEl = $('#boot');
    const brand = JT.logo.init();
    const bootLen = JT.logo.intro(bootEl.querySelector('.logo-svg'), { wordmark: bootEl.querySelector('.wordmark') });
    JT.motion.scramble(bootEl.querySelector('.boot-label'), { delay: 300, duration: 900 });
    const hold = FX.motionOK() ? Math.min(bootLen, 1550) : 0;
    setTimeout(() => {
      bootEl.classList.add('done');
      state.booting = false;
      JT.logo.intro(brand.mark, { delay: 120, wordmark: brand.wordmark });
      const main = $('#main');
      main.querySelectorAll('[data-count]').forEach((el) => FX.countUp(el, el.dataset.count));
      JT.motion.bars(main, { fromZero: true });
      JT.motion.pageEnter(main);
      setTimeout(() => bootEl.remove(), 450);
    }, hold);
  }

  // Expose a tiny debug surface for developers poking around in DevTools.
  JT.app = { state, render, commit, toast };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(globalThis.JT = globalThis.JT || {});
