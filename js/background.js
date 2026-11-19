/**
 * background.js — the "Cosmos" scene: a real-time 3D particle sculpture in a
 * starfield, rendered on a 2D canvas with additive blending (no WebGL needed).
 *
 *   • ~5,000 particles (gold / warm white / ice blue) form a sculpture that
 *     slowly rotates and shimmers. Each screen has its own shape, and GSAP
 *     morphs the particles between them:
 *       dashboard → rocket · applications → briefcase · trophies → trophy
 *       everything else → ringed planet
 *   • The sculpture tilts toward the cursor and particles part around it;
 *     clicks burst it; XP gains sparkle; level-ups explode and re-form it.
 *   • A parallax starfield drifts with scroll and the mouse, with the odd
 *     shooting star.
 *
 * Pauses in background tabs; draws one still frame for reduced motion.
 */
(function (JT) {
  'use strict';

  const PALETTE = ['#f2b544', '#e08f2e', '#fff4dc', '#8cc4ff', '#4f8fff', '#d6e8ff'];
  const GOLD = 0; const AMBER = 1; const WHITE = 2; const ICE = 3; const BLUE = 4; const PALE = 5;
  const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  /* ---------- Shape generators: return n points [x, y, z, colour] in ~[-1.6, 1.6] ---------- */

  function rotZ(p, a) { const c = Math.cos(a); const s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2], p[3]]; }

  function rocket(n) {
    const pts = [];
    const profile = (x) => {
      if (x < -0.9 || x > 1.05) return 0;
      const body = 0.34 * Math.sqrt(Math.max(0, 1 - ((x + 0.05) / 1.1) ** 2));
      return x > 0.35 ? body * Math.max(0, 1 - (x - 0.35) / 0.72) ** 0.55 : body;
    };
    while (pts.length < n) {
      const roll = Math.random();
      if (roll < 0.62) { // hull
        const x = rnd(-0.9, 1.05);
        const r = profile(x) * (Math.random() < 0.8 ? 1 : Math.sqrt(Math.random()));
        const th = rnd(0, Math.PI * 2);
        const y = Math.cos(th) * r;
        const z = Math.sin(th) * r;
        const lit = Math.cos(th - 0.9) > 0.55;
        pts.push([x, y, z, lit ? (Math.random() < 0.6 ? WHITE : GOLD) : (Math.random() < 0.7 ? GOLD : AMBER)]);
      } else if (roll < 0.72) { // porthole
        const a = rnd(0, Math.PI * 2);
        const rr = 0.15 * Math.sqrt(Math.random());
        const rim = rr > 0.11;
        pts.push([0.18 + Math.cos(a) * rr, Math.sin(a) * rr, profile(0.18) * 0.98, rim ? ICE : Math.random() < 0.5 ? WHITE : PALE]);
      } else if (roll < 0.86) { // fins
        const k = (Math.random() * 3) | 0;
        const ang = (k / 3) * Math.PI * 2 + 0.5;
        const u = Math.random(); const v = Math.random() * (1 - u);
        const x = -0.88 + u * 0.55 - v * 0.15;
        const radial = profile(Math.max(-0.88, x)) + v * 0.5;
        pts.push([x, Math.cos(ang) * radial, Math.sin(ang) * radial, Math.random() < 0.7 ? BLUE : ICE]);
      } else { // exhaust plume
        const t = Math.random();
        const x = -0.95 - t * 0.85;
        const spread = 0.1 + t * 0.22;
        const a = rnd(0, Math.PI * 2);
        const rr = spread * Math.sqrt(Math.random());
        pts.push([x, Math.cos(a) * rr, Math.sin(a) * rr, t < 0.35 ? WHITE : Math.random() < 0.6 ? GOLD : AMBER]);
      }
    }
    return pts.map((p) => rotZ([p[0] * 1.15, p[1] * 1.15, p[2] * 1.15, p[3]], 0.62));
  }

  function briefcase(n) {
    const pts = [];
    const W = 1.05; const H = 0.7; const D = 0.32;
    while (pts.length < n) {
      const roll = Math.random();
      if (roll < 0.78) {
        const face = (Math.random() * 6) | 0;
        let x = rnd(-W, W); let y = rnd(-H, H); let z = rnd(-D, D);
        if (face === 0) x = -W; else if (face === 1) x = W; else if (face === 2) y = -H; else if (face === 3) y = H; else if (face === 4) z = -D; else z = D;
        const seam = Math.abs(y - 0.18) < 0.03;
        pts.push([x, y, z, seam ? GOLD : face === 5 ? (Math.random() < 0.35 ? PALE : ICE) : Math.random() < 0.6 ? BLUE : ICE]);
      } else if (roll < 0.92) { // handle
        const a = rnd(0, Math.PI);
        const tube = rnd(0, Math.PI * 2);
        const R = 0.32; const r = 0.05;
        pts.push([Math.cos(a) * (R + r * Math.cos(tube)), H + Math.sin(a) * (R + r * Math.cos(tube)) * 0.75, r * Math.sin(tube), GOLD]);
      } else { // clasps
        const side = Math.random() < 0.5 ? -0.5 : 0.5;
        pts.push([side + rnd(-0.08, 0.08), 0.18 + rnd(-0.07, 0.07), D + 0.01, Math.random() < 0.5 ? GOLD : WHITE]);
      }
    }
    return pts.map((p) => rotZ(p, -0.12));
  }

  function trophy(n) {
    const pts = [];
    while (pts.length < n) {
      const roll = Math.random();
      const th = rnd(0, Math.PI * 2);
      if (roll < 0.55) { // cup
        const t = Math.random();
        const y = -0.1 + t * 1.0;
        const r = 0.12 + 0.48 * Math.sqrt(t);
        const lit = Math.cos(th - 0.8) > 0.5;
        pts.push([Math.cos(th) * r, y, Math.sin(th) * r, lit ? WHITE : Math.random() < 0.7 ? GOLD : AMBER]);
      } else if (roll < 0.68) { // handles
        const side = Math.random() < 0.5 ? -1 : 1;
        const a = rnd(-Math.PI / 2, Math.PI / 2);
        pts.push([side * (0.6 + Math.cos(a) * 0.22), 0.55 + Math.sin(a) * 0.22, rnd(-0.03, 0.03), GOLD]);
      } else if (roll < 0.78) { // stem
        const r = 0.08;
        pts.push([Math.cos(th) * r, rnd(-0.55, -0.1), Math.sin(th) * r, AMBER]);
      } else if (roll < 0.92) { // base
        const r = 0.42 * Math.sqrt(Math.random());
        pts.push([Math.cos(th) * r, rnd(-0.72, -0.55), Math.sin(th) * r, Math.random() < 0.6 ? ICE : BLUE]);
      } else { // star burst above
        const a = rnd(0, Math.PI * 2);
        const rr = rnd(0.05, 0.25);
        pts.push([Math.cos(a) * rr * 0.6, 1.25 + Math.sin(a) * rr, rnd(-0.05, 0.05), Math.random() < 0.6 ? WHITE : GOLD]);
      }
    }
    return pts.map((p) => [p[0] * 1.25, p[1] * 1.25, p[2] * 1.25, p[3]]);
  }

  function planet(n) {
    const pts = [];
    while (pts.length < n) {
      if (Math.random() < 0.6) { // sphere
        const u = rnd(-1, 1);
        const th = rnd(0, Math.PI * 2);
        const s = Math.sqrt(1 - u * u);
        const band = Math.abs(u) < 0.12 || Math.abs(u - 0.45) < 0.05;
        const lit = s * Math.cos(th - 0.7) > 0.35;
        pts.push([s * Math.cos(th) * 0.7, u * 0.7, s * Math.sin(th) * 0.7, band ? GOLD : lit ? PALE : Math.random() < 0.6 ? BLUE : ICE]);
      } else { // ring
        const a = rnd(0, Math.PI * 2);
        const r = rnd(0.95, 1.5);
        pts.push([Math.cos(a) * r, rnd(-0.015, 0.015), Math.sin(a) * r, r < 1.15 ? WHITE : Math.random() < 0.6 ? GOLD : AMBER]);
      }
    }
    // tilt the ring plane
    return pts.map((p) => { const c = Math.cos(0.42); const s = Math.sin(0.42); return rotZ([p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c, p[3]], 0.25); });
  }

  const SHAPES = { rocket, briefcase, trophy, planet };
  const ROUTE_SHAPE = { dashboard: 'rocket', applications: 'briefcase', app: 'briefcase', trophies: 'trophy' };

  /* ---------- State ---------- */

  const S = {
    canvas: null, ctx: null, w: 0, h: 0, dpr: 1, n: 0, enabled: true, running: false, raf: 0, last: 0, t: 0,
    from: null, to: null, colFrom: null, colTo: null, delay: null, dir: null, seed: null,
    px: null, py: null, ps: null, pc: null,
    morph: { p: 1 }, burst: { v: 0 }, shape: '',
    yaw: 0, pitch: 0, yawT: 0, pitchT: 0,
    anchor: { x: 0.72, y: 0.42, scale: 1, alpha: 1 },
    pointer: { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false },
    stars: [], shooting: null, nextShoot: 4,
  };

  const motionOK = () => JT.fx.motionOK();
  const gs = () => (JT.motion && JT.motion.gs()) || null;

  function alloc(n) {
    S.n = n;
    S.from = new Float32Array(n * 3);
    S.to = new Float32Array(n * 3);
    S.colFrom = new Uint8Array(n);
    S.colTo = new Uint8Array(n);
    S.delay = new Float32Array(n);
    S.dir = new Float32Array(n * 3);
    S.seed = new Float32Array(n);
    S.px = new Float32Array(n);
    S.py = new Float32Array(n);
    S.ps = new Float32Array(n);
    S.pc = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) {
      S.delay[i] = Math.random() * 0.35;
      const u = rnd(-1, 1); const th = rnd(0, Math.PI * 2); const s = Math.sqrt(1 - u * u);
      S.dir[i * 3] = s * Math.cos(th); S.dir[i * 3 + 1] = u; S.dir[i * 3 + 2] = s * Math.sin(th);
      S.seed[i] = Math.random() * 100;
    }
  }

  function writeShape(target, colTarget, name) {
    const pts = SHAPES[name](S.n);
    for (let i = 0; i < S.n; i += 1) {
      const p = pts[i];
      target[i * 3] = p[0]; target[i * 3 + 1] = p[1]; target[i * 3 + 2] = p[2];
      colTarget[i] = p[3];
    }
  }

  /** Current (mid-morph) unit-space position of particle i. */
  function blended(i, out) {
    const local = Math.min(1, Math.max(0, (S.morph.p - S.delay[i]) / 0.65));
    const e = local < 0.5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;
    const swirl = e * (1 - e) * 2.4;
    const b = S.burst.v;
    for (let k = 0; k < 3; k += 1) {
      out[k] = S.from[i * 3 + k] + (S.to[i * 3 + k] - S.from[i * 3 + k]) * e + S.dir[i * 3 + k] * (swirl + b);
    }
    return local;
  }

  function setScene(route, { instant = false } = {}) {
    const name = ROUTE_SHAPE[route] || 'planet';
    const narrow = S.w < 768;
    const hero = route === 'dashboard';
    const target = narrow
      ? { x: 0.5, y: hero ? 0.3 : 0.5, scale: hero ? 0.72 : 0.6, alpha: hero ? 0.75 : 0.4 }
      : { x: hero ? 0.72 : 0.8, y: hero ? 0.4 : 0.56, scale: hero ? 1 : 0.78, alpha: hero ? 1 : 0.5 };
    const g = gs();
    if (g && !instant && motionOK()) g.to(S.anchor, { ...target, duration: 1.6, ease: 'power3.inOut', overwrite: true });
    else Object.assign(S.anchor, target);

    if (name === S.shape || !S.n) return;
    // freeze the current blended positions as the new "from"
    const tmp = [0, 0, 0];
    for (let i = 0; i < S.n; i += 1) {
      const local = blended(i, tmp);
      S.from[i * 3] = tmp[0]; S.from[i * 3 + 1] = tmp[1]; S.from[i * 3 + 2] = tmp[2];
      S.colFrom[i] = local > 0.5 ? S.colTo[i] : S.colFrom[i];
    }
    S.burst.v = 0;
    writeShape(S.to, S.colTo, name);
    S.shape = name;
    if (g && !instant && motionOK()) {
      S.morph.p = 0;
      g.to(S.morph, { p: 1, duration: 2.1, ease: 'power2.inOut', overwrite: true });
    } else {
      S.morph.p = 1;
      if (!S.running) drawFrame(0);
    }
  }

  /* ---------- Stars ---------- */

  function makeStars() {
    const count = S.w < 768 ? 160 : 380;
    S.stars = Array.from({ length: count }, () => ({
      x: Math.random(), y: Math.random(), z: rnd(0.15, 1), tw: rnd(0, Math.PI * 2), sp: rnd(0.6, 2.2),
      c: Math.random() < 0.82 ? 2 : Math.random() < 0.5 ? 3 : 0,
    }));
  }

  function drawStars(dt) {
    const { ctx, w, h } = S;
    const scroll = window.scrollY;
    const mx = S.pointer.x > -9000 ? (S.pointer.x / w - 0.5) : 0;
    const my = S.pointer.y > -9000 ? (S.pointer.y / h - 0.5) : 0;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < S.stars.length; i += 1) {
      const st = S.stars[i];
      if (dt) st.y -= dt * 0.004 * st.z;
      let y = (st.y - scroll * 0.00025 * st.z) % 1;
      if (y < 0) y += 1;
      const x = st.x * w - mx * 30 * st.z;
      const yy = y * h - my * 20 * st.z;
      const a = 0.25 + 0.6 * st.z * (0.6 + 0.4 * Math.sin(S.t * st.sp + st.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE[st.c];
      const s = st.z > 0.85 ? 2 : 1.2;
      ctx.fillRect(x, yy, s, s);
    }
    // shooting star
    if (dt && motionOK()) {
      S.nextShoot -= dt;
      if (S.nextShoot <= 0 && !S.shooting) {
        S.shooting = { x: rnd(0.1, 0.8) * w, y: rnd(0.05, 0.4) * h, vx: rnd(500, 800), vy: rnd(160, 300), life: 0.9, age: 0 };
        S.nextShoot = rnd(5, 11);
      }
      const sh = S.shooting;
      if (sh) {
        sh.age += dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        const k = 1 - sh.age / sh.life;
        ctx.globalAlpha = Math.max(0, k);
        ctx.strokeStyle = PALETTE[WHITE];
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12); ctx.stroke();
        if (sh.age > sh.life) S.shooting = null;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Sculpture ---------- */

  function drawSculpture(dt) {
    const { ctx, w, h, n } = S;
    const A = S.anchor;
    const cx = A.x * w;
    const cy = A.y * h;
    const scale = Math.min(w, h) * 0.34 * A.scale;
    const cyw = Math.cos(S.yaw); const syw = Math.sin(S.yaw);
    const cpt = Math.cos(S.pitch); const spt = Math.sin(S.pitch);
    const D = 3.4;
    const p = S.pointer;
    const R = 120;
    const tmp = [0, 0, 0];
    for (let i = 0; i < n; i += 1) {
      const local = blended(i, tmp);
      const sh = 0.012 * Math.sin(S.t * 1.6 + S.seed[i]);
      let x = tmp[0] + sh; let y = tmp[1] + sh * 0.6; let z = tmp[2];
      // yaw (around y) then pitch (around x)
      const x1 = x * cyw + z * syw; const z1 = -x * syw + z * cyw;
      const y2 = y * cpt - z1 * spt; const z2 = y * spt + z1 * cpt;
      x = x1; y = y2; z = z2;
      const k = D / (D - z);
      let sx = cx + x * k * scale;
      let sy = cy - y * k * scale;
      if (p.active) {
        const dx = sx - p.x; const dy = sy - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1; const push = (1 - d / R) ** 2 * 46; sx += (dx / d) * push; sy += (dy / d) * push; }
      }
      S.px[i] = sx; S.py[i] = sy;
      S.ps[i] = Math.max(0.6, 1.55 * k * (0.75 + A.scale * 0.35));
      S.pc[i] = local > 0.5 ? S.colTo[i] : S.colFrom[i];
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.78 * A.alpha;
    for (let c = 0; c < PALETTE.length; c += 1) {
      ctx.fillStyle = PALETTE[c];
      for (let i = 0; i < n; i += 1) {
        if (S.pc[i] !== c) continue;
        const s = S.ps[i];
        ctx.fillRect(S.px[i] - s / 2, S.py[i] - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFrame(dt) {
    if (!S.ctx) return;
    S.ctx.clearRect(0, 0, S.w, S.h);
    drawStars(dt);
    drawSculpture(dt);
  }

  function step(now) {
    S.raf = requestAnimationFrame(step);
    const elapsed = now - S.last;
    if (elapsed < 15) return;
    const dt = Math.min(0.05, elapsed / 1000);
    S.last = now;
    S.t += dt;
    const p = S.pointer;
    p.x += (p.tx - p.x) * Math.min(1, dt * 10);
    p.y += (p.ty - p.y) * Math.min(1, dt * 10);
    S.yawT += dt * 0.16;
    const mx = p.tx > -9000 ? p.tx / S.w - 0.5 : 0;
    const my = p.ty > -9000 ? p.ty / S.h - 0.5 : 0;
    S.yaw += (S.yawT + mx * 0.9 - S.yaw) * Math.min(1, dt * 2.5);
    S.pitch += (my * 0.5 - S.pitch) * Math.min(1, dt * 2.5);
    drawFrame(dt);
  }

  function start() {
    if (S.running || !S.enabled || !motionOK() || document.hidden || !S.ctx) return;
    S.running = true;
    S.last = performance.now();
    S.raf = requestAnimationFrame(step);
  }

  function stop() { S.running = false; cancelAnimationFrame(S.raf); }

  function resize() {
    const c = S.canvas;
    S.w = window.innerWidth;
    S.h = window.innerHeight;
    S.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    c.width = Math.round(S.w * S.dpr);
    c.height = Math.round(S.h * S.dpr);
    c.style.width = `${S.w}px`;
    c.style.height = `${S.h}px`;
    S.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    makeStars();
    drawFrame(0);
  }

  /* ---------- Public API ---------- */

  function burst(amount, duration = 1.6) {
    if (!S.enabled || !motionOK()) return;
    const g = gs();
    if (g) g.fromTo(S.burst, { v: Math.max(S.burst.v, amount) }, { v: 0, duration, ease: 'elastic.out(1, 0.45)', overwrite: true });
  }

  /** A ripple at a screen point: bursts the sculpture if the point is near it. */
  function pulse(x, y, { amp = 0.2 } = {}) {
    const cx = S.anchor.x * S.w; const cy = S.anchor.y * S.h;
    const near = Math.hypot(x - cx, y - cy) < Math.min(S.w, S.h) * 0.45 * S.anchor.scale;
    burst(near ? amp * 1.4 : amp * 0.6, 1.4);
  }

  function pulseAt(el, opts) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    pulse(r.left + r.width / 2, r.top + r.height / 2, opts);
  }

  /** Level-ups and offers: explode and re-form. */
  function quake() { burst(1.1, 2.6); }

  function setEnabled(on) {
    S.enabled = Boolean(on);
    document.documentElement.classList.toggle('live-bg', S.enabled);
    if (S.enabled) { resize(); start(); } else { stop(); if (S.ctx) S.ctx.clearRect(0, 0, S.w, S.h); }
  }

  function refresh() {
    if (!S.enabled) return;
    if (motionOK()) start(); else { stop(); drawFrame(0); }
  }

  function init({ enabled = true } = {}) {
    S.canvas = document.getElementById('world-bg');
    if (!S.canvas || !S.canvas.getContext) return;
    S.ctx = S.canvas.getContext('2d');
    alloc(window.innerWidth < 768 ? 2400 : 5200);
    S.w = window.innerWidth; S.h = window.innerHeight;
    writeShape(S.from, S.colFrom, 'planet');
    writeShape(S.to, S.colTo, 'planet');
    S.shape = 'planet';
    window.addEventListener('resize', () => { if (S.enabled) resize(); });
    window.addEventListener('pointermove', (e) => {
      S.pointer.tx = e.clientX; S.pointer.ty = e.clientY; S.pointer.active = e.pointerType === 'mouse';
      if (S.pointer.x < -9000) { S.pointer.x = e.clientX; S.pointer.y = e.clientY; }
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { S.pointer.active = false; });
    window.addEventListener('pointerdown', (e) => pulse(e.clientX, e.clientY, { amp: 0.22 }), { passive: true });
    window.addEventListener('scroll', () => { if (!S.running && S.enabled) drawFrame(0); }, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    setEnabled(enabled);
  }

  JT.world = { init, setScene, pulse, pulseAt, quake, burst, setEnabled, refresh, start, stop, SHAPES };
})(globalThis.JT = globalThis.JT || {});
