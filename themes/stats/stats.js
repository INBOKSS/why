(() => {
  'use strict';
  const families=['Blue','Pink','Green','Warm'];
  const ages={under_18:'Under 18','18_24':'18–24','25_34':'25–34','35_44':'35–44','45_54':'45–54','55_64':'55–64','65_plus':'65+',not_shared:'Not shared'};
  const genders={woman:'Woman',man:'Man',other:'Other',not_shared:'Not shared'};
  const el=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data,requestNumber=0;
  for(const [id,labels] of [['age',ages],['gender',genders]])for(const [value,label] of Object.entries(labels)){const o=document.createElement('option');o.value=value;o.textContent=label;el(id).append(o);}
  function rank(group,family){return data.catalog.filter(c=>c.family===family).map(c=>({...c,count:group.theme_counts[c.id]||0})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));}
  function leaders(group,family){const r=rank(group,family),n=r[0]?.count;if(!n)return 'No selections';return r.filter(c=>c.count===n).map(c=>'<span class="leader">'+esc(c.name)+' <strong>'+n+'/'+group.submissions+'</strong> ('+(n/group.submissions*100).toFixed(1)+'%)</span>').join('');}
  function table(kind){const groups=data.groups.filter(g=>g.kind===kind);if(!groups.length)return '<div class="empty">No submissions match these filters.</div>';return '<table><thead><tr><th>Group</th><th>Submissions</th><th>Browsers</th>'+families.map(f=>'<th>'+f+' · leaders</th>').join('')+'</tr></thead><tbody>'+groups.map(g=>{const label=kind==='age'?ages[g.age_group]:kind==='gender'?genders[g.gender]:ages[g.age_group]+' · '+genders[g.gender];return '<tr><td>'+esc(label)+'</td><td>'+g.submissions+'</td><td>'+g.browsers+'</td>'+families.map(f=>'<td>'+leaders(g,f)+'</td>').join('')+'</tr>';}).join('')+'</tbody></table>';}
  function render(){const group=data.groups.find(g=>g.kind==='summary')||{submissions:0,browsers:0,theme_counts:{}};
    el('total').textContent=data.totals.submissions;el('browsers').textContent=data.totals.browsers;el('repeats').textContent=data.totals.additional_submissions;el('selected').textContent=group.submissions;
    el('rankings').innerHTML=families.map(f=>'<div class="family"><div class="family-head"><h3>'+f+'</h3><span>12 themes</span></div>'+rank(group,f).map(c=>{const p=group.submissions?c.count/group.submissions*100:0;return '<div class="theme"><span class="swatch" style="background:#'+c.hex+'" title="#'+c.hex+'"></span><div class="theme-name">'+esc(c.name)+'<div class="bar"><div class="fill" style="width:'+p+'%"></div></div></div><div class="score">'+c.count+'<span class="pct">'+(group.submissions?p.toFixed(1)+'%':'—')+'</span></div></div>';}).join('')+'</div>').join('');
    for(const [kind,target] of [['age','age-table'],['gender','gender-table'],['joint','joint-table']])el(target).innerHTML=table(kind);
    el('snapshot').textContent='Updated: '+new Date(data.generated_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})+' · your local time';
  }
  async function load(){const number=++requestNumber;el('refresh').disabled=true;el('status').textContent='Loading current results…';el('results').setAttribute('aria-busy','true');el('results').hidden=true;el('selected').textContent='—';
    try{const config=window.THEME_POLL_CONFIG||{};const response=await fetch(config.supabaseUrl+'/rest/v1/rpc/get_theme_stats',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({p_method:el('method').value,p_age:el('age').value,p_gender:el('gender').value}),cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Statistics unavailable');const next=await response.json();if(number!==requestNumber)return;data=next;render();el('results').hidden=false;el('status').textContent='Current results loaded. Refreshes every minute while this page is open.';
    }catch{if(number!==requestNumber)return;el('results').hidden=true;el('status').textContent='Could not load current results. Please try Refresh. No results are shown for these filters.';
    }finally{if(number===requestNumber){el('refresh').disabled=false;el('results').setAttribute('aria-busy','false');}}
  }
  for(const id of ['method','age','gender'])el(id).addEventListener('change',load);
  el('refresh').addEventListener('click',load);el('reset').addEventListener('click',()=>{for(const id of ['method','age','gender'])el(id).value='all';load();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});setInterval(()=>{if(!document.hidden&&!el('refresh').disabled)load();},60000);load();
})();
