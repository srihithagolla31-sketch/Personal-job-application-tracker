/**
 * logo.js — the animated JobTrack mark.
 *
 * The mark tells the product story: a progress line climbs through three
 * stage checkpoints (applied → assessment → interview) and lands on a gold
 * star (the offer). Animations use the native Web Animations API + SVG SMIL:
 *
 *   intro()   badge springs in → line draws → nodes pop in sync → star spins
 *             in with a shockwave → wordmark letters rise
 *   comet()   a spark travels the path and makes the star twinkle (idle + hover)
 *   hop()     wordmark letters do a little wave (hover)
 */
(function (JT) {
  'use strict';

  const ok = () => JT.fx.motionOK();
  const T = (...a) => JT.motion.tween(...a);
  const PATH = 'M9 28 L16.5 20.5 L23 24 L29.5 14';
  const STAR = 'M0 -5.6 L1.44 -1.98 L5.33 -1.73 L2.33 0.76 L3.29 4.53 L0 2.45 L-3.29 4.53 L-2.33 0.76 L-5.33 -1.73 L-1.44 -1.98Z';

  /** Inline SVG markup for the mark (also used in index.html). */
  function svg(size = 34) {
    return `<svg class="logo-svg" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true" focusable="false">
      <rect class="lg-badge" x="1" y="1" width="38" height="38" rx="11"/>
      <path class="lg-base" pathLength="1" d="M7.5 32.5 H32.5"/>
      <path class="lg-path" pathLength="1" d="${PATH}"/>
      <circle class="lg-node" cx="9" cy="28" r="2.7"/>
      <circle class="lg-node" cx="16.5" cy="20.5" r="2.7"/>
      <circle class="lg-node" cx="23" cy="24" r="2.7"/>
      <circle class="lg-ring" cx="29.5" cy="12" r="5"/>
      <g transform="translate(29.5 12)"><path class="lg-star" d="${STAR}"/></g>
      <circle class="lg-comet" r="1.9" cx="0" cy="0"><animateMotion dur="1s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".65 0 .35 1" path="${PATH}"/></circle>
    </svg>`;
  }

  function burst(root, delay = 0) {
    T(root.querySelector('.lg-ring'), [
      { opacity: 0.95, transform: 'scale(.3)', strokeWidth: '2.5px' },
      { opacity: 0, transform: 'scale(2.3)', strokeWidth: '0.2px' },
    ], { duration: 750, delay, ease: 'out', fill: 'none' });
  }

  function twinkle(root, delay = 0) {
    T(root.querySelector('.lg-star'), [
      { transform: 'none' }, { transform: 'scale(1.45) rotate(72deg)', offset: 0.35 }, { transform: 'rotate(72deg)' },
    ], { duration: 700, delay, ease: 'out', fill: 'none' });
    burst(root, delay);
  }

  /** Full entrance timeline. Returns its length in ms (0 if skipped). */
  function intro(root, { delay = 0, wordmark = null } = {}) {
    if (!root || !ok()) return 0;
    const d = delay;
    T(root.querySelector('.lg-badge'), [{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'none' }], { duration: 1000, delay: d, ease: 'elastic' });
    T(root.querySelector('.lg-base'), [{ strokeDashoffset: '1.2px' }, { strokeDashoffset: '0px' }], { duration: 500, delay: d + 200, ease: 'out' });
    T(root.querySelector('.lg-path'), [{ strokeDashoffset: '1.2px' }, { strokeDashoffset: '0px' }], { duration: 750, delay: d + 300, ease: 'inOut' });
    root.querySelectorAll('.lg-node').forEach((n, i) => {
      T(n, [{ transform: 'scale(0)' }, { transform: 'none' }], { duration: 800, delay: d + 300 + i * 230, ease: 'elastic' });
    });
    T(root.querySelector('.lg-star'), [
      { transform: 'scale(0) rotate(-220deg)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ], { duration: 1100, delay: d + 980, ease: 'elastic' });
    burst(root, d + 1050);
    if (wordmark) hop(wordmark, { delay: d + 250, entrance: true });
    return d + 1800;
  }

  function comet(root) {
    if (!root || !ok()) return;
    const c = root.querySelector('.lg-comet');
    const gsap = JT.motion.gs();
    if (c && gsap && window.MotionPathPlugin) {
      const path = root.querySelector('.lg-path');
      gsap.timeline()
        .set(c, { opacity: 0 })
        .to(c, { motionPath: { path, align: path, alignOrigin: [0.5, 0.5] }, duration: 1, ease: 'power2.inOut' })
        .to(c, { keyframes: { '0%': { opacity: 0 }, '12%': { opacity: 1 }, '82%': { opacity: 1 }, '100%': { opacity: 0 } }, duration: 1, ease: 'none' }, 0);
      root.querySelectorAll('.lg-node').forEach((n, i) => {
        T(n, [{ transform: 'none' }, { transform: 'scale(1.6)', offset: 0.4 }, { transform: 'none' }], { duration: 420, delay: 80 + i * 240, ease: 'out', fill: 'none' });
      });
      twinkle(root, 900);
      return;
    }
    const motion = c && c.querySelector('animateMotion');
    if (!motion || typeof motion.beginElement !== 'function') { twinkle(root); return; }
    try { motion.beginElement(); } catch (_) { return; }
    T(c, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], { duration: 1000, ease: 'linear', fill: 'none' });
    root.querySelectorAll('.lg-node').forEach((n, i) => {
      T(n, [{ transform: 'none' }, { transform: 'scale(1.5)', offset: 0.4 }, { transform: 'none' }], { duration: 420, delay: 80 + i * 240, ease: 'out', fill: 'none' });
    });
    twinkle(root, 900);
  }

  function hop(wordmark, { delay = 0, entrance = false } = {}) {
    if (!wordmark || !ok()) return;
    const letters = wordmark.querySelectorAll('.wm-l');
    if (entrance) {
      JT.motion.stagger(letters, [{ opacity: 0, transform: 'translateY(110%) rotate(8deg)' }, { opacity: 1, transform: 'none' }], { each: 45, delay, duration: 700, ease: 'spring' });
    } else {
      JT.motion.stagger(letters, [{ transform: 'none' }, { transform: 'translateY(-7px)', offset: 0.35 }, { transform: 'none' }], { each: 40, delay, duration: 520, ease: 'out', fill: 'none' });
    }
  }

  /** Wraps each wordmark letter so it can be animated individually. */
  function splitWordmark(el) {
    if (!el || el.dataset.split) return;
    el.dataset.split = '1';
    el.setAttribute('aria-label', el.textContent.trim());
    el.querySelectorAll('[data-wm]').forEach((part) => {
      part.innerHTML = [...part.textContent].map((ch) => `<span class="wm-l">${JT.utils.escapeHtml(ch)}</span>`).join('');
      part.setAttribute('aria-hidden', 'true');
    });
  }

  function init() {
    const brand = document.querySelector('.brand');
    const mark = brand && brand.querySelector('.logo-svg');
    const wordmark = brand && brand.querySelector('.wordmark');
    splitWordmark(wordmark);
    splitWordmark(document.querySelector('.boot .wordmark'));

    let busy = 0;
    if (brand) {
      brand.addEventListener('mouseenter', () => {
        const now = Date.now();
        if (now - busy < 1300) return;
        busy = now;
        comet(mark);
        hop(wordmark, { delay: 60 });
      });
    }
    // Idle heartbeat: a spark runs the path every so often while the tab is visible.
    setInterval(() => { if (!document.hidden && Date.now() - busy > 4000) comet(mark); }, 9000);
    return { mark, wordmark };
  }

  JT.logo = { svg, intro, comet, hop, twinkle, init };
})(globalThis.JT = globalThis.JT || {});
