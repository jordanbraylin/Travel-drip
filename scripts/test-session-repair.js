import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('let sessionRefreshPromise = null;'), source.indexOf('async function liveSearchApiRequest('));
let calls = 0, refreshes = 0, expired = true, syncStatus = '';
const state = { session: { user: { id: 'one' }, access_token: 'old' } };
state.supabase = { auth: { async refreshSession() {
  refreshes++;
  await new Promise(resolve => setTimeout(resolve, 1));
  return { data: { session: { user: { id: 'one' }, access_token: 'fresh' } } };
} } };
const context = vm.createContext({ state, isFilePreview: false, setSyncStatus: value => { syncStatus = value; },
  fetch: async (_path, options) => {
    calls++;
    const status = expired && options.headers.Authorization !== 'Bearer fresh' ? 401 : 200;
    return { status, ok: status === 200, json: async () => status === 200 ? { saved: true } : { error: 'Unauthorized' } };
  }
});
vm.runInContext(code, context);
await Promise.all([vm.runInContext('apiRequest("/api/trips")', context), vm.runInContext('apiRequest("/api/wallet")', context)]);
assert.equal(refreshes, 1);
assert.equal(calls, 4);
assert.equal(state.session.access_token, 'fresh');
state.session.access_token = 'old';
state.supabase.auth.refreshSession = async () => ({ error: new Error('expired') });
await assert.rejects(vm.runInContext('apiRequest("/api/trips")', context), /Unauthorized/);
assert.equal(syncStatus, 'Sign in again');
expired = false;
state.supabase.auth.refreshSession = async () => { throw new Error('must not refresh'); };
assert.equal((await vm.runInContext('apiRequest("/api/trips")', context)).saved, true);
assert.match(source, /event === "TOKEN_REFRESHED"/);
assert.doesNotMatch(source, /onAuthStateChange\(async/);
assert.match(source, /\["solo", "group", "cruise", "corporate"\]\.includes\(type\) \? "\/api\/trips" : "\/api\/events"/);
const wallet = await readFile(new URL('../server/api/wallet.js', import.meta.url), 'utf8');
assert.match(wallet, /maskedLastFour: cardReady \? context\.card\.masked_last_four : null/);
for (const file of ['trips', 'events']) {
  const record = await readFile(new URL(`../server/api/${file}.js`, import.meta.url), 'utf8');
  assert.doesNotMatch(record, /masked_last_four: walletIdentifier\.slice/);
}
console.log('Session repair passed: one shared refresh, one retry, expired-session feedback, no auth callback lock, no unissued card digits.');
