// Shared helpers: load a page into jsdom with a fake Supabase and run its script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach } from 'node:test';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const exists = p => fs.existsSync(path.join(ROOT, p));

// The real browser config (themes/config.js), so the tests use the same Supabase URL and key.
export const CONFIG = (() => {
  const w = {};
  new Function('window', read('themes/config.js'))(w);
  return w.THEME_POLL_CONFIG;
})();

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const flush = (ms = 15) => new Promise(r => setTimeout(r, ms));

// routes: { rpcName: async (body) => ({ json, status? }) }  (throw to simulate a network error)
export function mockFetch(routes) {
  const calls = [];
  const f = async (url, opts = {}) => {
    const fn = String(url).split('/rest/v1/rpc/')[1];
    const body = JSON.parse(opts.body || '{}');
    calls.push({ fn, body, url: String(url), headers: opts.headers, method: opts.method });
    const handler = routes[fn];
    if (!handler) throw new Error('unexpected rpc ' + fn);
    const res = await handler(body);
    const status = res.status || 200;
    return { ok: status < 400, status, json: async () => res.json };
  };
  f.calls = calls;
  return f;
}

// options: fetch, local (initial localStorage), session (initial sessionStorage), blockStorage
export function loadPage(htmlPath, scriptPath, options = {}) {
  const html = read(htmlPath).replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, '');
  const url = 'https://why.inbokss.com/' + htmlPath.replace(/index\.html$/, '');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  open.add(w);
  w.THEME_POLL_CONFIG = CONFIG;
  w.fetch = options.fetch;
  w.AbortSignal = AbortSignal;
  if (!w.crypto || !w.crypto.randomUUID) Object.defineProperty(w, 'crypto', { value: globalThis.crypto, configurable: true });
  if (options.blockStorage) {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(w, name, { get() { throw new Error('storage blocked'); }, configurable: true });
    }
  } else {
    for (const [k, v] of Object.entries(options.local || {})) w.localStorage.setItem(k, v);
    for (const [k, v] of Object.entries(options.session || {})) w.sessionStorage.setItem(k, v);
  }
  w.eval(read(scriptPath));
  const doc = w.document;
  return {
    w, doc,
    $: id => doc.getElementById(id),
    text: id => doc.getElementById(id).textContent,
    submit: id => doc.getElementById(id).dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true })),
    click: id => doc.getElementById(id).click(),
    close: () => w.close()
  };
}

// Close every page after each test, even a failing one, so the page timers cannot keep node alive.
const open = new Set();
afterEach(() => { for (const w of open) w.close(); open.clear(); });

export const POLL = ['gaismasaptauja/index.html', 'gaismasaptauja/poll.js'];
export const STATS = ['gaismasaptauja/stats/index.html', 'gaismasaptauja/stats/stats.js'];
