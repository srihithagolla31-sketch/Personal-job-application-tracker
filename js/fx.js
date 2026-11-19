/**
 * fx.js — game feel: floating XP, count-ups, confetti, tiny synth sounds.
 * Everything respects prefers-reduced-motion and the in-app toggles.
 */
(function (JT) {
  'use strict';

  const cfg = { reduceMotion: false, sound: false };
  let audioCtx = null;

  const CONFETTI_COLORS = ['#3B82F6', '#E2A93B', '#34A86F', '#2EA7B8', '#E5574F', '#E7ECF2'];

  function configure(next) { Object.assign(cfg, next); }

  function motionOK() {
    const sys = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !cfg.reduceMotion && !sys;
  }

  function countUp(el, to, duration = 700) {
    const target = Number(to) || 0;
    const suffix = el.dataset.suffix || '';
    if (!motionOK() || target === 0) { el.textContent = `${target}${suffix}`; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = `${Math.round(target * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function floatText(text, anchor, tone = 'xp') {
    const layer = document.getElementById('fx-layer');
    if (!layer) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    if (anchor && anchor.getBoundingClientRect) {
      const r = anchor.getBoundingClientRect();
      if (r.width || r.height) { x = r.left + r.width / 2; y = r.top; }
    }
    const el = document.createElement('div');
    el.className = `fx-float fx-${tone}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layer.appendChild(el);
    if (!motionOK()) el.classList.add('fx-static');
    setTimeout(() => el.remove(), 1400);
  }

  function confetti({ count = 140, duration = 2600 } = {}) {
    if (!motionOK()) return;
    const canvas = document.getElementById('fx-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = window.innerWidth;
    const parts = Array.from({ length: count }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 13 - 4,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
      shape: Math.random() > 0.5 ? 'rect' : 'sq',
    }));
    const start = performance.now();
    canvas.classList.add('active');
    const frame = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, window.innerHeight);
      parts.forEach((p) => {
        p.vy += 0.38;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else ctx.fillRect(-p.size / 3, -p.size / 3, (p.size * 2) / 3, (p.size * 2) / 3);
        ctx.restore();
      });
      if (elapsed < duration) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, w, window.innerHeight); canvas.classList.remove('active'); ctx.setTransform(1, 0, 0, 1, 0, 0); }
    };
    requestAnimationFrame(frame);
  }

  const SOUNDS = {
    xp: [[880, 0.06], [1320, 0.08]],
    level: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.22]],
    achieve: [[784, 0.09], [988, 0.09], [1319, 0.2]],
    error: [[220, 0.09], [165, 0.14]],
    tick: [[1400, 0.03]],
    offer: [[659, 0.1], [784, 0.1], [988, 0.1], [1319, 0.1], [1568, 0.25]],
  };

  function sound(name) {
    if (!cfg.sound || !SOUNDS[name]) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      let t = audioCtx.currentTime;
      SOUNDS[name].forEach(([freq, dur]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.045, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur * 0.9;
      });
    } catch (_) { /* audio not available */ }
  }

  function shake(el) {
    if (!el || !motionOK()) return;
    el.classList.remove('fx-shake');
    void el.offsetWidth; // restart animation
    el.classList.add('fx-shake');
  }

  JT.fx = { configure, motionOK, countUp, floatText, confetti, sound, shake };
})(globalThis.JT = globalThis.JT || {});
