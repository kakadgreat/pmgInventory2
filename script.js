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
    cats.forEach(c=>bar.insertAdjacentHTML('beforeend',`<button class="btn${(cat&&cat.toLowerCase()===c.toLowerCase())?' primary':''}" data-cat="$
