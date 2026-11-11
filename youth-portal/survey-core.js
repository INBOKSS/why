/* Kopīgais kods aptaujai (index.html) un statistikas panelim (stats/index.html):
   sadaļas, teksti, aggregate() un datu glabāšana.
   Glabāšana: Supabase (ja config.js ir aizpildīts) -> lokālais serveris (server.js) -> localStorage. */
(function (global) {
  /* ====== KONFIGURĀCIJA (te var mainīt tekstus, sadaļas un idejas) ====== */
  const SECTIONS = [
    {id:'top',     title:'Augša: laiks un dzimšanas dienas', sub:'Laika ziņa un draugu dzimšanas dienas',   h:133},
    {id:'email',   title:'E-pasts',                          sub:'Pēdējās vēstules un ātrās pogas',         h:383},
    {id:'game',    title:'Dienas spēle',                     sub:'Vārdu mīkla katru dienu',                  h:486, dislike:['Spēles man neinteresē'], like:['Gribu spēlēt katru dienu']},
    {id:'offers',  title:'Sponsoru piedāvājumi',             sub:'Atlaides un kodi jauniešiem',             h:290, dislike:['Par daudz reklāmas'], like:['Atlaides ir foršas']},
    {id:'opps',    title:'Iespējas tev',                     sub:'Prakses, darbs, stipendijas, pasākumi',    h:328, like:['Palīdz atrast darbu/praksi']},
    {id:'ad',      title:'Reklāmas baneris',                 sub:'Reklāma starp sadaļām',                    h:166, dislike:['Reklāma traucē'], like:['Neuzbāzīga']},
    {id:'widgets', title:'Logrīki un Premium',               sub:'Faili, CV un Inbox Premium',               h:384},
    {id:'news',    title:'Ziņas',                            sub:'Ziņu plūsma ar kategorijām',               h:589, dislike:['Ziņas neinteresē'], like:['Labi, ka ziņas ir te']},
  ];
  const TAGS = {
    like:    ['Izskatās labi','Noderīgi man','Viegli saprast','Gribu to lietot'],
    ok:      ['Neko īpašu','Nezinu, vai lietošu','Var labāk','Pietrūkst kaut kā'],
    dislike: ['Nesaprotu, kas tas','Man to nevajag','Izskatās slikti','Par pārblīvētu','Grūti lietot'],
  };
  const Q = {like:'Kas tieši patīk? 😍', ok:'Kas varētu būt labāk? 🤔', dislike:'Kas nepatīk? 😬'};
  const VOTES = [
    {v:'like',    e:'😍', t:'Patīk'},
    {v:'ok',      e:'😐', t:'Normāli'},
    {v:'dislike', e:'👎', t:'Nepatīk'},
  ];
  const IDEAS = [
    ['🌙','Tumšais režīms'],['🎮','Vairāk spēļu'],['🎵','Mūzika un podkasti'],['📅','Kalendārs'],
    ['🤖','Integrēts AI palīgs labākai digitālajai ikdienai'],['💬','Čats ar draugiem'],
    ['🎟️','Pasākumu biļetes'],['📰','Personalizētas ziņas'],['📝','CV un dokumentu šabloni'],
    ['📣','Atgriezeniskās saites poga'],['🏫','Sasaiste ar skolas portāliem (E-klase, Moodle u.c.)'],
  ];
  const SCALE = ['😖','😕','😐','🙂','🤩'];
  const AGES = ['līdz 15','16-18','19-24','25+'];
  const MAX_IDEAS = 3;
  /* ====================================================================== */

  const CFG = global.YOUTH_CFG || {};
  const hasSB = !!(CFG.supabaseUrl && CFG.supabaseKey);

  const LS = {
    get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch{ return d; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} },
    del(k){ try{ localStorage.removeItem(k); }catch{} },
  };

  /* ---------- Supabase (tikai RPC funkcijas, skat. db/youth.sql) ---------- */
  async function rpc(fn, body){
    const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {'Content-Type':'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey},
      body: JSON.stringify(body || {}),
    });
    if(!r.ok){ const e = new Error('rpc ' + fn + ' ' + r.status); e.status = r.status; throw e; }
    const t = await r.text(); return t ? JSON.parse(t) : null;
  }
  const permanent = (e) => e && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;

  const toPayload = (r) => ({device: r.device, age: r.age, overall: r.overall, ideas: r.ideas, comment: r.comment, sections: r.sections});

  async function flushPending(){
    if(!hasSB) return;
    const q = LS.get('inbox_fb_pending', []); if(!q.length) return;
    const rest = [];
    for(const p of q){ try{ await rpc('submit_youth_feedback', {p}); }catch(e){ if(!permanent(e)) rest.push(p); } }
    rest.length ? LS.set('inbox_fb_pending', rest) : LS.del('inbox_fb_pending');
  }

  /* Atbild: 'supabase' | 'queued' (nav tīkla, nosūtīs vēlāk) | 'error' | 'server' | 'local' */
  async function submit(resp){
    if(hasSB){
      try{ await rpc('submit_youth_feedback', {p: toPayload(resp)}); flushPending(); return 'supabase'; }
      catch(e){
        if(permanent(e)) return 'error';
        const q = LS.get('inbox_fb_pending', []); q.push(toPayload(resp)); LS.set('inbox_fb_pending', q); return 'queued';
      }
    }
    try{
      const r = await fetch(store.apiBase + 'api/feedback', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(resp)});
      if(!r.ok) throw new Error(r.status);
      return 'server';
    }catch{
      const all = LS.get('inbox_fb_responses', []); all.push(resp); LS.set('inbox_fb_responses', all);
      return 'local';
    }
  }

  /* Vienādo dažādu avotu ierakstu formu. Supabase piezīmes glabā atsevišķi (notes). */
  function normalize(r){
    const notes = r.notes || {}, sections = {};
    for(const [id, a] of Object.entries(r.sections || {})) sections[id] = {...a, tags: Array.isArray(a.tags) ? a.tags : [], note: a.note || notes[id] || ''};
    return {id: r.id, ts: r.ts || r.created_at, device: r.device, age: r.age, overall: r.overall,
            ideas: Array.isArray(r.ideas) ? r.ideas : [], comment: r.comment || '', sections};
  }

  /* Publiskie dati: bez brīvā teksta. */
  async function loadPublic(){
    if(hasSB){ try{ return {list: (await rpc('youth_public')).map(normalize), mode:'supabase', admin:false}; }catch{} }
    try{
      const r = await fetch(store.apiBase + 'api/responses'); if(!r.ok) throw new Error(r.status);
      return {list: (await r.json()).responses.map(normalize), mode:'server', admin:false};
    }catch{
      return {list: LS.get('inbox_fb_responses', []).map(normalize), mode:'local', admin:true};
    }
  }
  /* Pilni dati ar komentāriem. Met kļūdu 'forbidden', ja atslēga nav pareiza. */
  async function loadAdmin(key){
    if(hasSB){
      try{ return {list: (await rpc('youth_admin', {p_key: key})).map(normalize), mode:'supabase', admin:true}; }
      catch(e){ if(e.status === 400 || e.status === 401 || e.status === 403) throw new Error('forbidden'); throw e; }
    }
    try{
      const r = await fetch(store.apiBase + 'api/responses?key=' + encodeURIComponent(key)); if(!r.ok) throw new Error(r.status);
      const j = await r.json(); if(!j.admin) throw new Error('forbidden');
      return {list: j.responses.map(normalize), mode:'server', admin:true};
    }catch(e){
      if(e.message === 'forbidden') throw e;
      return {list: LS.get('inbox_fb_responses', []).map(normalize), mode:'local', admin:true};
    }
  }
  const store = {apiBase: '', hasSB, submit, loadPublic, loadAdmin, flushPending};

  function aggregate(list){
    const out = {n: list.length, sections:{}, ideas:{}, overall:{sum:0, n:0}};
    SECTIONS.forEach(s => out.sections[s.id] = {like:0, ok:0, dislike:0, tags:{like:{}, ok:{}, dislike:{}}});
    list.forEach(r => {
      SECTIONS.forEach(s => {
        const a = r.sections?.[s.id]; if(!a?.vote) return;
        const o = out.sections[s.id]; if(!['like','ok','dislike'].includes(a.vote)) return;
        o[a.vote]++; (a.tags || []).forEach(t => o.tags[a.vote][t] = (o.tags[a.vote][t] || 0) + 1);
      });
      (r.ideas || []).forEach(t => out.ideas[t] = (out.ideas[t] || 0) + 1);
      if(r.overall){ out.overall.sum += r.overall; out.overall.n++; }
    });
    return out;
  }

  const lv = (n, one, many) => (n % 10 === 1 && n % 100 !== 11) ? one : many;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const topN = (obj, k=2) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,k);

  global.Survey = {SECTIONS, TAGS, Q, VOTES, IDEAS, SCALE, AGES, MAX_IDEAS, LS, store, aggregate, lv, esc, topN};
})(window);
