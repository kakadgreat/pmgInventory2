// header + shrink on scroll + mobile menu
(() => {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;
  let last = 0;
  addEventListener('scroll', () => { const y = scrollY||0; if (y>16 && y>last) topbar.classList.add('shrink'); else if (y<8) topbar.classList.remove('shrink'); last = y; });
  const b = document.getElementById('hamburger'); const nav = document.getElementById('nav');
  const close = () => { nav?.classList.remove('open'); b?.setAttribute('aria-expanded','false'); };
  b?.addEventListener('click', () => { const open = nav.classList.toggle('open'); b.setAttribute('aria-expanded', String(open)); });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { if(getComputedStyle(b).display!=='none') close(); }));
})();

// fetch inventory JSON
async function loadInventory(){
  try {
    const r = await fetch('/.netlify/functions/inventory');
    if(r.ok){ return await r.json(); }
  } catch(e) {}
  const res = await fetch('assets/inventory.json');
  return await res.json();
}
function slug(s){ return String(s||'').toLowerCase().normalize('NFKD').replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,''); }

function groupBy(xs, key){ return xs.reduce((acc,x) => (acc[x[key]||''] = (acc[x[key]||'']||[]).concat(x), acc), {}); }

function renderCards(list, mount){
  const el = document.getElementById(mount);
  if(!el) return;
  el.innerHTML = '';
  list.forEach(x => {
    const tags = [x.brand, x.model, x.os].filter(Boolean).map(t=>`<span class="badge">${t}</span>`).join(' ');
    el.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h3>${x.title}</h3>
        <div class="row">${tags}</div>
        <div class="kv">
          <div class="marker">Category</div><div>${x.category||'-'}</div>
          <div class="marker">User</div><div>${x.user||'-'}</div>
          <div class="marker">Location</div><div>${x.location||'-'}</div>
          <div class="marker">OS</div><div>${x.os||'-'}</div>
          <div class="marker">CPU/RAM/Storage</div><div>${[x.cpu,x.ram,x.storage].filter(Boolean).join(' / ')||'-'}</div>
          <div class="marker">Asset / Serial</div><div>${[x.asset_tag, x.serial].filter(Boolean).join(' / ')||'-'}</div>
          <div class="marker">Status</div><div>${x.status||'-'}</div>
        </div>
      </div>
    `);
  });
}

async function initIndex(){
  const data = await loadInventory();
  const byCat = groupBy(data, 'category');
  const cats = Object.keys(byCat).sort();
  const list = document.getElementById('categoryList');
  cats.forEach(c => {
    list.insertAdjacentHTML('beforeend', `<a class="btn" href="list.html?cat=${encodeURIComponent(c)}">${c} (${byCat[c].length})</a>`);
  });
  // show a few recent items
  renderCards(data.slice(0,12), 'recent');
}

async function initList(){
  const params = new URLSearchParams(location.search);
  const cat = params.get('cat')||'';
  const data = await loadInventory();
  const filtered = cat? data.filter(x => (x.category||'').toLowerCase() === cat.toLowerCase()) : data;
  document.getElementById('heading').textContent = cat? cat : 'All Inventory';
  const search = document.getElementById('q');
  const locSel = document.getElementById('loc');
  // build locations
  const locs = Array.from(new Set(data.map(x => x.location).filter(Boolean))).sort();
  locs.forEach(l => locSel.insertAdjacentHTML('beforeend', `<option value="${l}">${l}</option>`));
  const run = () => {
    const q = (search.value||'').toLowerCase();
    const loc = locSel.value||'';
    const subset = filtered.filter(x => {
      const hay = [x.title,x.brand,x.model,x.user,x.os,x.asset_tag,x.serial,x.location].join(' ').toLowerCase();
      const okQ = !q or q=='' or hay.includes(q);
      const okL = !loc or (x.location||'')===loc;
      return okQ && okL;
    });
    renderCards(subset, 'results');
  };
  search.addEventListener('input', run); locSel.addEventListener('change', run);
  renderCards(filtered, 'results');
}

async function initLocations(){
  const data = await loadInventory();
  const byLoc = groupBy(data, 'location');
  const wrap = document.getElementById('locations');
  Object.keys(byLoc).sort().forEach(loc => {
    wrap.insertAdjacentHTML('beforeend', `
      <section class="pill">
        <h2>${loc||'Unspecified'}</h2>
        <div class="grid" id="loc-${slug(loc)}"></div>
      </section>`);
    renderCards(byLoc[loc], `loc-${slug(loc)}`);
  });
}
