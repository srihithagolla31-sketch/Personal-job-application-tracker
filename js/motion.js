/**
 * motion.js: small, restrained transitions using the native Web Animations API.
 * The public API matches the previous engine so callers stay unchanged.
 * Decorative UI effects (scroll reveals, magnetic buttons, tilt, XP orbs,
 * text scrambles, sliding nav ink) are intentionally no-ops. gs() exposes the
 * GSAP core, which only the particle scene (background.js) uses.
 * Everything is skipped when the user prefers reduced motion.
 */
(function (JT) {
  'use strict';

  const ok = () => JT.fx.motionOK();
  const EASE = { out: 'cubic-bezier(.2, .8, .2, 1)', in: 'cubic-bezier(.4, 0, 1, 1)' };

  function tween(el, keyframes, { duration = 180, delay = 0, ease = 'out', fill = 'none' } = {}) {
    if (!el || !el.animate || !ok()) return null;
    return el.animate(keyframes, { duration, delay, easing: EASE[ease] || ease, fill });
  }

  /** Short fade when a new screen is shown. */
  function pageEnter(root) {
    tween(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
  }

  /* ---------- FLIP: rows glide to their new place on sort/filter ---------- */

  function capture(root) {
    const snap = { map: new Map() };
    if (!root || !ok()) return snap;
    root.querySelectorAll('[data-flip]').forEach((el) => snap.map.set(el.dataset.flip, el.getBoundingClientRect()));
    return snap;
  }

  function flip(root, before) {
    if (!root || !before || !before.map.size || !ok()) return;
    root.querySelectorAll('[data-flip]').forEach((el) => {
      const prev = before.map.get(el.dataset.flip);
      if (!prev) return;
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      tween(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220 });
    });
  }

  /* ---------- Progress bars and rings: set their final value ---------- */

  function bars(root) {
    root.querySelectorAll('[data-width]').forEach((el) => { el.style.width = el.dataset.width; });
    root.querySelectorAll('[data-offset]').forEach((el) => { el.style.strokeDashoffset = el.dataset.offset; });
  }

  /* ---------- Feedback ---------- */

  /** Briefly highlight the element the user just changed. */
  function flash(el) {
    if (!el) return;
    el.classList.add('flash-row');
    setTimeout(() => el.classList.remove('flash-row'), 900);
  }

  function toastIn(el) {
    tween(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 160 });
  }

  function toastOut(el, done) {
    const anim = tween(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, ease: 'in', fill: 'forwards' });
    if (anim) anim.onfinish = done; else done();
  }

  /** Decorative effects that were removed. Kept as no-ops so call sites stay valid. */
  function orbs(_from, _to, { onArrive } = {}) { if (onArrive) onArrive(); }
  const noop = () => {};

  JT.motion = {
    EASE, tween, pageEnter, capture, flip, bars, flash, toastIn, toastOut, orbs,
    gs: () => (typeof window !== 'undefined' && window.gsap) || null, has: () => false, pulse: noop, modalIn: noop, navInk: noop, scramble: noop,
    stagger: noop, splitWords: noop, revealBlock: noop, resetReveals: noop, init: noop,
  };
})(globalThis.JT = globalThis.JT || {});
