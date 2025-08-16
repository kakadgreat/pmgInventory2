// ========= topbar / mobile menu =========
(() => {
  const topbar = document.getElementById('topbar'); if (!topbar) return;
  let last = 0;
  addEventListener('scroll', () => {
    const y = scrollY || 0;
    if (y > 16 && y > last) topbar.classList.add('shrink'); else if (y < 8) topbar.classList.remove('shrink');
    last = y;
  });
  const b = document.getElementById('hamburger'), nav = document.getElementById('nav');
  const close = () => { nav?.classList.remove('open'); b?.setAttribute('aria-expanded','false'); };
  b?.addEventListener('click', () => { const open = nav.classList.toggle('open'); b.setAttribute('aria-expanded', String(open)); });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { if (getComputedStyle(b).display !== 'none') close(); }));
})();

// ========= fallbacks (so dropdowns never empty) =========
const FALLBACK_LOCATIONS = [
  "Jasper Primary Care","Jasper Pediatrics","Jasper MedSpa",
  "Roswell Primary Care","Roswell MedSpa",
  "Canton Primary Care","Canton Pediatrics","Canton MedSpa",
  "Rome Primary Care","Rome MedSpa"
];
const FALLBACK_TEAMS = [
  "PROVIDERS","FRONT OFFICE","BILLING","ADMINISTRATION","MA",
  "PEDIATRICS","SPA","CALL CENTER","IT","LEADERSHIP"
];

// ========= shared helpers =========
async function loadCfg(){
  try{ const r=await fetch('/.netlify/functions/config'); if(r.ok) return await r.json(); }catch{}
  return { categories:[], locations:FALLBACK_LOCATIONS, teams:FALLBACK_TEAMS };
}
async function loadInventory(){ try{ const r=await fetch('/.netlify/functions/inventory',{cache:'no-store'}); if(r.ok){ const d=await r.json(); if(Array.isArray(d)) return d; } }catch{} return await (await fetch('/assets/inventory.json',{cache:'no-store'})).json(); }
async function loadDirectory(){ const r=await fetch('/.netlify/functions/directory',{cache:'no-store'}); return r.ok? await r.json(): []; }

function slug(s){ return String(s||'').toLowerCase().normalize('NFKD').replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,''); }
function groupBy(xs, key){ return xs.reduce((a,x)=>((a[x[key]||'']=(a[x[key]||'']||[]).concat(x)),a),{}); }
function asBadge(text, cls=''){ const t=String(text||'').trim(); return t?`<span class="badge ${cls}">${t}</span>`:''; }
function setActive(el,on){ if(!el) return; el.classList.toggle('active-filter',!!on); }
function setOpts(sel,arr,label){ if(!sel) return; sel.innerHTML=label?`<option value="">${label}</option>`:''; [...new Set(arr.filter(Boolean))].sort().forEach(v=>sel.insertAdjacentHTML('beforeend',`<option>${v}</option>`)); }
function tokenizeTeams(s){ return String(s||'').split(',').map(t=>t.trim()).filter(Boolean); }

// ========= inventory cards (unchanged) =========
function renderCards(list, mount){
  const el=document.getElementById(mount); if(!el) return; el.innerHTML='';
  if(!Array.isArray(list)||!list.length){ el.insertAdjacentHTML('beforeend','<div class="small">No items found.</div>'); return; }
  list.forEach(x=>{
    const user=x.user||x.user_name||''; const w=(x.warranty_status||'').toLowerCase();
    const wBadge=w?asBadge(x.warranty_status, w==='active'?'ok':'bad'):''; const tags=[x.brand,x.model,x.os].filter(Boolean).map(asBadge).join(' ');
    el.insertAdjacentHTML('beforeend',`
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
          <h3>${x.title||'-'}</h3>
          <a class="btn" href="admin/edit.html?slug=${encodeURIComponent(x.slug||'')}">Edit</a>
        </div>
        <div class="row">${tags} ${wBadge}</div>
        <div class="kv">
          <div class="marker">Category</div><div>${x.category||'-'}</div>
          <div class="marker">User</div><div>${user||'-'}</div>
          <div class="marker">Location</div><div>${x.location||'-'}</div>
          <div class="marker">Dept</div><div>${x.dept||'-'}</div>
          <div class="marker">OS</div><div>${x.os||'-'}</div>
          <div class="marker">CPU/RAM/Storage</div><div>${[x.cpu,x.ram,x.storage].filter(Boolean).join(' / ')||'-'}</div>
          <div class="marker">Asset / Serial</div><div>${[x.asset_tag,x.serial].filter(Boolean).join(' / ')||'-'}</div>
          <div class="marker">Status</div><div>${x.status||'-'}</div>
          <div class="marker">Warranty Expires</div><div>${x.warranty_expires||'-'}</div>
        </div>
      </div>`);
  });
}

// ========= index =========
async function initIndex(){
  const data=await loadInventory(); const byCat=groupBy(data,'category'); const cats=Object.keys(byCat).sort().filter(Boolean);
  const list=document.getElementById('categoryList');
  if(list){ if(!cats.length) list.insertAdjacentHTML('beforeend','<span class="small">No categories found.</span>');
    else cats.forEach(c=>list.insertAdjacentHTML('beforeend',`<a class="btn" href="list.html?cat=${encodeURIComponent(c)}">${c} (${(byCat[c]||[]).length})</a>`)); }
  renderCards((data||[]).slice(0,12),'recent');
}

// ========= list (inventory) =========
async function initList(){
  const p=new URLSearchParams(location.search); let cat=p.get('cat')||'';
  const [data,cfg]=await Promise.all([loadInventory(),loadCfg()]);
  const byCat=groupBy(data,'category'); const cats=(cfg.categories?.length?cfg.categories:Object.keys(byCat)).filter(Boolean);
  const bar=document.getElementById('categoryBar');
  if(bar){ bar.innerHTML=''; bar.insertAdjacentHTML('beforeend',`<button class="btn${cat?'':' primary'}" data-cat="">All</button>`);
    cats.forEach(c=>bar.insertAdjacentHTML('beforeend',`<button class="btn${(cat&&cat.toLowerCase()===c.toLowerCase())?' primary':''}" data-cat="${c}">${c} (${(byCat[c]||[]).length})</button>`));
    bar.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{cat=b.dataset.cat||''; bar.querySelectorAll('button').forEach(x=>x.classList.remove('primary')); b.classList.add('primary'); const h=document.getElementById('heading'); if(h) h.textContent=cat||'All Inventory'; history.replaceState({},'',cat?`?cat=${encodeURIComponent(cat)}`:'list.html'); run(); })); }
  const q=document.getElementById('q'), locSel=document.getElementById('loc'), deptSel=document.getElementById('dept'), catSel=document.getElementById('cat'), wSel=document.getElementById('wstat');
  const h=document.getElementById('heading'); if(h) h.textContent=cat||'All Inventory';
  setOpts(locSel, cfg.locations?.length?cfg.locations:FALLBACK_LOCATIONS, 'All locations');
  setOpts(deptSel, data.map(x=>x.dept), 'All depts');
  setOpts(catSel, cats, 'All categories');
  setOpts(wSel, ['Active','Deactivated'], 'Any warranty');
  const run=()=>{ const text=(q?.value||'').toLowerCase(), loc=locSel?.value||'', dept=deptSel?.value||'', catDrop=catSel?.value||'', w=wSel?.value||'';
    setActive(q,!!text); setActive(locSel,!!loc); setActive(deptSel,!!dept); setActive(catSel,!!catDrop); setActive(wSel,!!w);
    let filtered=data; if(cat) filtered=filtered.filter(x=>(x.category||'').toLowerCase()===cat.toLowerCase()); if(catDrop) filtered=filtered.filter(x=>(x.category||'').toLowerCase()===catDrop.toLowerCase()); if(loc) filtered=filtered.filter(x=>(x.location||'')===loc); if(dept) filtered=filtered.filter(x=>(x.dept||'')===dept); if(w) filtered=filtered.filter(x=>(x.warranty_status||'').toLowerCase()===w.toLowerCase());
    if(text) filtered=filtered.filter(x=>{ const hay=[x.title,x.brand,x.model,(x.user||x.user_name||''),x.os,x.asset_tag,x.serial,x.location,x.dept].join(' ').toLowerCase(); return hay.includes(text); });
    renderCards(filtered,'results'); };
  [q,locSel,deptSel,catSel,wSel].forEach(el=>el?.addEventListener('input',run)); locSel?.addEventListener('change',run); deptSel?.addEventListener('change',run); catSel?.addEventListener('change',run); wSel?.addEventListener('change',run); run();
}

// ========= PHONE DIRECTORY =========
function renderPhoneCards(list, mount){
  const el=document.getElementById(mount); if(!el) return; el.innerHTML='';
  if(!Array.isArray(list)||!list.length){ el.insertAdjacentHTML('beforeend','<div class="small">No entries found.</div>'); return; }
  list.forEach(x=>{
    const status=(x.status||'').toLowerCase(); const sBadge=status?asBadge(x.status, status==='active'?'ok':'bad'):'';
    const teamB = asBadge(x.team||''); const roleB = asBadge(x.role||''); const locB  = asBadge(x.location||'');
    const phone = x.direct_phone || x.extension || ''; const tel   = phone ? `<a class="btn" href="tel:${phone}">Call</a>` : '';
    const email = x.email ? `<a class="btn" href="mailto:${x.email}">Email</a>` : '';
    el.insertAdjacentHTML('beforeend', `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
          <h3>${x.name || '-'}</h3>
        </div>
        <div class="row">${teamB} ${roleB} ${locB} ${sBadge}</div>
        <div class="kv">
          <div class="marker">Extension</div><div>${x.extension || '-'}</div>
          <div class="marker">Direct</div><div>${x.direct_phone || '-'}</div>
          <div class="marker">Mobile</div><div>${x.mobile || '-'}</div>
          <div class="marker">Email</div><div>${x.email || '-'}</div>
        </div>
        <div class="row" style="margin-top:.4rem">${tel} ${email}</div>
      </div>
    `);
  });
}

function buildChips(mountId, values, onChange){
  const mount=document.getElementById(mountId); if(!mount) return ()=>{};
  const sel = new Set();
  const render=()=>{ mount.innerHTML=''; values.forEach(v=>{ const a=document.createElement('span'); a.className='chip'+(sel.has(v)?' active':''); a.textContent=v; a.onclick=()=>{ sel.has(v)?sel.delete(v):sel.add(v); render(); onChange([...sel]); }; mount.appendChild(a); }); };
  render(); return ()=>[...sel];
}

async function initPhoneDirectory(){
  const [data, cfg]=await Promise.all([loadDirectory(), loadCfg()]);
  const TEAMS = (cfg.teams && cfg.teams.length) ? cfg.teams : FALLBACK_TEAMS;
  setOpts(document.getElementById('loc_phone'), (cfg.locations&&cfg.locations.length?cfg.locations:FALLBACK_LOCATIONS), 'All locations');

  const getSelectedTeams = buildChips('teamChips', TEAMS, run);

  const q=document.getElementById('q_phone');
  const l=document.getElementById('loc_phone');
  const s=document.getElementById('status_phone');

  function run(){
    const text=(q?.value||'').toLowerCase(), loc=l?.value||'', stat=s?.value||'';
    const teamsSel = new Set(getSelectedTeams());
    setActive(q,!!text); setActive(l,!!loc); setActive(s,!!stat);
    let filtered = data;
    if (teamsSel.size){
      filtered = filtered.filter(x=>{
        const tokens = tokenizeTeams(x.team);
        for (const t of teamsSel) if (tokens.map(z=>z.toLowerCase()).includes(t.toLowerCase())) return true;
        return false;
      });
    }
    if(loc)  filtered = filtered.filter(x => (x.location||'') === loc);
    if(stat) filtered = filtered.filter(x => (x.status||'').toLowerCase() === stat.toLowerCase());
    if(text) filtered = filtered.filter(x => (`${x.name} ${x.email} ${x.extension} ${x.direct_phone} ${x.mobile} ${x.role} ${x.team} ${x.location}`.toLowerCase().includes(text)));
    renderPhoneCards(filtered,'phone_results');
  }
  [q,l,s].forEach(el=>el?.addEventListener('input', run));
  l?.addEventListener('change', run); s?.addEventListener('change', run);
  run();
}

// ========= Locations page =========
async function initLocations(){
  const data = await loadInventory();
  const byLoc = groupBy(data, 'location');
  const wrap = document.getElementById('locations');
  const locs = Object.keys(byLoc).sort();
  if (locs.length === 0) { wrap?.insertAdjacentHTML('beforeend', `<div class="small">No locations found.</div>`); return; }
  locs.forEach(loc => {
    const id = `loc-${slug(loc)}`;
    wrap.insertAdjacentHTML('beforeend', `
      <section class="pill">
        <h2>${loc || 'Unspecified'}</h2>
        <div class="grid" id="${id}"></div>
      </section>
    `);
    renderCards(byLoc[loc], id);
  });
}
