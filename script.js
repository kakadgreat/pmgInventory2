// ========= topbar / mobile menu (unchanged) =========
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

// ========= shared helpers =========
async function loadCfg(){ try{ const r=await fetch('/.netlify/functions/config'); if(r.ok) return await r.json(); }catch{} return await (await fetch('assets/config.json',{cache:'no-store'})).json(); }
async function loadInventory(){ try{ const r=await fetch('/.netlify/functions/inventory',{cache:'no-store'}); if(r.ok){ const d=await r.json(); if(Array.isArray(d)) return d; } }catch{} return await (await fetch('/assets/inventory.json',{cache:'no-store'})).json(); }
function slug(s){ return String(s||'').toLowerCase().normalize('NFKD').replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,''); }
function groupBy(xs, key){ return xs.reduce((a,x)=>((a[x[key]||'']=(a[x[key]||'']||[]).concat(x)),a),{}); }
function asBadge(text, cls=''){ const t=String(text||'').trim(); return t?`<span class="badge ${cls}">${t}</span>`:''; }
function setActive(el,on){ if(!el) return; el.classList.toggle('active-filter',!!on); }

// ========= cards: inventory (unchanged) =========
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

// ========= index (unchanged) =========
async function initIndex(){
  const data=await loadInventory(); const byCat=groupBy(data,'category'); const cats=Object.keys(byCat).sort().filter(Boolean);
  const list=document.getElementById('categoryList');
  if(list){ if(!cats.length) list.insertAdjacentHTML('beforeend','<span class="small">No categories found.</span>');
    else cats.forEach(c=>list.insertAdjacentHTML('beforeend',`<a class="btn" href="list.html?cat=${encodeURIComponent(c)}">${c} (${(byCat[c]||[]).length})</a>`)); }
  renderCards((data||[]).slice(0,12),'recent');
}

// ========= list (unchanged from your last good version) =========
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
  const setOpts=(sel,arr,label)=>{ if(!sel) return; sel.innerHTML=label?`<option value="">${label}</option>`:''; Array.from(new Set(arr.filter(Boolean))).sort().forEach(v=>sel.insertAdjacentHTML('beforeend',`<option value="${v}">${v}</option>`)); };
  setOpts(locSel,cfg.locations?.length?cfg.locations:data.map(x=>x.location),'All locations'); setOpts(deptSel,data.map(x=>x.dept),'All depts'); setOpts(catSel,cats,'All categories'); setOpts(wSel,['Active','Deactivated'],'Any warranty');
  const run=()=>{ const text=(q?.value||'').toLowerCase(), loc=locSel?.value||'', dept=deptSel?.value||'', catDrop=catSel?.value||'', w=wSel?.value||'';
    setActive(q,!!text); setActive(locSel,!!loc); setActive(deptSel,!!dept); setActive(catSel,!!catDrop); setActive(wSel,!!w);
    let filtered=data; if(cat) filtered=filtered.filter(x=>(x.category||'').toLowerCase()===cat.toLowerCase()); if(catDrop) filtered=filtered.filter(x=>(x.category||'').toLowerCase()===catDrop.toLowerCase()); if(loc) filtered=filtered.filter(x=>(x.location||'')===loc); if(dept) filtered=filtered.filter(x=>(x.dept||'')===dept); if(w) filtered=filtered.filter(x=>(x.warranty_status||'').toLowerCase()===w.toLowerCase());
    if(text) filtered=filtered.filter(x=>{ const hay=[x.title,x.brand,x.model,(x.user||x.user_name||''),x.os,x.asset_tag,x.serial,x.location,x.dept].join(' ').toLowerCase(); return hay.includes(text); });
    renderCards(filtered,'results'); };
  [q,locSel,deptSel,catSel,wSel].forEach(el=>el?.addEventListener('input',run)); locSel?.addEventListener('change',run); deptSel?.addEventListener('change',run); catSel?.addEventListener('change',run); wSel?.addEventListener('change',run); run();
}

// ========= PHONE DIRECTORY =========
async function loadDirectory(){ const r=await fetch('/.netlify/functions/directory',{cache:'no-store'}); return r.ok? await r.json(): []; }

function renderPhoneCards(list, mount){
  const el=document.getElementById(mount); if(!el) return; el.innerHTML='';
  if(!Array.isArray(list)||!list.length){ el.insertAdjacentHTML('beforeend','<div class="small">No entries found.</div>'); return; }
  list.forEach(x=>{
    const status=(x.status||'').toLowerCase(); const sBadge=status?asBadge(x.status, status==='active'?'ok':'bad'):'';
    const teamB = asBadge(x.team||'');
    const roleB = asBadge(x.role||'');
    const locB  = asBadge(x.location||'');
    const phone = x.direct_phone || x.extension || '';
    const tel   = phone ? `<a class="btn" href="tel:${phone}">Call</a>` : '';
    const email = x.email ? `<a class="btn" href="mailto:${x.email}">Email</a>` : '';

    el.insertAdjacentHTML('beforeend', `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
          <h3>${x.name || '-'}</h3>
          <!-- no edit link from public directory -->
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

async function initPhoneDirectory(){
  const [data, cfg] = await Promise.all([loadDirectory(), loadCfg()]);
  const q  = document.getElementById('q_phone');
  const l  = document.getElementById('loc_phone');
  const t  = document.getElementById('team_phone');
  const s  = document.getElementById('status_phone');
  const set = (sel, arr, label) => { if(!sel) return; sel.innerHTML = label?`<option value="">${label}</option>`:''; Array.from(new Set(arr.filter(Boolean))).sort().forEach(v => sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`)); };
  set(l, cfg.locations?.length ? cfg.locations : data.map(x=>x.location), 'All locations');
  set(t, cfg.teams?.length ? cfg.teams : data.map(x=>x.team), 'All teams');
  set(s, Array.from(new Set(data.map(x=>x.status).filter(Boolean))).sort(), 'Any status');

  const run = () => {
    const text=(q?.value||'').toLowerCase(), loc=l?.value||'', team=t?.value||'', stat=s?.value||'';
    setActive(q,!!text); setActive(l,!!loc); setActive(t,!!team); setActive(s,!!stat);
    let filtered = data;
    if(loc)  filtered = filtered.filter(x => (x.location||'') === loc);
    if(team) filtered = filtered.filter(x => (x.team||'').toLowerCase() === team.toLowerCase());
    if(stat) filtered = filtered.filter(x => (x.status||'').toLowerCase() === stat.toLowerCase());
    if(text) filtered = filtered.filter(x => {
      const hay = `${x.name} ${x.email} ${x.extension} ${x.direct_phone} ${x.mobile} ${x.role} ${x.team} ${x.location}`.toLowerCase();
      return hay.includes(text);
    });
    renderPhoneCards(filtered, 'phone_results');
  };
  [q,l,t,s].forEach(el => el?.addEventListener('input', run));
  l?.addEventListener('change', run); t?.addEventListener('change', run); s?.addEventListener('change', run);
  run();
}
