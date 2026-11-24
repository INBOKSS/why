(() => {
  'use strict';
  const DATES = [
    {id:'2026-12-06', d:'6. decembris', wd:'svētdiena'},
    {id:'2026-12-13', d:'13. decembris', wd:'svētdiena'},
    {id:'2026-12-20', d:'20. decembris', wd:'svētdiena'},
    {id:'2026-12-27', d:'27. decembris', wd:'svētdiena'}
  ];
  const KEY = 'gd-stats-key';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const votes = n => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'balss' : 'balsis');
  // The key stays in this tab only (sessionStorage) and is sent only to the Supabase function.
  // memKey keeps the key for this page load when the browser blocks sessionStorage.
  let memKey = '';
  const getKey = () => { try { return sessionStorage.getItem(KEY) || memKey; } catch { return memKey; } };
  const setKey = v => {
    memKey = v || '';
    try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch { /* tab-only convenience */ }
  };
  let loaded = false, requestNumber = 0, keyError = false;

  async function rpc(fn, body){
    const cfg = window.THEME_POLL_CONFIG || {};
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(cfg.supabaseUrl || '') || !cfg.publishableKey) throw new Error('not configured');
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {apikey: cfg.publishableKey, 'Content-Type': 'application/json'},
      body: JSON.stringify(body || {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok){ const e = new Error(fn + ' ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }

  // counts: {dateId: n}; names: {dateId: [name, ...]} or null when locked
  function paint(counts, names){
    const total = DATES.reduce((s, d) => s + (counts[d.id] || 0), 0);
    const max = Math.max(0, ...DATES.map(d => counts[d.id] || 0));
    $('total').textContent = total;
    $('res').innerHTML = DATES.map(d => {
      const n = counts[d.id] || 0, pct = total ? Math.round(n / total * 100) : 0;
      let list = '';
      if (names) list = n
        ? `<ul class="names">${names[d.id].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
        : '<p class="empty">Vēl neviens nav izvēlējies šo datumu.</p>';
      return `<section class="card"><h2><span>${d.d}</span><small>${d.wd}</small></h2>
        <div class="cnt"><span>${votes(n)} · ${pct}%</span>${n && n === max ? '<span class="top">Populārākais</span>' : ''}</div>
        <span class="bar"><i style="width:${pct}%"></i></span>${list}</section>`;
    }).join('');
  }

  function syncUnlock(){
    $('unlock').textContent = getKey() ? 'Paslēpt vārdus' : 'Atvērt vārdus';
    $('keyErr').hidden = !keyError;
  }

  async function load(){
    const number = ++requestNumber;
    $('refresh').disabled = true;
    $('res').setAttribute('aria-busy', 'true');
    try {
      let counts = {}, names = null;
      const key = getKey();
      if (key){
        try {
          const rows = await rpc('get_gaisma_results', {p_key: key});
          if (!Array.isArray(rows)) throw new Error('Unexpected response');
          names = {}; DATES.forEach(d => { names[d.id] = []; counts[d.id] = 0; });
          rows.forEach(r => {
            if (r && typeof r.name === 'string' && names[r.date_id]){ names[r.date_id].push(r.name); counts[r.date_id]++; }
          });
          names && Object.values(names).forEach(a => a.sort((x, y) => x.localeCompare(y, 'lv')));
        } catch (e) {
          if (e && (e.status === 401 || e.status === 403)){ setKey(''); keyError = true; names = null; }
          else throw e;
        }
      }
      if (!names){
        const rows = await rpc('get_gaisma_counts');
        if (number !== requestNumber) return;
        if (!Array.isArray(rows)) throw new Error('Unexpected response');
        counts = {};
        rows.forEach(r => { if (r && typeof r.date_id === 'string') counts[r.date_id] = Number(r.votes) || 0; });
      }
      if (number !== requestNumber) return;
      paint(counts, names);
      loaded = true;
      $('msg').className = 'msg';
      $('msg').textContent = 'Atjaunots ' + new Date().toLocaleTimeString('lv', {hour: '2-digit', minute: '2-digit'}) + '. Atjaunojas ik pēc minūtes.';
    } catch {
      if (number !== requestNumber) return;
      $('msg').className = 'msg err';
      $('msg').textContent = 'Neizdevās ielādēt rezultātus. Lūdzu, nospied „Atjaunot”.';
      if (!loaded) $('res').innerHTML = '<p class="empty">Rezultāti šobrīd nav pieejami.</p>';
    } finally {
      if (number === requestNumber){ $('refresh').disabled = false; $('res').setAttribute('aria-busy', 'false'); syncUnlock(); }
    }
  }

  $('unlock').addEventListener('click', () => {
    if (getKey()){ setKey(''); keyError = false; $('keyBox').hidden = true; load(); return; }
    $('keyBox').hidden = !$('keyBox').hidden;
    if (!$('keyBox').hidden) $('keyIn').focus();
  });
  $('keyForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('keyIn').value.trim();
    if (!v) return;
    keyError = false; setKey(v); $('keyIn').value = ''; $('keyBox').hidden = true; load();
  });
  $('refresh').addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden && !$('refresh').disabled) load(); }, 60000);
  syncUnlock();
  load();
})();
