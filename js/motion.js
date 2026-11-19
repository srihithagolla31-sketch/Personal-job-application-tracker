/**
 * motion.js — animation engine.
 *
 * Primary driver: GSAP 3.13 (free for all uses) with ScrollTrigger, SplitText,
 * Flip, MotionPath, DrawSVG and CustomEase. If the CDN is unreachable, every
 * call falls back to the browser's native Web Animations API, so the app
 * never depends on the library to work.
 *
 *   tween / stagger   keyframe tweens with named eases
 *   pageEnter         screen intro: SplitText headings, scrambled HUD labels,
 *                     staggered panels + child sequences, ScrollTrigger reveals
 *                     and scrubbed hero parallax
 *   capture / flip    Flip-plugin layout animation across re-renders
 *   bars              progress bars / rings tween from their previous value
 *   orbs              XP orbs fly along MotionPath curves into the HUD
 *
 * Everything is skipped when the user prefers reduced motion.
 */
(function (JT) {
  'use strict';

  /* ---------- GSAP bootstrap ---------- */

  let registered = false;
  function gs() {
    const g = typeof window !== 'undefined' ? window.gsap : null;
    if (!g) return null;
    if (!registered) {
      registered = true;
      const plugins = ['ScrollTrigger', 'SplitText', 'Flip', 'DrawSVGPlugin', 'MotionPathPlugin', 'CustomEase'].map((n) => window[n]).filter(Boolean);
      g.registerPlugin(...plugins);
      if (window.CustomEase) {
        window.CustomEase.create('jt.out', '0.22, 1, 0.36, 1');
        window.CustomEase.create('jt.snap', 'M0,0 C0.12,0.8 0.2,1.04 0.38,1.04 0.56,1.04 0.62,0.99 1,1');
      }
    }
    return g;
  }
  const has = (name) => Boolean(gs() && window[name]);

  const supportsLinear = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)');

  /** Native (WAAPI) eases — used only when GSAP is unavailable. */
  const EASE = {
    out: 'cubic-bezier(.22, 1, .36, 1)',
    in: 'cubic-bezier(.55, 0, 1, .45)',
    inOut: 'cubic-bezier(.65, 0, .35, 1)',
    back: 'cubic-bezier(.34, 1.56, .64, 1)',
    linear: 'linear',
    spring: supportsLinear
      ? 'linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)'
      : 'cubic-bezier(.34, 1.4, .64, 1)',
    elastic: supportsLinear
      ? 'linear(0, 0.218 2.1%, 0.862 6.5%, 1.114, 1.296 10.7%, 1.346, 1.37 12.9%, 1.37, 1.354 14.9%, 1.315 16.3%, 1.141 20.4%, 1.088, 1.051 23.5%, 1.019 24.9%, 0.984 26.9%, 0.954 30.4%, 0.94 33.4%, 0.951 36.6%, 0.996 44.4%, 1.008 49.1%, 1.012 52.7%, 1.006 61.6%, 0.998 73.5%, 1)'
      : 'cubic-bezier(.34, 1.56, .64, 1)',
  };

  /** GSAP eases for the same names. */
  const GEASE = {
    out: 'jt.out', in: 'power3.in', inOut: 'power3.inOut', back: 'back.out(1.9)',
    spring: 'elastic.out(1, 0.6)', elastic: 'elastic.out(1.15, 0.38)', linear: 'none',
  };
  const gEase = (name) => (GEASE[name] ? (GEASE[name] === 'jt.out' && !window.CustomEase ? 'expo.out' : GEASE[name]) : name);

  const ok = () => JT.fx.motionOK();
  const strip = (k) => { const o = { ...k }; delete o.offset; return o; };

  /* ---------- Core tweens ---------- */

  /**
   * Tween `el` through WAAPI-style keyframes. The final keyframe should match
   * the element's natural style; when it finishes, inline styles touched by the
   * tween are restored so CSS (hover states etc.) keeps control.
   */
  function tween(el, keyframes, { duration = 650, delay = 0, ease = 'out', fill = 'backwards' } = {}) {
    if (!el || !ok()) return null;
    const props = new Set();
    keyframes.forEach((k) => Object.keys(k).forEach((p) => { if (p !== 'offset') props.add(p); }));
    const g = gs();
    // SVG parts take CSS transform strings, which the native engine handles natively.
    if (!g || (el instanceof SVGElement && props.has('transform'))) {
      if (!el.animate) return null;
      return el.animate(keyframes, { duration, delay, easing: EASE[ease] || ease, fill });
    }
    const saved = {};
    props.forEach((p) => { saved[p] = el.style[p]; });
    const restore = () => props.forEach((p) => { el.style[p] = saved[p]; });
    const vars = { duration: duration / 1000, delay: delay / 1000, ease: gEase(ease), onComplete: restore, overwrite: false };
    if (keyframes.length === 2 && keyframes[1].offset === undefined) {
      return g.fromTo(el, { ...strip(keyframes[0]), immediateRender: fill !== 'none' }, { ...strip(keyframes[1]), ...vars });
    }
    const kf = {};
    keyframes.forEach((k, i) => {
      const off = k.offset !== undefined ? k.offset : i / (keyframes.length - 1);
      kf[`${Math.round(off * 100)}%`] = strip(k);
    });
    return g.to(el, { keyframes: kf, ...vars });
  }

  function stagger(els, keyframes, { each = 50, delay = 0, from = 'start', max = 24, ...opts } = {}) {
    const list = Array.from(els || []);
    const mid = (list.length - 1) / 2;
    return list.map((el, i) => {
      let order = i;
      if (from === 'center') order = Math.abs(i - mid);
      if (from === 'end') order = list.length - 1 - i;
      return tween(el, keyframes, { ...opts, delay: delay + Math.min(order, max) * each });
    });
  }

  const KF = {
    fadeUp: [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }],
    fadeUpSm: [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
    slideLeft: [{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }],
    pop: [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }],
    popSm: [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }],
    growX: [{ transform: 'scaleX(0)' }, { transform: 'none' }],
    rise: [{ transform: 'translateY(105%)' }, { transform: 'none' }],
  };

  /* ---------- Text effects ---------- */

  /** Headline reveal: SplitText chars rising from a mask (fallback: word rise). */
  function splitWords(el, { delay = 0 } = {}) {
    if (!el || !ok() || el.dataset.split) return;
    const text = el.textContent.trim();
    if (!text) return;
    if (has('SplitText')) {
      el.dataset.split = '1';
      const split = window.SplitText.create(el, { type: 'words,chars', mask: 'chars', aria: 'auto' });
      gs().from(split.chars, {
        yPercent: 115, rotate: 6, duration: 0.95, delay: delay / 1000, ease: 'expo.out',
        stagger: { each: 0.028, from: 'start' },
      });
      return;
    }
    if (el.children.length) return; // native fallback only handles plain-text headings
    el.dataset.split = '1';
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(/\s+/)
      .map((w) => `<span class="sw" aria-hidden="true"><span class="sw-i">${JT.utils.escapeHtml(w)}</span></span>`)
      .join(' ');
    stagger(el.querySelectorAll('.sw-i'), KF.rise, { each: 55, delay, duration: 800, ease: 'out' });
  }

  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+';

  /** Decodes text from random glyphs, HUD style. Always lands on the real text. */
  function scramble(el, { duration = 650, delay = 0 } = {}) {
    if (!el || !ok()) return;
    const final = el.textContent;
    if (!final.trim()) return;
    const start = performance.now() + delay;
    let raf;
    const frame = (now) => {
      const p = Math.max(0, Math.min(1, (now - start) / duration));
      const revealed = Math.floor(p * final.length);
      el.textContent = final.slice(0, revealed) + final.slice(revealed).replace(/\S/g, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]);
      if (p < 1) raf = requestAnimationFrame(frame);
      else el.textContent = final;
    };
    raf = requestAnimationFrame(frame);
    setTimeout(() => { cancelAnimationFrame(raf); el.textContent = final; }, delay + duration + 60);
  }

  /* ---------- Choreography ---------- */

  const BLOCK_SEL = '.hero-strip, .page-head, nav[aria-label="breadcrumb"], .panel, .stat-card, .board-col, .results-count';

  const SEQUENCES = [
    ['.pipe-dot', KF.pop, { each: 90, duration: 800, ease: 'back' }],
    ['.pipe-link', KF.growX, { each: 90, delay: 120, duration: 600, ease: 'inOut' }],
    ['.pipe-count, .pipe-label, .pipe-reached', KF.fadeUpSm, { each: 25, delay: 150, duration: 500 }],
    ['.closed-chip', KF.slideLeft, { each: 90, delay: 400 }],
    ['.hm-col', KF.fadeUpSm, { each: 16, duration: 450, max: 40 }],
    ['.quest', KF.slideLeft, { each: 100, duration: 700 }],
    ['.quest-bar span, .ach-progress span, .xpb-bar span', KF.growX, { each: 70, delay: 250, duration: 1000 }],
    ['.mini-badge', [{ opacity: 0, transform: 'scale(0) rotate(-90deg)' }, { opacity: 1, transform: 'none' }], { each: 70, duration: 900, ease: 'spring' }],
    ['.stepper .step-dot', KF.pop, { each: 80, duration: 800, ease: 'back' }],
    ['.hero-meta > span', KF.slideLeft, { each: 70, delay: 250, duration: 700 }],
    ['.fu-row, .recent-item, tbody tr, .note-item, .tl-item, .ach, .xp-log li, .done-list li, .xp-breakdown li, .kv, .mini-stats > div, .contact-line, .board-card, .app-card, .setting-row', KF.fadeUpSm, { each: 40, duration: 550, max: 14 }],
    ['.cal-cell:not(.pad)', KF.popSm, { each: 9, duration: 420, max: 40 }],
    ['.chip-row .chip', KF.popSm, { each: 25, duration: 450, ease: 'back' }],
  ];

  function playSequences(scope, delay) {
    SEQUENCES.forEach(([sel, kf, opts]) => {
      const els = [...scope.querySelectorAll(sel)].filter((el) => el.closest(BLOCK_SEL) === scope);
      if (els.length) stagger(els, kf, { ...opts, delay: delay + (opts.delay || 0) });
    });
  }

  function revealBlock(el, delay = 0) {
    tween(el, KF.fadeUp, { duration: 850, delay, ease: 'out' });
    playSequences(el, delay + 140);
  }

  let observer = null;
  let failsafe = null;
  let triggers = [];

  function revealLater(blocks) {
    if (!blocks.length) return;
    blocks.forEach((b) => b.classList.add('pre-reveal'));
    const onEnter = (b, i) => { b.classList.remove('pre-reveal'); revealBlock(b, i * 85); };
    if (has('ScrollTrigger')) {
      triggers = triggers.concat(window.ScrollTrigger.batch(blocks, {
        start: 'top 94%',
        once: true,
        onEnter: (batch) => batch.forEach(onEnter),
      }));
    } else if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.filter((e) => e.isIntersecting).forEach((e, i) => { observer.unobserve(e.target); onEnter(e.target, i); });
      }, { threshold: 0.06 });
      blocks.forEach((b) => observer.observe(b));
    } else {
      blocks.forEach((b) => b.classList.remove('pre-reveal'));
    }
    // Never leave on-screen content hidden (e.g. if scroll events are throttled).
    failsafe = setTimeout(() => {
      document.querySelectorAll('.pre-reveal').forEach((b) => {
        if (b.getBoundingClientRect().top < window.innerHeight) b.classList.remove('pre-reveal');
      });
    }, 3000);
  }

  function resetReveals() {
    if (observer) { observer.disconnect(); observer = null; }
    triggers.forEach((t) => t && t.kill && t.kill());
    triggers = [];
    clearTimeout(failsafe);
    document.querySelectorAll('.pre-reveal').forEach((b) => b.classList.remove('pre-reveal'));
  }

  /** Scrubbed parallax: the hero drifts up and fades as you scroll past it. */
  function heroScrub(root) {
    const hero = root.querySelector('.hero-strip');
    if (!hero || !has('ScrollTrigger')) return;
    const t = gs().to(hero.querySelector('.hero-title'), {
      yPercent: -35, opacity: 0.15, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top+=90', end: 'bottom top', scrub: 0.6 },
    });
    triggers.push(t.scrollTrigger);
  }

  /** Intro timeline for a freshly rendered screen. */
  function pageEnter(root) {
    resetReveals();
    if (!ok()) return;
    splitWords(root.querySelector('h1'), { delay: 60 });
    root.querySelectorAll('.page-head .eyebrow, .player-card .eyebrow, .hero-strip .eyebrow').forEach((e, i) => scramble(e, { delay: i * 120 }));

    const blocks = [...root.querySelectorAll(BLOCK_SEL)].filter((el) => !el.parentElement.closest(BLOCK_SEL));
    const fold = window.innerHeight * 0.92;
    const above = [];
    const below = [];
    blocks.forEach((b) => (b.getBoundingClientRect().top < fold ? above : below).push(b));
    above.forEach((b, i) => revealBlock(b, 40 + i * 75));
    revealLater(below);
    heroScrub(root);
    if (has('ScrollTrigger')) window.ScrollTrigger.refresh();
  }

  /* ---------- FLIP ---------- */

  function capture(root) {
    const snap = { map: new Map(), state: null };
    if (!root || !ok()) return snap;
    const els = root.querySelectorAll('[data-flip]');
    if (has('Flip')) {
      els.forEach((el) => el.setAttribute('data-flip-id', el.dataset.flip));
      snap.state = window.Flip.getState(els);
    }
    els.forEach((el) => snap.map.set(el.dataset.flip, el.getBoundingClientRect()));
    return snap;
  }

  /** Animate keyed elements from their captured layout to the new one; new keys pop in. */
  function flip(root, before, { enterNew = true } = {}) {
    if (!root || !before || !ok()) return;
    const els = [...root.querySelectorAll('[data-flip]')];
    if (before.state && has('Flip')) {
      els.forEach((el) => el.setAttribute('data-flip-id', el.dataset.flip));
      const fresh = els.filter((el) => !before.map.has(el.dataset.flip));
      window.Flip.from(before.state, {
        targets: els.filter((el) => before.map.has(el.dataset.flip)),
        duration: 0.75, ease: 'expo.out', scale: true, simple: true, prune: true,
      });
      if (enterNew && before.map.size && fresh.length) {
        gs().from(fresh, { opacity: 0, scale: 0.85, duration: 0.6, ease: 'back.out(2)', stagger: 0.04, clearProps: 'opacity,transform' });
      }
      return;
    }
    let freshCount = 0;
    els.forEach((el) => {
      const prev = before.map.get(el.dataset.flip);
      if (!prev) {
        if (enterNew && before.map.size) tween(el, KF.popSm, { duration: 520, delay: Math.min(freshCount++, 10) * 40, ease: 'back' });
        return;
      }
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      tween(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 700, ease: 'out' });
    });
  }

  /* ---------- Bars & rings ---------- */

  const last = {};

  function bars(root, { fromZero = false } = {}) {
    root.querySelectorAll('[data-width]').forEach((el) => {
      const key = el.dataset.bar;
      const target = el.dataset.width;
      const from = fromZero ? '0%' : (key && last[key]) || target;
      el.style.width = target;
      if (key) last[key] = target;
      if (from !== target) tween(el, [{ width: from }, { width: target }], { duration: 1400, delay: fromZero ? 350 : 0, ease: fromZero ? 'out' : 'spring' });
    });
    root.querySelectorAll('[data-offset]').forEach((el) => {
      const key = el.dataset.bar;
      const target = Number(el.dataset.offset);
      const full = Number(el.getAttribute('stroke-dasharray')) || 0;
      const from = fromZero ? full : (key && last[key] !== undefined ? last[key] : target);
      el.style.strokeDashoffset = target;
      if (key) last[key] = target;
      if (from !== target) tween(el, [{ strokeDashoffset: from }, { strokeDashoffset: target }], { duration: 1600, delay: fromZero ? 300 : 0, ease: 'out' });
    });
  }

  /* ---------- Feedback ---------- */

  function flash(el) {
    tween(el, [{ boxShadow: '0 0 0 3px rgba(37, 99, 235, .6)' }, { boxShadow: '0 0 0 14px rgba(37, 99, 235, 0)' }], { duration: 1100, ease: 'out', fill: 'none' });
  }

  function pulse(el) {
    tween(el, [{ transform: 'scale(.55)' }, { transform: 'none' }], { duration: 1000, ease: 'elastic' });
  }

  /** XP orbs that arc from the action into the HUD chip (MotionPath curves with GSAP). */
  function orbs(fromEl, toEl, { count = 7, onArrive } = {}) {
    const layer = document.getElementById('fx-layer');
    const done = () => { if (onArrive) onArrive(); };
    if (!ok() || !layer || !fromEl || !toEl || fromEl === toEl || !fromEl.isConnected) { done(); return; }
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    if (!a.width && !a.height) { done(); return; }
    const sx = a.left + a.width / 2;
    const sy = a.top + a.height / 2;
    const dx = b.left + 22 - sx;
    const dy = b.top + b.height / 2 - sy;
    let arrived = 0;
    const land = (orb) => { orb.remove(); arrived += 1; if (arrived === count) done(); };

    for (let i = 0; i < count; i += 1) {
      const orb = document.createElement('span');
      orb.className = 'fx-orb';
      orb.style.left = `${sx}px`;
      orb.style.top = `${sy}px`;
      layer.appendChild(orb);
      const spreadX = (Math.random() - 0.5) * 160;
      const lift = 70 + Math.random() * 110;
      if (has('MotionPathPlugin')) {
        gs().set(orb, { xPercent: -50, yPercent: -50, scale: 0.2, opacity: 0 });
        gs().to(orb, {
          motionPath: { path: [{ x: 0, y: 0 }, { x: spreadX, y: -lift }, { x: dx * 0.7, y: dy - 30 }, { x: dx, y: dy }], curviness: 1.4 },
          scale: 0.55, opacity: 1, duration: 0.95 + i * 0.07, delay: i * 0.05, ease: 'power2.inOut',
          onComplete: () => land(orb),
        });
        gs().to(orb, { scale: 1.1, duration: 0.25, delay: i * 0.05, ease: 'back.out(3)' });
      } else if (orb.animate) {
        const anim = orb.animate([
          { transform: 'translate(-50%, -50%) scale(.2)', opacity: 0 },
          { transform: `translate(calc(-50% + ${spreadX}px), calc(-50% - ${lift}px)) scale(1)`, opacity: 1, offset: 0.35 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: 0.9 },
        ], { duration: 850 + i * 70, delay: i * 45, easing: EASE.inOut, fill: 'both' });
        anim.onfinish = () => land(orb);
      } else land(orb);
    }
  }

  function toastIn(el) {
    tween(el, [{ opacity: 0, transform: 'translateX(80px) scale(.9) rotate(2deg)' }, { opacity: 1, transform: 'none' }], { duration: 800, ease: 'spring' });
  }

  function toastOut(el, done) {
    if (!ok()) { done(); return; }
    if (gs()) { gs().to(el, { x: 80, opacity: 0, scale: 0.95, duration: 0.28, ease: 'power3.in', onComplete: done }); return; }
    const anim = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(70px) scale(.95)' }], { duration: 260, easing: EASE.in, fill: 'forwards' });
    anim.onfinish = done;
  }

  function modalIn(modal) {
    if (!ok()) return;
    tween(modal.querySelector('.modal-dialog'), [{ opacity: 0, transform: 'translateY(40px) scale(.93) rotateX(8deg)' }, { opacity: 1, transform: 'none' }], { duration: 750, ease: 'spring' });
    stagger(modal.querySelectorAll('.form-section, .pal-item'), KF.fadeUpSm, { each: 55, delay: 120, duration: 520, max: 10 });
    const burst = modal.querySelector('.level-burst');
    if (burst) {
      tween(burst, [{ transform: 'scale(0) rotate(-200deg)' }, { transform: 'none' }], { duration: 1400, delay: 150, ease: 'elastic' });
      stagger(modal.querySelectorAll('.modal-body > :not(.level-burst)'), KF.fadeUpSm, { each: 90, delay: 450 });
    }
    const icon = modal.querySelector('.confirm-icon');
    if (icon) tween(icon, [{ transform: 'scale(0) rotate(-45deg)' }, { transform: 'none' }], { duration: 1000, delay: 100, ease: 'elastic' });
  }

  /* ---------- Pointer micro-interactions ---------- */

  function bindPointer() {
    let mag = null;
    let tilt = null;
    const release = (el, kind) => {
      if (!el) return;
      if (kind === 'mag') el.style.translate = '';
      else { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); }
    };
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !ok()) return;
      const target = e.target instanceof Element ? e.target : null;
      const m = target && target.closest('[data-magnetic]');
      if (m !== mag) { release(mag, 'mag'); mag = m; }
      if (m) {
        const r = m.getBoundingClientRect();
        m.style.translate = `${((e.clientX - (r.left + r.width / 2)) * 0.3).toFixed(1)}px ${((e.clientY - (r.top + r.height / 2)) * 0.4).toFixed(1)}px`;
      }
      const t = target && target.closest('[data-tilt]');
      if (t !== tilt) { release(tilt, 'tilt'); tilt = t; }
      if (t) {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 10).toFixed(2)}deg`);
        t.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(2)}deg`);
      }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { release(mag, 'mag'); release(tilt, 'tilt'); mag = null; tilt = null; });
  }

  /* ---------- Scroll progress ---------- */

  function bindScroll() {
    const bar = document.getElementById('scroll-progress');
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- Sliding nav indicator ---------- */

  function navInk(instant = false) {
    const ink = document.getElementById('nav-ink');
    const wrap = document.getElementById('mainNav');
    const active = wrap && wrap.querySelector('.nav-link.active');
    if (!ink || !wrap) return;
    if (!active || window.innerWidth < 1200) { ink.style.opacity = '0'; return; }
    const w = wrap.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    const x = r.left - w.left + 12;
    const width = r.width - 24;
    ink.style.opacity = '1';
    if (gs() && ok() && !instant) {
      gs().to(ink, { x, width, duration: 0.7, ease: 'elastic.out(1, 0.55)', overwrite: true });
    } else if (gs()) {
      gs().set(ink, { x, width });
    } else {
      ink.style.width = `${width}px`;
      ink.style.transform = `translateX(${x}px)`;
    }
  }

  function init() {
    gs();
    bindPointer();
    bindScroll();
    window.addEventListener('resize', () => navInk(true));
  }

  JT.motion = {
    EASE, GEASE, KF, gs, has, tween, stagger, splitWords, scramble, pageEnter, revealBlock, resetReveals,
    capture, flip, bars, flash, pulse, orbs, toastIn, toastOut, modalIn, navInk, init,
  };
})(globalThis.JT = globalThis.JT || {});
