/**
 * fx.js: optional sound cues and small feedback helpers.
 * Sounds are off by default; everything respects prefers-reduced-motion.
 */
(function (JT) {
  'use strict';

  const cfg = { reduceMotion: false, sound: false };
  let audioCtx = null;

  function configure(next) { Object.assign(cfg, next); }

  function motionOK() {
    const sys = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !cfg.reduceMotion && !sys;
  }

  /** Numbers are shown directly; animated count-ups were removed. */
  function countUp(el, to) {
    el.textContent = `${Number(to) || 0}${el.dataset.suffix || ''}`;
  }

  /** Floating "+XP" chips and confetti were removed; XP feedback now lives in toasts and the level chip. */
  function floatText() {}
  function confetti() {}

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
        osc.type = 'sine';
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
