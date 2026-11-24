import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPage, mockFetch, flush, STATS } from './helper.mjs';

const KEY = 'gd-stats-key';
const counts = rows => async () => ({ json: rows });
const names = rows => async () => ({ json: rows });
const forbidden = async () => ({ status: 401, json: { code: '42501', message: 'Forbidden' } });

const open = async (routes, options = {}) => {
  const p = loadPage(...STATS, { fetch: mockFetch(routes), ...options });
  await flush();
  return p;
};
const calls = p => p.w.fetch.calls.map(c => c.fn);
const cardText = (p, i) => p.doc.querySelectorAll('#res .card')[i].textContent.replace(/\s+/g, ' ').trim();
const unlock = async (p, key) => {
  if (p.$('keyBox').hidden) p.click('unlock');
  p.$('keyIn').value = key;
  p.submit('keyForm');
  await flush();
};

test('public view: counts, percentages and the most popular date, no names', async () => {
  const p = await open({ get_gaisma_counts: counts([{ date_id: '2026-12-13', votes: 3 }, { date_id: '2026-12-06', votes: 1 }]) });
  assert.deepEqual(calls(p), ['get_gaisma_counts'], 'names are not even requested without the key');
  assert.equal(p.text('total'), '4');
  assert.equal(p.doc.querySelectorAll('#res .card').length, 4);
  assert.match(cardText(p, 0), /^6\. decembris\s?svētdiena 1 balss · 25%/);
  assert.match(cardText(p, 1), /^13\. decembris\s?svētdiena 3 balsis · 75%\s?Populārākais/);
  assert.match(cardText(p, 2), /0 balsis · 0%/);
  assert.equal(p.doc.querySelectorAll('.top').length, 1);
  assert.equal(p.doc.querySelectorAll('.names, .names li').length, 0);
  assert.equal(p.$('unlock').textContent, 'Atvērt vārdus');
  assert.equal(p.$('keyErr').hidden, true);
  assert.equal(p.$('keyBox').hidden, true);
  assert.match(p.text('msg'), /^Atjaunots \d\d:\d\d\./);
  p.close();
});

test('empty poll shows zeros and no "most popular"', async () => {
  const p = await open({ get_gaisma_counts: counts([]) });
  assert.equal(p.text('total'), '0');
  assert.equal(p.doc.querySelectorAll('.top').length, 0);
  assert.equal(p.doc.querySelectorAll('#res .card').length, 4);
  assert.match(p.$('res').textContent, /0 balsis · 0%/);
  p.close();
});

test('Latvian plural: 1 balss, 2 balsis, 11 balsis, 21 balss', async () => {
  const p = await open({ get_gaisma_counts: counts([
    { date_id: '2026-12-06', votes: 21 }, { date_id: '2026-12-13', votes: 11 },
    { date_id: '2026-12-20', votes: 1 }, { date_id: '2026-12-27', votes: 2 }]) });
  assert.match(cardText(p, 0), /21 balss ·/);
  assert.match(cardText(p, 1), /11 balsis ·/);
  assert.match(cardText(p, 2), /1 balss ·/);
  assert.match(cardText(p, 3), /2 balsis ·/);
  p.close();
});

test('a tie marks every leading date', async () => {
  const p = await open({ get_gaisma_counts: counts([{ date_id: '2026-12-06', votes: 2 }, { date_id: '2026-12-20', votes: 2 }]) });
  assert.equal(p.doc.querySelectorAll('.top').length, 2);
  p.close();
});

test('ignores unknown dates and damaged rows', async () => {
  const p = await open({ get_gaisma_counts: counts([
    { date_id: '2099-01-01', votes: 5 }, { date_id: '2026-12-06', votes: 'x' }, null, { votes: 2 }, { date_id: 7, votes: 1 },
    { date_id: '2026-12-13', votes: 2 }]) });
  assert.equal(p.text('total'), '2');
  assert.match(cardText(p, 1), /2 balsis · 100%/);
  p.close();
});

test('unlocking with the right key shows names, sorted, as plain text', async () => {
  const p = await open({
    get_gaisma_counts: counts([]),
    get_gaisma_results: names([
      { name: 'Ēriks', date_id: '2026-12-13' }, { name: 'Anna', date_id: '2026-12-13' },
      { name: '<b>x</b><img src=x onerror=alert(1)>', date_id: '2026-12-06' }])
  });
  await unlock(p, 'right-key');
  const results = p.w.fetch.calls.filter(c => c.fn === 'get_gaisma_results');
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].body, { p_key: 'right-key' });
  assert.equal(p.text('total'), '3');
  assert.deepEqual([...p.doc.querySelectorAll('#res .card')[1].querySelectorAll('.names li')].map(l => l.textContent), ['Anna', 'Ēriks']);
  assert.equal(p.$('res').querySelectorAll('b, img, script').length, 0, 'names are escaped');
  assert.match(p.$('res').textContent, /<b>x<\/b><img src=x onerror=alert\(1\)>/);
  assert.match(cardText(p, 2), /Vēl neviens nav izvēlējies šo datumu\./);
  assert.equal(p.$('unlock').textContent, 'Paslēpt vārdus');
  assert.equal(p.$('keyBox').hidden, true);
  assert.equal(p.$('keyIn').value, '', 'the key is not left in the field');
  assert.equal(p.w.sessionStorage.getItem(KEY), 'right-key');
  p.close();
});

test('the key is trimmed and an empty key does nothing', async () => {
  const p = await open({ get_gaisma_counts: counts([]), get_gaisma_results: names([]) });
  await unlock(p, '   ');
  assert.equal(p.w.fetch.calls.filter(c => c.fn === 'get_gaisma_results').length, 0);
  await unlock(p, '  abc  ');
  assert.deepEqual(p.w.fetch.calls.find(c => c.fn === 'get_gaisma_results').body, { p_key: 'abc' });
  p.close();
});

test('a wrong key shows an error, forgets the key and goes back to counts only', async () => {
  const p = await open({
    get_gaisma_counts: counts([{ date_id: '2026-12-06', votes: 2 }]),
    get_gaisma_results: forbidden
  });
  await unlock(p, 'wrong');
  assert.equal(p.$('keyErr').hidden, false);
  assert.equal(p.w.sessionStorage.getItem(KEY), null);
  assert.equal(p.doc.querySelectorAll('.names').length, 0);
  assert.equal(p.text('total'), '2', 'public counts are still shown');
  assert.equal(p.$('unlock').textContent, 'Atvērt vārdus');
  assert.equal(p.$('msg').className, 'msg', 'not a loading error');
  p.close();
});

test('the error disappears after a correct key', async () => {
  let good = false;
  const p = await open({
    get_gaisma_counts: counts([]),
    get_gaisma_results: async b => (b.p_key === 'good' ? { json: [{ name: 'Anna', date_id: '2026-12-06' }] } : forbidden())
  });
  await unlock(p, 'bad');
  assert.equal(p.$('keyErr').hidden, false);
  await unlock(p, 'good');
  assert.equal(p.$('keyErr').hidden, true);
  assert.equal(p.doc.querySelectorAll('.names li').length, 1);
  p.close();
});

test('"Paslēpt vārdus" forgets the key and hides the names', async () => {
  const p = await open({ get_gaisma_counts: counts([{ date_id: '2026-12-06', votes: 1 }]), get_gaisma_results: names([{ name: 'Anna', date_id: '2026-12-06' }]) });
  await unlock(p, 'k');
  assert.equal(p.doc.querySelectorAll('.names li').length, 1);
  p.click('unlock'); await flush();
  assert.equal(p.w.sessionStorage.getItem(KEY), null);
  assert.equal(p.doc.querySelectorAll('.names').length, 0);
  assert.equal(p.$('unlock').textContent, 'Atvērt vārdus');
  p.close();
});

test('the unlock button toggles the key box', async () => {
  const p = await open({ get_gaisma_counts: counts([]) });
  assert.equal(p.$('keyBox').hidden, true);
  p.click('unlock');
  assert.equal(p.$('keyBox').hidden, false);
  p.click('unlock');
  assert.equal(p.$('keyBox').hidden, true);
  assert.equal(p.$('keyIn').getAttribute('type'), 'password');
  p.close();
});

test('a key kept in this tab opens the names on load', async () => {
  const p = await open(
    { get_gaisma_counts: counts([]), get_gaisma_results: names([{ name: 'Anna', date_id: '2026-12-20' }]) },
    { session: { [KEY]: 'kept' } });
  assert.equal(calls(p)[0], 'get_gaisma_results');
  assert.equal(p.doc.querySelectorAll('.names li').length, 1);
  assert.equal(p.$('unlock').textContent, 'Paslēpt vārdus');
  p.close();
});

test('a network error while checking the key keeps the key and shows a load error', async () => {
  const p = await open({
    get_gaisma_counts: counts([]),
    get_gaisma_results: async () => { throw new Error('offline'); }
  }, { session: { [KEY]: 'kept' } });
  assert.match(p.text('msg'), /Neizdevās ielādēt rezultātus/);
  assert.equal(p.w.sessionStorage.getItem(KEY), 'kept');
  assert.equal(p.$('keyErr').hidden, true);
  p.close();
});

test('results ignore names with an unknown date or a non-text name', async () => {
  const p = await open({
    get_gaisma_counts: counts([]),
    get_gaisma_results: names([{ name: 'Anna', date_id: '2026-12-06' }, { name: 'Ghost', date_id: '2099-01-01' }, { name: 5, date_id: '2026-12-06' }, null])
  }, { session: { [KEY]: 'k' } });
  assert.equal(p.text('total'), '1');
  assert.equal(p.doc.querySelectorAll('.names li').length, 1);
  p.close();
});

test('shows a message when the results cannot be loaded, and recovers on refresh', async () => {
  let fail = true;
  const p = await open({ get_gaisma_counts: async () => (fail ? { status: 500, json: null } : { json: [{ date_id: '2026-12-06', votes: 1 }] }) });
  assert.match(p.text('msg'), /Neizdevās ielādēt rezultātus/);
  assert.equal(p.$('msg').className, 'msg err');
  assert.match(p.$('res').textContent, /Rezultāti šobrīd nav pieejami\./);
  assert.equal(p.$('refresh').disabled, false);
  fail = false;
  p.click('refresh'); await flush();
  assert.equal(p.text('total'), '1');
  assert.equal(p.$('msg').className, 'msg');
  p.close();
});

test('keeps showing the last good results when a later refresh fails', async () => {
  let fail = false;
  const p = await open({ get_gaisma_counts: async () => (fail ? { status: 500, json: null } : { json: [{ date_id: '2026-12-06', votes: 4 }] }) });
  fail = true;
  p.click('refresh'); await flush();
  assert.equal(p.text('total'), '4');
  assert.match(p.text('msg'), /Neizdevās ielādēt/);
  p.close();
});

test('rejects a response that is not a list', async () => {
  const p = await open({ get_gaisma_counts: counts({ not: 'a list' }) });
  assert.match(p.text('msg'), /Neizdevās ielādēt rezultātus/);
  p.close();
});

test('works when the browser blocks storage', async () => {
  const p = await open({ get_gaisma_counts: counts([{ date_id: '2026-12-06', votes: 1 }]), get_gaisma_results: names([{ name: 'Anna', date_id: '2026-12-06' }]) }, { blockStorage: true });
  assert.equal(p.text('total'), '1');
  await unlock(p, 'k');
  assert.equal(p.doc.querySelectorAll('.names li').length, 1, 'names still open for this load');
  p.close();
});

test('sends the Supabase publishable key and nothing else secret', async () => {
  const p = await open({ get_gaisma_counts: counts([]) });
  const c = p.w.fetch.calls[0];
  assert.deepEqual(Object.keys(c.headers).sort(), ['Content-Type', 'apikey']);
  assert.deepEqual(c.body, {});
  p.close();
});
