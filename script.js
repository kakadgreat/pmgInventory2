// header + shrink on scroll + mobile menu
(() => {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;
  let last = 0;
  addEventListener('scroll', () => {
    const y = scrollY || 0;
    if (y > 16 && y > last) topbar.classList.add('shrink');
    else if (y < 8) topbar.classList.remove('shrink');
    last = y;
  });
  const b = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  const close = () => { nav?.classList.remove('open'); b?.setAttribute('aria-expanded','false'); };
  b?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    b.setAttribute('aria-expanded', String(open));
  });
  nav?.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => { if (getComputedStyle(b).display !== 'none') close(); })
  );
})();

// Prefer Netlify Function; fall back to bundled JSON
async function loadInventory() {
  try {
    const r = await fetch('/.netlify/functions/inventory', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data)) return data;
    }
  } catch {}
  const res = await fetch('/assets/inventory.json', { cache: 'no-store' });
  return await res.json();
}

function slug(s){
  return String(s||'').toLowerCase().normalize('NFKD')
    .replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,'');
}
function groupBy(xs, key){
  return xs.reduce((acc,x) => {
    const k = x[key] || '';
    acc[k] = (acc[k] || []).concat(x);
    return acc;
  }, {});
}
function asBadge(text, cls='') {
  const t = String(text||'').trim();
  if (!t) return '';
  return `<span class="badge ${cls}">${t}</span>`;
}

function renderCards(list, mount){
  const el = document.getElementById(mount);
  if (!el) return;
  el.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    el.insertAdjacentHTML('beforeend', `<div class="small">No items found.</div>`);
    return;
  }
  list.forEach(x => {
    const user = x.user || x.user_name || '';
    const w = (x.warranty_status || '').toLowerCase();
    const wBadge = w ? asBadge(x.warranty_status, w === 'active' ? 'ok' : 'bad') : '';
    const tags = [x.brand, x.model, x.os].filter(Boolean).map(t => asBadge(t)).join(' ');
    // show a few extras if present
    const extra = x.extra || {};
    const extraRows = Object.entries(extra).slice(0,6).map(([k,v]) =>
      `<div class="marker">${k}</div><div>${String(v)}</div>`).join('');

    el.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h3>${x.title || '-'}</h3>
        <div class="row">${tags} ${wBadge}</div>
        <div class="kv">
          <div class="marker">Category</div><div>${x.category || '-'}</div>
          <div class="marker">User</div><div>${user || '-'}</div>
          <div class="marker">Location</div><div>${x.location || '-'}</div>
          <div class="marker">Room</div><div>${x.room || '-'}</div>
          <div class="marker">Dept</div><div>${x.dept || '-'}</div>
          <div class="marker">OS</div><div>${x.os || '-'}</div>
          <div class="marker">CPU/RAM/Storage</div>
          <div>${[x.cpu, x.ram, x.storage].filter(Boolean).join(' / ') || '-'}</div>
          <div class="marker">Asset / Serial</div>
          <div>${[x.asset_tag, x.serial].filter(Boolean).join(' / ') || '-'}</div>
          <div class="marker">Status</div><div>${x.status || '-'}</div>
          <div class="marker">Warranty Expires</div><div>${x.warranty_expires || '-'}</div>
          ${extraRows}
        </div>
      </div>
    `);
  });
}

// INDEX
async function initIndex(){
  const data = await loadInventory();
  const byCat = groupBy(data, 'category');
  const cats = Object.keys(byCat).sort().filter(Boolean);
  const list = document.getElementById('categoryList');
  if (list) {
    if (cats.length === 0) list.insertAdjacentHTML('beforeend', `<span class="small">No categories found.</span>`);
    else cats.forEach(c => list.insertAdjacentHTML('beforeend', `<a class="btn" href="list.html?cat=${encodeURIComponent(c)}">${c} (${byCat[c].length})</a>`));
  }
  renderCards((data || []).slice(0, 12), 'recent');
}

// LIST
async function initList(){
  const params = new URLSearchParams(location.search);
  let cat = params.get('cat') || '';
  const data = await loadInventory();

  // Category bar to switch without going home
  const byCat = groupBy(data, 'category');
  const cats = Object.keys(byCat).sort().filter(Boolean);
  const bar = document.getElementById('categoryBar');
  if (bar) {
    bar.innerHTML = '';
    bar.insertAdjacentHTML('beforeend', `<button class="btn${cat?'':' primary'}" data-cat="">All</button>`);
    cats.forEach(c => {
      bar.insertAdjacentHTML('beforeend', `<button class="btn${(cat&&cat.toLowerCase()===c.toLowerCase())?' primary':''}" data-cat="${c}">${c} (${byCat[c].length})</button>`);
    });
    bar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.cat || '';
      // update heading
      const heading = document.getElementById('heading');
      if (heading) heading.textContent = cat ? cat : 'All Inventory';
      run();
      // toggle active style
      bar.querySelectorAll('button').forEach(x => x.classList.remove('primary'));
      b.classList.add('primary');
      history.replaceState({}, '', cat ? `?cat=${encodeURIComponent(cat)}` : 'list.html');
    }));
  }

  const search = document.getElementById('q');
  const locSel = document.getElementById('loc');
  const heading = document.getElementById('heading');
  if (heading) heading.textContent = cat ? cat : 'All Inventory';

  // build locations
  const locs = Array.from(new Set(data.map(x => x.location).filter(Boolean))).sort();
  if (locSel) {
    locSel.innerHTML = '<option value="">All locations</option>';
    locs.forEach(l => locSel.insertAdjacentHTML('beforeend', `<option value="${l}">${l}</option>`));
  }

  const run = () => {
    const q = (search?.value || '').toLowerCase();
    const loc = locSel?.value || '';
    let filtered = cat ? data.filter(x => (x.category || '').toLowerCase() === cat.toLowerCase()) : data;
    filtered = filtered.filter(x => {
      const hay = [x.title,x.brand,x.model,(x.user||x.user_name||''),x.os,x.asset_tag,x.serial,x.location]
        .join(' ').toLowerCase();
      const okQ = (!q || hay.includes(q));
      const okL = (!loc || (x.location || '') === loc);
      return okQ && okL;
    });
    renderCards(filtered, 'results');
  };

  search?.addEventListener('input', run);
  locSel?.addEventListener('change', run);
  run();
}

// LOCATIONS
async function initLocations(){
  const data = await loadInventory();
  const byLoc = groupBy(data, 'location');
  const wrap = document.getElementById('locations');
  const locs = Object.keys(byLoc).sort();
  if (locs.length === 0) {
    wrap?.insertAdjacentHTML('beforeend', `<div class="small">No locations found.</div>`);
    return;
  }
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
