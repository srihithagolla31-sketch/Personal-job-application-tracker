/**
 * experience.js — the signature interface layer (GSAP-powered):
 *   cursor   a lagging ring + dot that morphs over interactive things
 *            ("OPEN" on rows, "DRAG" on board cards)
 *   ticker   a live broadcast feed of your recent XP events (infinite marquee,
 *            slows to a crawl on hover)
 *   wipe     page transitions: three blue shutters sweep across with the
 *            destination name decoded in the middle
 * Each piece degrades gracefully without GSAP or with reduced motion.
 */
(function (JT) {
  'use strict';

  const U = JT.utils;
  const esc = U.escapeHtml;
  const g = () => JT.motion.gs();
  const ok = () => JT.fx.motionOK();

  /* ---------- Custom cursor ---------- */

  function initCursor() {
    const root = document.getElementById('cursor');
    if (!root) return;
    const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
    if (!fine || !g()) { root.remove(); return; }
    const gs = g();
    const ring = root.querySelector('.cur-ring');
    const dot = root.querySelector('.cur-dot');
    const label = root.querySelector('.cur-label');
    gs.set([ring, dot], { xPercent: -50, yPercent: -50 });
    const rx = gs.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    const ry = gs.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    const dx = gs.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
    const dy = gs.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
    let mode = '';

    const setMode = (next, text = '') => {
      if (next === mode) return;
      mode = next;
      root.dataset.mode = next;
      label.textContent = text;
      const scale = { '': 1, link: 1.7, open: 2.6, drag: 2.6, text: 0.4 }[next] ?? 1;
      gs.to(ring, { scale, duration: 0.45, ease: 'back.out(2)', overwrite: 'auto' });
      gs.to(dot, { scale: next === 'text' ? 0 : next ? 0.5 : 1, duration: 0.3, overwrite: 'auto' });
    };

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !ok()) { root.classList.remove('on'); return; }
      root.classList.add('on');
      rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      if (t.closest('input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), textarea')) setMode('text');
      else if (t.closest('[data-drag-id]') && !t.closest('a, button, select')) setMode('drag', 'DRAG');
      else if (t.closest('tr[data-row-href], .recent-item, .stat-card, .pipe-node') && !t.closest('button, select')) setMode('open', 'OPEN');
      else if (t.closest('a, button, select, label, summary, [data-action], [role="switch"], .cal-cell')) setMode('link');
      else setMode('');
    }, { passive: true });
    document.addEventListener('pointerdown', () => { if (ok()) gs.fromTo(ring, { scale: '-=0.35' }, { scale: '+=0.35', duration: 0.35, ease: 'back.out(3)' }); });
    document.documentElement.addEventListener('mouseleave', () => root.classList.remove('on'));
  }

  /* ---------- Live ticker ---------- */

  let tickerSig = '';
  let tickerTween = null;

  function tickerItem(e) {
    const company = `<b>${esc(e.app.company)}</b>`;
    let icon = 'bi-plus-square';
    let text = `${company} added to the hunt`;
    if (e.type === 'status') {
      icon = JT.STATUS_META[e.status].icon;
      text = `${company} <i class="bi bi-arrow-right" aria-hidden="true"></i> ${esc(e.status)}`;
    } else if (e.type === 'followup') {
      icon = 'bi-check2-circle';
      text = `Followed up with ${company}`;
    } else if (e.type === 'note') {
      icon = 'bi-journal-text';
      text = `Intel logged on ${company}`;
    }
    return `<span class="tk-item"><i class="bi ${icon}" aria-hidden="true"></i>${text}<span class="tk-xp">+${e.xp} XP</span><span class="tk-time">${esc(U.timeAgo(e.at))}</span></span>`;
  }

  function ticker(player) {
    const track = document.getElementById('ticker-track');
    if (!track) return;
    const events = player.events.filter((e) => e.xp > 0).slice(0, 14);
    const sig = events.map((e) => `${e.at}${e.type}${e.xp}`).join('|');
    if (sig === tickerSig) return;
    tickerSig = sig;
    const items = events.length
      ? events.map(tickerItem).join('<span class="tk-sep" aria-hidden="true">◆</span>')
      : '<span class="tk-item">Feed is quiet — log an application to go live</span>';
    track.innerHTML = `<div class="ticker-group">${items}<span class="tk-sep" aria-hidden="true">◆</span></div><div class="ticker-group" aria-hidden="true">${items}<span class="tk-sep" aria-hidden="true">◆</span></div>`;
    if (tickerTween) { tickerTween.kill(); tickerTween = null; }
    const gs = g();
    if (!gs || !ok()) { track.style.transform = ''; return; }
    requestAnimationFrame(() => {
      const w = track.firstElementChild.getBoundingClientRect().width;
      if (!w) return;
      tickerTween = gs.fromTo(track, { x: 0 }, { x: -w, duration: w / 48, ease: 'none', repeat: -1 });
    });
  }

  function bindTickerHover() {
    const vp = document.querySelector('.ticker-viewport');
    if (!vp) return;
    const slow = (to) => { if (tickerTween && g()) g().to(tickerTween, { timeScale: to, duration: 0.6, ease: 'power2.out' }); };
    vp.addEventListener('mouseenter', () => slow(0.12));
    vp.addEventListener('mouseleave', () => slow(1));
  }

  /* ---------- Page wipe ---------- */

  const ROUTE_LABELS = {
    dashboard: 'Mission control', applications: 'Inventory', app: 'Dossier', followups: 'Mission log',
    contacts: 'Party', trophies: 'Trophy room', settings: 'Options',
  };

  let wiping = false;

  function wipe(routeName, swap) {
    const gs = g();
    const el = document.getElementById('wipe');
    if (!gs || !ok() || !el || wiping) { swap(); return; }
    wiping = true;
    const bars = el.querySelectorAll('.wipe-bar');
    const label = el.querySelector('.wipe-label');
    label.textContent = `// ${(ROUTE_LABELS[routeName] || routeName || '').toUpperCase()}`;
    gs.set(bars, { y: 0, yPercent: 101 });
    gs.set(el, { display: 'block' });
    gs.timeline({ onComplete: () => { wiping = false; gs.set(el, { display: 'none' }); } })
      .to(bars, { yPercent: 0, duration: 0.36, ease: 'power4.in', stagger: 0.055 })
      .fromTo(label, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', onStart: () => JT.motion.scramble(label, { duration: 320 }) }, '-=0.12')
      .add(() => { try { swap(); } catch (err) { console.error(err); } })
      .to(label, { opacity: 0, y: -24, duration: 0.2, ease: 'power2.in' }, '+=0.12')
      .to(bars, { yPercent: -101, duration: 0.5, ease: 'power4.out', stagger: 0.055 }, '<0.05');
  }

  function init() {
    initCursor();
    bindTickerHover();
  }

  JT.experience = { init, ticker, wipe, ROUTE_LABELS };
})(globalThis.JT = globalThis.JT || {});
