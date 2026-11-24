// Checks that the pages, the browser config and the SQL file agree with each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, exists, CONFIG } from './helper.mjs';

const PAGES = ['gaismasaptauja/index.html', 'gaismasaptauja/stats/index.html'];
const SQL = read('gaismasaptauja.sql');
const datesIn = text => [...text.matchAll(/id:'(\d{4}-\d{2}-\d{2})'/g)].map(m => m[1]);

for (const page of PAGES) {
  test(`${page}: strict Content-Security-Policy that allows only this page, its fonts and the Supabase project`, () => {
    const html = read(page);
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, 'CSP meta tag present');
    const rule = name => csp.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' '));
    assert.equal(rule('default-src'), "default-src 'none'");
    assert.equal(rule('script-src'), "script-src 'self'", 'no inline or remote scripts');
    assert.equal(rule('connect-src'), 'connect-src ' + CONFIG.supabaseUrl, 'only the Supabase project from themes/config.js');
    assert.equal(rule('base-uri'), "base-uri 'none'");
    assert.equal(rule('form-action'), "form-action 'none'");
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.doesNotMatch(rule('script-src'), /unsafe-inline/);
  });

  test(`${page}: no inline scripts or inline event handlers`, () => {
    const html = read(page);
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      assert.match(m[1], /\bsrc=/, 'every script has a src');
      assert.equal(m[2].trim(), '', 'and no inline body');
    }
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'no onclick= style attributes');
    assert.doesNotMatch(html, /javascript:/i);
  });

  test(`${page}: hidden from search engines and sends no referrer`, () => {
    const html = read(page);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.match(html, /<meta name="referrer" content="no-referrer">/);
  });

  test(`${page}: every local file it loads exists`, () => {
    const html = read(page);
    const dir = page.replace(/[^/]*$/, '');
    for (const m of html.matchAll(/(?:src|href)="(?!https?:|#|data:)([^"]+)"/g)) {
      const target = new URL(m[1], 'https://x.test/' + dir).pathname.slice(1);
      if (target.endsWith('/')) assert.ok(exists(target + 'index.html'), m[1]);
      else assert.ok(exists(target), `${m[1]} -> ${target}`);
    }
  });
}

test('the poll dates are the same in the vote page, the stats page and the database', () => {
  const dbDates = [...SQL.match(/date_id text not null check \(date_id in \(([^)]*)\)\)/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.equal(dbDates.length, 4);
  assert.deepEqual(datesIn(read('gaismasaptauja/poll.js')), dbDates);
  assert.deepEqual(datesIn(read('gaismasaptauja/stats/stats.js')), dbDates);
  const fnDates = [...SQL.matchAll(/p_date not in \(([^)]*)\)/g)];
  assert.equal(fnDates.length, 1);
  assert.deepEqual([...fnDates[0][1].matchAll(/'([^']+)'/g)].map(m => m[1]), dbDates, 'function validates the same dates');
});

test('every database function the pages call exists, with the parameters they send', () => {
  const fn = (name, params) => {
    const re = new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`);
    const m = SQL.match(re);
    assert.ok(m, `function ${name} is defined in gaismasaptauja.sql`);
    assert.deepEqual(m[1].split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean), params, `${name} parameters`);
    assert.match(SQL, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to anon`), `${name} is callable by the website`);
    assert.match(SQL, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`), `${name} starts locked`);
  };
  fn('submit_gaisma_response', ['p_voter_id', 'p_name', 'p_date']);
  fn('get_gaisma_counts', []);
  fn('get_gaisma_results', ['p_key']);
  assert.match(read('gaismasaptauja/poll.js'), /rpc\('submit_gaisma_response', \{p_voter_id: voterId, p_name: name, p_date: d\.id\}\)/);
  assert.match(read('gaismasaptauja/stats/stats.js'), /rpc\('get_gaisma_results', \{p_key: key\}\)/);
  assert.match(read('gaismasaptauja/stats/stats.js'), /rpc\('get_gaisma_counts'\)/);
});

test('the pages only call functions that return no secrets', () => {
  const used = new Set([...read('gaismasaptauja/poll.js').matchAll(/rpc\('([a-z_]+)'/g), ...read('gaismasaptauja/stats/stats.js').matchAll(/rpc\('([a-z_]+)'/g)].map(m => m[1]));
  assert.deepEqual([...used].sort(), ['get_gaisma_counts', 'get_gaisma_results', 'submit_gaisma_response']);
  assert.doesNotMatch(read('gaismasaptauja/poll.js') + read('gaismasaptauja/stats/stats.js'), /\/rest\/v1\/(?!rpc\/)/, 'no direct table access from the browser');
});

test('name length is 60 everywhere', () => {
  assert.match(read('gaismasaptauja/index.html'), /maxlength="60"/);
  assert.match(read('gaismasaptauja/poll.js'), /\.slice\(0, 60\)/);
  assert.match(SQL, /check \(char_length\(name\) between 1 and 60\)/);
  assert.match(SQL, /char_length\(clean_name\) not between 1 and 60/);
});

test('the tables are private and the stats key is stored only as a hash', () => {
  for (const table of ['gaisma_responses', 'gaisma_settings']) {
    assert.match(SQL, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(SQL, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
  }
  assert.match(SQL, /'stats_key_sha256', '[0-9a-f]{64}'/);
  assert.doesNotMatch(SQL, /grant (select|insert|update|delete|all)[^;]*gaisma_(responses|settings)/i);
  for (const f of ['submit_gaisma_response', 'get_gaisma_counts', 'get_gaisma_results']) {
    const body = SQL.slice(SQL.indexOf(`function public.${f}(`));
    assert.match(body.slice(0, body.indexOf('$$;') + 3), /security definer set search_path = ''|language plpgsql security definer set search_path = ''|security definer set search_path = ''/, `${f} is security definer with an empty search_path`);
  }
});

test('the public pages are listed in the README', () => {
  const readme = read('README.md');
  assert.match(readme, /\/gaismasaptauja\//);
  assert.match(readme, /\/gaismasaptauja\/stats\//);
});

test('date cards: the weekday is always on its own line and all cards are the same height', () => {
  const css = read('gaismasaptauja/index.html');
  assert.match(css, /\.d\{[^}]*display:block/, 'date on its own line');
  assert.match(css, /\.wd\{[^}]*display:block/, 'weekday on its own line');
  assert.match(css, /\.opt>span\{[^}]*height:100%/, 'cards fill the grid row');
});
