import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPage, mockFetch, flush, CONFIG, UUID_V4, POLL } from './helper.mjs';

const ok = () => mockFetch({ submit_gaisma_response: async () => ({ json: 'created' }) });
const page = (options = {}) => loadPage(...POLL, { fetch: ok(), ...options });
const radios = p => [...p.doc.querySelectorAll('input[name=date]')];
const fill = (p, name, dateIndex) => {
  p.$('name').value = name;
  if (dateIndex !== undefined) radios(p)[dateIndex].checked = true;
};

test('renders the name field and four date choices, and no results', () => {
  const p = page();
  assert.equal(radios(p).length, 4);
  assert.deepEqual(radios(p).map(r => r.value), ['2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27']);
  assert.match(p.$('opts').textContent, /6\. decembris[\s\S]*27\. decembris/);
  assert.equal(p.$('res'), null, 'results belong on the stats page');
  assert.equal(p.$('send').textContent, 'Nosūtīt atbildi');
  assert.ok(p.doc.querySelector('#lights svg'), 'string of lights is drawn');
  p.close();
});

test('only one date can be selected at a time', () => {
  const p = page();
  radios(p)[0].checked = true;
  radios(p)[2].checked = true;
  assert.deepEqual(radios(p).map(r => r.checked), [false, false, true, false]);
  p.close();
});

test('asks for a name before sending, and sends nothing', async () => {
  const p = page();
  fill(p, '   ', 1);
  p.submit('f'); await flush();
  assert.equal(p.text('msg'), 'Lūdzu, ieraksti savu vārdu.');
  assert.equal(p.w.fetch.calls.length, 0);
  p.close();
});

test('asks for a date before sending, and sends nothing', async () => {
  const p = page();
  fill(p, 'Anna');
  p.submit('f'); await flush();
  assert.equal(p.text('msg'), 'Lūdzu, atzīmē vienu datumu.');
  assert.equal(p.w.fetch.calls.length, 0);
  p.close();
});

test('sends one request with a cleaned name, the date and this browser id', async () => {
  const p = page();
  fill(p, '  Anna   Bērziņa ', 2);
  p.submit('f'); await flush();
  const calls = p.w.fetch.calls;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fn, 'submit_gaisma_response');
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].url.startsWith(CONFIG.supabaseUrl + '/rest/v1/rpc/'));
  assert.equal(calls[0].headers.apikey, CONFIG.publishableKey);
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['p_date', 'p_name', 'p_voter_id']);
  assert.equal(calls[0].body.p_name, 'Anna Bērziņa');
  assert.equal(calls[0].body.p_date, '2026-12-20');
  assert.match(calls[0].body.p_voter_id, UUID_V4);
  p.close();
});

test('shows a thank-you, with no results link, and remembers the answer', async () => {
  const p = page();
  fill(p, 'Anna Bērziņa', 2);
  p.submit('f'); await flush();
  assert.equal(p.text('msg'), 'Paldies, Anna Bērziņa! Tava izvēle: 20. decembris.');
  assert.equal(p.$('msg').querySelectorAll('a').length, 0, 'the vote page does not point to the results');
  assert.doesNotMatch(p.doc.body.textContent, /rezultāt/i);
  assert.equal(p.$('msg').className, 'msg ok');
  assert.equal(p.$('send').textContent, 'Mainīt atbildi');
  assert.equal(p.$('send').disabled, false);
  assert.equal(p.w.localStorage.getItem('gd-name'), 'Anna Bērziņa');
  assert.equal(p.w.localStorage.getItem('gd-date'), '2026-12-20');
  p.close();
});

test('the browser id is created once and reused', async () => {
  const first = page();
  fill(first, 'Anna', 0);
  first.submit('f'); await flush();
  const id = first.w.fetch.calls[0].body.p_voter_id;
  const saved = Object.fromEntries(['gd-voter', 'gd-name', 'gd-date'].map(k => [k, first.w.localStorage.getItem(k)]));
  assert.equal(saved['gd-voter'], id);
  first.close();

  const second = page({ local: saved });
  fill(second, 'Anna', 1);
  second.submit('f'); await flush();
  assert.equal(second.w.fetch.calls[0].body.p_voter_id, id);
  second.close();
});

test('a damaged browser id is replaced by a valid one', async () => {
  const p = page({ local: { 'gd-voter': 'not-a-uuid' } });
  fill(p, 'Anna', 0);
  p.submit('f'); await flush();
  assert.match(p.w.fetch.calls[0].body.p_voter_id, UUID_V4);
  assert.match(p.w.localStorage.getItem('gd-voter'), UUID_V4);
  p.close();
});

test('a name can never turn into markup', async () => {
  const p = page();
  fill(p, '<img src=x onerror=alert(1)><b>x</b>', 0);
  p.submit('f'); await flush();
  assert.equal(p.$('msg').querySelectorAll('img, b, script').length, 0);
  assert.match(p.text('msg'), /<img src=x onerror=alert\(1\)><b>x<\/b>/);
  assert.equal(p.$('msg').children.length, 0, 'the message is plain text');
  p.close();
});

const failures = [
  ['Name taken', 400, { message: 'Name taken' }, /jau ir izmantots citā pārlūkā/],
  ['Too many requests', 400, { message: 'Too many requests' }, /Pārāk daudz mēģinājumu/],
  ['Poll is full', 400, { message: 'Poll is full' }, /Aptauja ir aizvērta/],
  ['Invalid date', 400, { message: 'Invalid date' }, /Neizdevās saglabāt/],
  ['server error without a body', 500, null, /Neizdevās saglabāt/]
];
for (const [label, status, json, expected] of failures) {
  test(`shows a clear message when the server says: ${label}`, async () => {
    const p = loadPage(...POLL, { fetch: mockFetch({ submit_gaisma_response: async () => ({ status, json }) }) });
    fill(p, 'Anna', 0);
    p.submit('f'); await flush();
    assert.match(p.text('msg'), expected);
    assert.equal(p.$('msg').className, 'msg err');
    assert.equal(p.$('send').disabled, false, 'can try again');
    assert.equal(p.$('send').textContent, 'Nosūtīt atbildi', 'nothing was saved');
    assert.equal(p.w.localStorage.getItem('gd-date'), null);
    p.close();
  });
}

test('shows an error when the network fails', async () => {
  const p = loadPage(...POLL, { fetch: mockFetch({ submit_gaisma_response: async () => { throw new Error('offline'); } }) });
  fill(p, 'Anna', 0);
  p.submit('f'); await flush();
  assert.match(p.text('msg'), /Neizdevās saglabāt/);
  assert.equal(p.$('send').disabled, false);
  p.close();
});

test('a second click while saving does not send twice', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const p = loadPage(...POLL, { fetch: mockFetch({ submit_gaisma_response: async () => { await gate; return { json: 'created' }; } }) });
  fill(p, 'Anna', 0);
  p.submit('f'); p.submit('f'); p.submit('f'); await flush();
  assert.equal(p.w.fetch.calls.length, 1);
  assert.equal(p.$('send').disabled, true);
  assert.equal(p.text('msg'), 'Saglabāju…');
  release(); await flush();
  assert.equal(p.w.fetch.calls.length, 1);
  assert.equal(p.$('send').disabled, false);
  p.close();
});

test('brings back this browser\'s earlier answer and offers to change it', () => {
  const p = page({ local: { 'gd-name': 'Anna', 'gd-date': '2026-12-13' } });
  assert.equal(p.$('name').value, 'Anna');
  assert.deepEqual(radios(p).map(r => r.checked), [false, true, false, false]);
  assert.equal(p.$('send').textContent, 'Mainīt atbildi');
  p.$('name').value = 'Someone Else';
  p.$('name').dispatchEvent(new p.w.Event('input', { bubbles: true }));
  assert.equal(p.$('send').textContent, 'Nosūtīt atbildi', 'a different name is a new answer');
  p.$('name').value = '  anna ';
  p.$('name').dispatchEvent(new p.w.Event('input', { bubbles: true }));
  assert.equal(p.$('send').textContent, 'Mainīt atbildi', 'comparison ignores case and spaces');
  p.close();
});

test('ignores a stored date that is not one of the four', () => {
  for (const bad of ['2099-01-01', '"] , [x', '']) {
    const p = page({ local: { 'gd-name': 'Anna', 'gd-date': bad } });
    assert.equal(radios(p).filter(r => r.checked).length, 0, `date ${JSON.stringify(bad)}`);
    p.close();
  }
});

test('cuts an over-long stored name to 60 characters', () => {
  const p = page({ local: { 'gd-name': 'x'.repeat(200) } });
  assert.equal(p.$('name').value.length, 60);
  p.close();
});

test('the name field allows at most 60 characters', () => {
  const p = page();
  assert.equal(p.$('name').getAttribute('maxlength'), '60');
  p.close();
});

test('still works when the browser blocks storage', async () => {
  const p = page({ blockStorage: true });
  assert.equal(radios(p).length, 4);
  fill(p, 'Anna', 3);
  p.submit('f'); await flush();
  assert.equal(p.w.fetch.calls.length, 1);
  assert.match(p.w.fetch.calls[0].body.p_voter_id, UUID_V4);
  assert.match(p.text('msg'), /^Paldies, Anna!/);
  p.close();
});

// ---- string of lights -------------------------------------------------------------------
const resizeTo = async (p, width) => {
  Object.defineProperty(p.$('lights'), 'clientWidth', { value: width, configurable: true });
  p.w.dispatchEvent(new p.w.Event('resize'));
  await flush(220);
};
const bulbs = p => [...p.doc.querySelectorAll('#lights .bulb')];

test('the string of lights is drawn to the real page width and never stretched', async () => {
  for (const width of [375, 720, 1440, 2560]) {
    const p = page();
    await resizeTo(p, width);
    const svg = p.doc.querySelector('#lights svg');
    assert.equal(svg.getAttribute('viewBox'), `0 0 ${width} 90`, `${width}px wide`);
    assert.equal(svg.getAttribute('preserveAspectRatio'), null, 'no preserveAspectRatio="none" stretching');
    for (const c of p.doc.querySelectorAll('#lights circle')) assert.ok(['6', '14'].includes(c.getAttribute('r')), 'bulbs stay round');
    p.close();
  }
});

test('wider screens get more bulbs, evenly spread and inside the picture', async () => {
  const counts = {};
  for (const width of [375, 1440, 2560]) {
    const p = page();
    await resizeTo(p, width);
    counts[width] = bulbs(p).length;
    const xs = bulbs(p).map(b => Number(b.querySelector('circle').getAttribute('cx')));
    assert.ok(xs.every(x => x > 0 && x < width), 'every bulb is inside the width');
    assert.deepEqual([...xs].sort((a, b) => a - b), xs, 'bulbs are in left-to-right order');
    const ys = bulbs(p).map(b => Number(b.querySelector('circle').getAttribute('cy')));
    assert.ok(ys.every(y => y > 14 && y < 90 - 14), 'bulbs and glow stay inside the 90px height');
    p.close();
  }
  assert.ok(counts[375] < counts[1440] && counts[1440] < counts[2560], JSON.stringify(counts));
});

test('the garland is redrawn when the window changes size, and not when the width is the same', async () => {
  const p = page();
  await resizeTo(p, 800);
  const first = p.$('lights').innerHTML;
  await resizeTo(p, 800);
  assert.equal(p.$('lights').innerHTML, first);
  await resizeTo(p, 1800);
  assert.notEqual(p.$('lights').innerHTML, first);
  assert.equal(p.doc.querySelector('#lights svg').getAttribute('viewBox'), '0 0 1800 90');
  p.close();
});

test('the lights keep working when the width is unknown', () => {
  const p = page();
  assert.ok(bulbs(p).length >= 10);
  p.close();
});
