/**
 * Unit tests for the authentication layer: field validation, redirect safety,
 * the provider-agnostic service and the local preview adapter.
 * Run with:  npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');

['utils', 'auth/auth-validation', 'auth/auth-service', 'auth/preview-adapter'].forEach((m) => require(`../js/${m}.js`));
const JT = globalThis.JT;
const AV = JT.authValidation;

function memoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

function makeAdapter() {
  const local = memoryStore();
  const session = memoryStore();
  const adapter = JT.createPreviewAdapter({ local, session, cryptoImpl: webcrypto });
  return { adapter, local, session };
}

const GOOD = { name: 'Asha Rao', email: 'Asha@Example.com', password: 'secret123', confirm: 'secret123' };

/* ---------- Validation ---------- */

test('sign-up validation accepts a complete, valid form', () => {
  assert.deepEqual(AV.validateSignUp(GOOD), {});
});

test('sign-up validation reports each problem on its own field', () => {
  const errors = AV.validateSignUp({ name: ' ', email: 'not-an-email', password: 'short1', confirm: 'different' });
  assert.equal(errors.name, AV.MESSAGES.nameRequired);
  assert.equal(errors.email, AV.MESSAGES.emailInvalid);
  assert.equal(errors.password, AV.MESSAGES.passwordShort);
  assert.equal(errors.confirm, AV.MESSAGES.confirmMismatch);
});

test('passwords need a letter and a number', () => {
  assert.equal(AV.checkNewPassword('abcdefgh'), AV.MESSAGES.passwordWeak);
  assert.equal(AV.checkNewPassword('12345678'), AV.MESSAGES.passwordWeak);
  assert.equal(AV.checkNewPassword('abcd1234'), '');
});

test('sign-in only requires a valid email and a non-empty password', () => {
  assert.deepEqual(AV.validateSignIn({ email: 'a@b.co', password: 'x' }), {});
  assert.deepEqual(Object.keys(AV.validateSignIn({ email: '', password: '' })).sort(), ['email', 'password']);
});

test('reset validation checks the email', () => {
  assert.deepEqual(AV.validateReset({ email: 'a@b.co' }), {});
  assert.equal(AV.validateReset({ email: 'a@b' }).email, AV.MESSAGES.emailInvalid);
});

test('user-facing auth messages contain no em dashes', () => {
  Object.values(AV.MESSAGES).forEach((m) => assert.ok(!m.includes('—'), m));
  Object.values(JT.auth.FALLBACK_MESSAGES).forEach((m) => assert.ok(!m.includes('—'), m));
});

test('post-login redirect only allows in-app routes', () => {
  assert.equal(AV.safeNext('#/applications'), '#/applications');
  assert.equal(AV.safeNext('#/app/APP-1001'), '#/app/APP-1001');
  assert.equal(AV.safeNext('https://evil.example'), '#/dashboard');
  assert.equal(AV.safeNext('//evil.example'), '#/dashboard');
  assert.equal(AV.safeNext('#/login'), '#/dashboard');
  assert.equal(AV.safeNext('javascript:alert(1)'), '#/dashboard');
  assert.equal(AV.safeNext(''), '#/dashboard');
});

/* ---------- Preview adapter ---------- */

test('preview: sign up creates a session and never stores the plain password', async () => {
  const { adapter, local } = makeAdapter();
  const res = await adapter.signUp(GOOD);
  assert.equal(res.ok, true);
  assert.equal(res.session.user.email, 'asha@example.com');
  assert.equal(res.session.user.name, 'Asha Rao');
  const raw = JSON.stringify(local.dump());
  assert.ok(!raw.includes(GOOD.password), 'password must not be stored');
  assert.deepEqual(await adapter.init(), res.session);
});

test('preview: duplicate emails are rejected case-insensitively', async () => {
  const { adapter } = makeAdapter();
  await adapter.signUp(GOOD);
  const again = await adapter.signUp({ ...GOOD, email: 'asha@EXAMPLE.com' });
  assert.equal(again.ok, false);
  assert.equal(again.error.code, 'email-in-use');
});

test('preview: sign in checks the password and uses one generic error', async () => {
  const { adapter } = makeAdapter();
  await adapter.signUp(GOOD);
  await adapter.signOut();
  assert.equal(await adapter.init(), null);

  const wrong = await adapter.signIn({ email: GOOD.email, password: 'wrongpass1' });
  const unknown = await adapter.signIn({ email: 'nobody@example.com', password: 'whatever1' });
  assert.equal(wrong.error.code, 'invalid-credentials');
  assert.equal(unknown.error.code, 'invalid-credentials');

  const ok = await adapter.signIn({ email: ' ASHA@example.com ', password: GOOD.password });
  assert.equal(ok.ok, true);
  assert.equal(ok.session.user.name, 'Asha Rao');
});

test('preview: "keep me signed in" off keeps the session out of localStorage', async () => {
  const { adapter, local, session } = makeAdapter();
  await adapter.signUp(GOOD);
  await adapter.signOut();
  await adapter.signIn({ email: GOOD.email, password: GOOD.password, remember: false });
  assert.equal(local.getItem(JT.PREVIEW_AUTH_KEYS.session), null);
  assert.ok(session.getItem(JT.PREVIEW_AUTH_KEYS.session));
});

test('preview: password reset reports that no email was delivered', async () => {
  const { adapter } = makeAdapter();
  assert.deepEqual(await adapter.requestPasswordReset({ email: GOOD.email }), { ok: true, delivered: false });
});

test('preview: weak passwords are refused even if the UI is bypassed', async () => {
  const { adapter } = makeAdapter();
  const res = await adapter.signUp({ ...GOOD, password: 'password' });
  assert.equal(res.error.code, 'weak-password');
});

test('preview: reports unavailable when Web Crypto is missing instead of skipping checks', async () => {
  const adapter = JT.createPreviewAdapter({ local: memoryStore(), session: memoryStore(), cryptoImpl: {} });
  const res = await adapter.signIn({ email: GOOD.email, password: GOOD.password });
  assert.equal(res.error.code, 'unavailable');
});

/* ---------- Service ---------- */

test('service: tracks the session and notifies listeners', async () => {
  const { adapter } = makeAdapter();
  JT.auth.use(adapter);
  assert.equal(await JT.auth.init(), null);
  const seen = [];
  const off = JT.auth.onChange((s) => seen.push(s ? s.user.email : null));
  await JT.auth.signUp(GOOD);
  assert.equal(JT.auth.isSignedIn(), true);
  await JT.auth.signOut();
  assert.equal(JT.auth.isSignedIn(), false);
  assert.deepEqual(seen, ['asha@example.com', null]);
  assert.equal(JT.auth.isProduction(), false);
  off();
});

test('service: adapter exceptions become a safe error result', async () => {
  JT.auth.use({ id: 'broken', init: async () => null, signIn: async () => { throw new Error('boom'); } });
  await JT.auth.init();
  const res = await JT.auth.signIn({ email: 'a@b.co', password: 'x' });
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'unknown');
  assert.equal(JT.auth.isSignedIn(), false);
  const missing = await JT.auth.requestPasswordReset({ email: 'a@b.co' });
  assert.equal(missing.error.code, 'unavailable');
});
