(() => {
  'use strict';
  const DATES = [
    {id:'2026-12-06', d:'6. decembris', wd:'svētdiena'},
    {id:'2026-12-13', d:'13. decembris', wd:'svētdiena'},
    {id:'2026-12-20', d:'20. decembris', wd:'svētdiena'},
    {id:'2026-12-27', d:'27. decembris', wd:'svētdiena'}
  ];
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const votes = n => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'balss' : 'balsis');
  let loaded = false, requestNumber = 0;

  function paint(responses){
    const by = {}; DATES.forEach(d => by[d.id] = []);
    responses.forEach(r => { if (by[r.date_id]) by[r.date_id].push(r); });
    Object.values(by).forEach(a => a.sort((x, y) => x.name.localeCompare(y.name, 'lv')));
    const total = DATES.reduce((s, d) => s + by[d.id].length, 0);
    const max = Math.max(0, ...DATES.map(d => by[d.id].length));
    $('total').textContent = total;
    $('res').innerHTML = DATES.map(d => {
      const list = by[d.id], n = list.length, pct = total ? Math.round(n / total * 100) : 0;
      return `<section class="card"><h2><span>${d.d}</span><small>${d.wd}</small></h2>
        <div class="cnt"><span>${votes(n)} · ${pct}%</span>${n && n === max ? '<span class="top">Populārākais</span>' : ''}</div>
        <span class="bar"><i style="width:${pct}%"></i></span>
        ${n ? `<ul class="names">${list.map(r => `<li>${esc(r.name)}</li>`).join('')}</ul>` : '<p class="empty">Vēl neviens nav izvēlējies šo datumu.</p>'}</section>`;
    }).join('');
  }

  async function load(){
    const number = ++requestNumber;
    const cfg = window.THEME_POLL_CONFIG || {};
    $('refresh').disabled = true;
    $('res').setAttribute('aria-busy', 'true');
    try {
      if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(cfg.supabaseUrl || '') || !cfg.publishableKey) throw new Error('not configured');
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/get_gaisma_results', {
        method: 'POST',
        headers: {apikey: cfg.publishableKey, 'Content-Type': 'application/json'},
        body: '{}',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) throw new Error('Results unavailable');
      const data = await r.json();
      if (number !== requestNumber) return;
      if (!Array.isArray(data)) throw new Error('Unexpected response');
      paint(data.filter(x => x && typeof x.name === 'string' && typeof x.date_id === 'string'));
      loaded = true;
      $('msg').className = 'msg';
      $('msg').textContent = 'Atjaunots ' + new Date().toLocaleTimeString('lv', {hour: '2-digit', minute: '2-digit'}) + '. Atjaunojas ik pēc minūtes.';
    } catch {
      if (number !== requestNumber) return;
      $('msg').className = 'msg err';
      $('msg').textContent = 'Neizdevās ielādēt rezultātus. Lūdzu, nospied „Atjaunot”.';
      if (!loaded) $('res').innerHTML = '<p class="empty">Rezultāti šobrīd nav pieejami.</p>';
    } finally {
      if (number === requestNumber){ $('refresh').disabled = false; $('res').setAttribute('aria-busy', 'false'); }
    }
  }

  $('refresh').addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden && !$('refresh').disabled) load(); }, 60000);
  load();
})();
