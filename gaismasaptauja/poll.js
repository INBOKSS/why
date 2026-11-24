(() => {
  'use strict';
  const DATES = [
    {id:'2026-12-06', d:'6. decembris', wd:'svētdiena'},
    {id:'2026-12-13', d:'13. decembris', wd:'svētdiena'},
    {id:'2026-12-20', d:'20. decembris', wd:'svētdiena'},
    {id:'2026-12-27', d:'27. decembris', wd:'svētdiena'}
  ];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const $ = id => document.getElementById(id);
  const norm = s => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('lv');
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch { /* optional convenience */ } }
  };
  // One answer per browser. The id stays in this browser only and is never shown.
  let voterId = store.get('gd-voter');
  if (!UUID.test(voterId || '')){ voterId = crypto.randomUUID(); store.set('gd-voter', voterId); }
  let busy = false;

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
    if (!r.ok){
      let message = '';
      try { message = (await r.json()).message || ''; } catch { /* no body */ }
      const e = new Error(fn + ' ' + r.status); e.serverMessage = message; throw e;
    }
    return r.json();
  }

  // Messages are always set as text; a name can never become markup.
  function setMsg(text, kind){
    const m = $('msg');
    m.textContent = text;
    m.className = 'msg ' + (kind || '');
  }

  // Scalloped garland drawn at the real page width, so the bulbs stay round on any screen.
  let lightsWidth = 0;
  function lights(){
    const W = Math.max(320, Math.round($('lights').clientWidth || 720));
    lightsWidth = W;
    const swags = Math.max(2, Math.round(W / 360)), sw = W / swags;
    const sag = x => 16 + Math.sin(Math.PI * ((x % sw) / sw)) * 34;
    let p = 'M0 ' + sag(0).toFixed(1), b = '', i = 0;
    for (let x = 4; x <= W; x += 4) p += ' L' + x + ' ' + sag(x).toFixed(1);
    for (let s = 0; s < swags; s++){
      for (let k = 1; k <= 5; k++, i++){
        const x = s * sw + k * sw / 6, y = sag(x) + 12, c = ['#ffe9a8','#ff7a59','#bdf2e0'][i % 3];
        b += `<g class="bulb" style="animation-delay:${(i * 0.37 % 3).toFixed(2)}s"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="${c}" opacity=".18"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${c}"/></g>`;
      }
    }
    $('lights').innerHTML = `<svg class="lights" viewBox="0 0 ${W} 90" aria-hidden="true"><path d="${p}" fill="none" stroke="#3d6b6a" stroke-width="1.5"/>${b}</svg>`;
  }
  let lightsTimer;
  window.addEventListener('resize', () => {
    clearTimeout(lightsTimer);
    lightsTimer = setTimeout(() => { if (Math.round($('lights').clientWidth) !== lightsWidth) lights(); }, 150);
  });

  function buildOptions(){
    $('opts').insertAdjacentHTML('beforeend', DATES.map(d =>
      `<label class="opt"><input type="radio" name="date" value="${d.id}"><span><span class="d">${d.d}</span> <span class="wd">${d.wd}</span></span></label>`).join(''));
  }

  // This browser's earlier answer (if any), only to label the button.
  function answered(){ const n = store.get('gd-name'); return !!n && !!store.get('gd-date') && norm($('name').value) === norm(n); }
  function syncButton(){
    $('send').textContent = answered() ? 'Mainīt atbildi' : 'Nosūtīt atbildi';
    $('send').disabled = busy;
  }

  $('f').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const name = $('name').value.trim().replace(/\s+/g, ' ');
    const pick = document.querySelector('input[name=date]:checked');
    if (!name){ setMsg('Lūdzu, ieraksti savu vārdu.', 'err'); $('name').focus(); return; }
    const d = pick && DATES.find(x => x.id === pick.value);
    if (!d){ setMsg('Lūdzu, atzīmē vienu datumu.', 'err'); return; }
    busy = true; syncButton(); setMsg('Saglabāju…');
    try {
      await rpc('submit_gaisma_response', {p_voter_id: voterId, p_name: name, p_date: d.id});
      store.set('gd-name', name); store.set('gd-date', d.id);
      $('name').value = name;
      setMsg('Paldies, ' + name + '! Tava izvēle: ' + d.d + '.', 'ok');
    } catch (err) {
      const s = (err && err.serverMessage) || '';
      if (s === 'Name taken') setMsg('Šis vārds jau ir izmantots citā pārlūkā. Ja tas esi Tu, uzraksti aptaujas veidotājam.', 'err');
      else if (s === 'Too many requests') setMsg('Pārāk daudz mēģinājumu. Lūdzu, pagaidi minūti un mēģini vēlreiz.', 'err');
      else if (s === 'Poll is full') setMsg('Aptauja ir aizvērta.', 'err');
      else setMsg('Neizdevās saglabāt. Lūdzu, mēģini vēlreiz.', 'err');
    } finally { busy = false; syncButton(); }
  });

  $('name').addEventListener('input', syncButton);

  lights();
  buildOptions();
  $('name').value = (store.get('gd-name') || '').slice(0, 60);
  const prev = DATES.find(x => x.id === store.get('gd-date'));
  if (prev){ const r = document.querySelector('input[name=date][value="' + prev.id + '"]'); if (r) r.checked = true; }
  syncButton();
})();
