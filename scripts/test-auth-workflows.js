import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { requiresSecondFactor } from '../server/api/_security.js';

const source = await readFile(new URL('../auth-workflows.js', import.meta.url), 'utf8');
class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; this.open = false; this.nodes = {}; }
  set innerHTML(_value) {
    const form = new Element('form');
    for (const selector of ['h2', '.auth-workflow-description', '.auth-workflow-fields', '[role="status"]', '[type="button"]', '[type="submit"]']) form.nodes[selector] = new Element(selector);
    this.nodes.form = form;
  }
  querySelector(selector) { return this.nodes[selector] || this.nodes.form?.querySelector(selector); }
  setAttribute(key, value) { this[key] = value; }
  append(value) { this.children.push(value); }
  replaceChildren() { this.children = []; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  async fire(type) { for (const callback of this.listeners[type] || []) await callback({ preventDefault() {} }); }
  showModal() { this.open = true; }
  close() { this.open = false; return this.fire('close'); }
  remove() {}
  reset() {}
  reportValidity() { return true; }
  focus() {}
}
let current, session = null, calls = [], feedback = '', enabled = false, requestError = null, release, policyPath;
const auth = {
  async resetPasswordForEmail(email, options) { calls.push(['reset', email, options]); if (release) await release; return { error: requestError }; },
  async resend(body) { calls.push(['resend', body]); return { error: requestError }; },
  async signInWithOAuth(body) { calls.push(['oauth', body]); return { error: null }; },
  async updateUser(body) { calls.push(['update', body]); return { error: requestError }; },
  async signOut() { calls.push(['signOut']); session = null; return { error: null }; },
  mfa: {
    async getAuthenticatorAssuranceLevel() { return { data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }; },
    async listFactors() { return { data: { totp: [{ id: 'verified-factor', status: 'verified' }] }, error: null }; },
    async challengeAndVerify(body) { calls.push(['challenge', body]); return { error: requestError }; }
  }
};
const context = vm.createContext({ window: {}, location: { search: '', hash: '', origin: 'https://travel-drip.com' }, URL, URLSearchParams, AbortSignal,
  document: { createElement: tag => new Element(tag), createTextNode: textContent => ({ textContent }), body: { append: node => { current = node; } } },
  DOMParser: class { parseFromString(text) { return { querySelector: () => ({ childNodes: [
    { nodeType: 1, tagName: 'H1', classList: { contains: () => false }, childNodes: [{ nodeType: 3, textContent: text }] },
    { nodeType: 1, tagName: 'SCRIPT', classList: { contains: () => false }, childNodes: [] }
  ] }) }; } },
  fetch: async path => { policyPath = String(path); return { ok: true, text: async () => 'Current policy document', json: async () => ({ external: { google: enabled } }) }; }
});
vm.runInContext(source, context);
let recovered = 0, mfaVerified = 0;
const flow = context.window.TravelDripAuthWorkflows.create({ getClient: () => ({ auth }), getSession: () => session,
  getConfig: () => ({ supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public-test-only' }), message: value => { feedback = value; },
  onRecoveryFinished: () => { recovered++; }, onMfaVerified: () => { mfaVerified++; }
});
const view = () => ({ form: current.querySelector('form'), status: current.querySelector('[role="status"]'), fields: current.querySelector('.auth-workflow-fields') });
flow.run('Forgot Password');
view().fields.children[0].children[0].value = ' QA@Example.com ';
let unblock;
release = new Promise(resolve => { unblock = resolve; });
const saving = view().form.fire('submit');
await view().form.fire('submit');
assert.equal(calls.length, 1, 'Repeated clicks cannot send duplicate email requests');
assert.equal(calls[0][1], 'qa@example.com');
assert.equal(calls[0][2].redirectTo, 'https://travel-drip.com/login?recovery=true');
assert.equal(view().status.textContent, 'Please wait…', 'No success before provider response');
unblock(); await saving; release = null;
assert.match(feedback, /If this email has an eligible account/);
requestError = new Error('Email service unavailable');
await view().form.fire('submit');
assert.equal(view().status.textContent, 'Email service unavailable');
flow.run('Verify Email');
view().fields.children[0].children[0].value = 'qa@example.com';
requestError = null;
await view().form.fire('submit');
assert.equal(calls.at(-1)[1].type, 'signup');
assert.equal(calls.at(-1)[1].options.emailRedirectTo, 'https://travel-drip.com/login?verified=true');
await flow.run('Terms of Service');
assert.equal(policyPath, '/terms.html');
assert.equal(view().fields.children[0].children.length, 1, 'Policy scripts are discarded');
assert.equal(view().fields.children[0].children[0].children[0].textContent, 'Current policy document');
await flow.run('Privacy Policy');
assert.equal(policyPath, '/privacy.html');
await flow.oauth('google');
assert.match(feedback, /not connected yet/);
assert.equal(calls.some(item => item[0] === 'oauth'), false, 'Disabled provider must not redirect away');
enabled = true;
await flow.oauth('google');
assert.equal(calls.at(-1)[1].options.redirectTo, 'https://travel-drip.com/login');
await flow.run('Two-Factor Authentication');
assert.match(feedback, /Sign in first/);
session = { user: { id: 'qa' } };
assert.equal(await flow.checkMfa(), true);
assert.equal(flow.isBlocked(), true);
view().fields.children[0].children[0].value = '000000';
requestError = new Error('Invalid authenticator code');
await view().form.fire('submit');
assert.equal(flow.isBlocked(), true);
assert.equal(mfaVerified, 0);
requestError = null;
await view().form.fire('submit');
assert.equal(flow.isBlocked(), false);
assert.equal(mfaVerified, 1);
let enrollments = 0;
auth.mfa.listFactors = async () => ({ data: { totp: [] }, error: null });
auth.mfa.enroll = async () => { enrollments++; return { data: { id: 'new-test-factor', totp: { qr_code: '<svg></svg>' } }, error: null }; };
await flow.run('Two-Factor Authentication');
assert.equal(enrollments, 0, 'Opening settings must not create a credential');
await view().form.fire('submit');
assert.equal(enrollments, 1);
assert.match(view().status.textContent, /only after verification/);
assert.equal(mfaVerified, 1, 'Enrollment alone is not verification');
const setupCode = view().fields.children.find(item => item.tag === 'label').children[0];
setupCode.value = '000000';
requestError = new Error('Invalid authenticator code');
await view().form.fire('submit');
assert.equal(mfaVerified, 1);
requestError = null;
await view().form.fire('submit');
assert.equal(mfaVerified, 2);
flow.recovery();
session = null;
await view().form.fire('submit');
assert.match(view().status.textContent, /expired or invalid/);
session = { user: { id: 'qa' } };
const [password, confirm] = view().fields.children.map(label => label.children[0]);
password.value = 'test-only-password'; confirm.value = 'different-test-value';
await view().form.fire('submit');
assert.match(view().status.textContent, /do not match/);
confirm.value = password.value;
await view().form.fire('submit');
assert.equal(recovered, 1);
assert.equal(password.value, '');
assert.equal(confirm.value, '');
assert.equal(flow.isRecovery(), false);
const token = aal => `header.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.validated-signature`;
assert.equal(requiresSecondFactor({ factors: [] }, token('aal1')), false);
assert.equal(requiresSecondFactor({ factors: [{ status: 'unverified' }] }, token('aal1')), false);
assert.equal(requiresSecondFactor({ factors: [{ status: 'verified' }] }, token('aal1')), true);
assert.equal(requiresSecondFactor({ factors: [{ status: 'verified' }] }, token('aal2')), false);
assert.equal(requiresSecondFactor({ factors: [{ status: 'verified' }] }, 'invalid'), true);
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /event === "PASSWORD_RECOVERY"/);
assert.doesNotMatch(app, /Guest session risk report logged/);
console.log('Auth workflows passed: provider failures, duplicate-submit prevention, actual reset/resend calls, policy content, recovery session/error handling, MFA challenge and server assurance checks.');
