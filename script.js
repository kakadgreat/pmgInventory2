// ========== header: shrink on scroll + mobile menu ==========
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
    a.addEventListener('click', () => {
      if (getComputedStyle(b).display !== 'none') close();
    })
  );
})();

// ========== shared helpers ==========
async function loadCfg(){
  // Try live config (DB/blobs via function); fall back to local file
  try { const r = await fetch('/.netlify/functions/config'); if (r.ok) return await r.json(); } catch {}
  return await (await fetch('assets/config.json', { cache:'no-store' })).json();
}

async function loadInventory() {
  // 1) DB via function
  try {
    const r = await fetch('/.netlify/functions/inventory', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data)) return data;
    }
  } catch {}
  // 2) Fallback JSON
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
  return t ? `<span class="badge ${cls}">${t}</span>` : '';
}
function setActive(el, on) {
  if (!el) return;
  el.classList.toggle('active-filter', !!on);
}

// ========== cards ==========
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

    el.insertAdjacentHTML('beforeend', `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
          <h3>${x.title || '-'}</h3>
          <a class="btn" href="admin/edit.html?slug=${encodeURIComponent(x.slug || '')}">Edit</a>
        </div>
        <div class="row">${tags} ${wBadge}</div>
        <div class="kv">
          <div class="marker">Category</div><div>${x.category || '-'}</div>
          <div class="marker">User</div><div>${user || '-'}</div>
          <div class="marker">Location</div><div>${x.location || '-'}</div>
          <div class="marker">Dept</div><div>${x.dept || '-'}</div>
          <div class="marker">OS</div><div>${x.os || '-'}</div>
          <div class="marker">CPU/RAM/Storage</div>
          <div>${[x.cpu, x.ram, x.storage].filter(Boolean).join(' / ') || '-'}</div>
          <div class="marker">Asset / Serial</div>
          <div>${[x.asset_tag, x.serial].filter(Boolean).join(' / ') || '-'}</div>
          <div class="marker">Status</div><div>${x.status || '-'}</div>
          <div class="marker">Warranty Expires</div><div>${x.warranty_expires || '-'}</div>
        </div>
      </div>
    `);
  });
}

// ========== index ==========
async function initIndex(){
  const data = await loadInventory();
  const byCat = groupBy(data, 'category');
  const cats = Object.keys(byCat).sort().filter(Boolean);
  const list = document.getElementById('categoryList');

  if (list) {
    if (cats.length === 0) {
      list.insertAdjacentHTML('beforeend', `<span class="small">No categories found.</span>`);
    } else {
      cats.forEach(c => {
        list.insertAdjacentHTML(
          'beforeend',
          `<a class="btn" href="list.html?cat=${encodeURIComponent(c)}">${c} (${byCat[c].length})</a>`
        );
      });
    }
  }

  renderCards((data || []).slice(0, 12), 'recent');
}

// ========== list (filters + category bar) ==========
async function initList(){
  const params = new URLSearchParams(location.search);
  let cat = params.get('cat') || '';

  const [data, cfg] = await Promise.all([loadInventory(), loadCfg()]);

  // Category bar (switch without going home)
  const byCat = groupBy(data, 'category');
  const cats = (cfg.categories?.length ? cfg.categories : Object.keys(byCat)).filter(Boolean);
  const bar = document.getElementById('categoryBar');
  if (bar) {
    bar.innerHTML = '';
    bar.insertAdjacentHTML('beforeend', `<button class="btn${cat?'':' primary'}" data-cat="">All</button>`);
    cats.forEach(c => {
      const active = (cat && cat.toLowerCase() === c.toLowerCase()) ? ' primary' : '';
      bar.insertAdjacentHTML('beforeend', `<button class="btn${active}" data-cat="${c}">${c} (${(byCat[c]||[]).length})</button>`);
    });
    bar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.cat || '';
      bar.querySelectorAll('button').forEach(x => x.classList.remove('primary'));
      b.classList.add('primary');
      const heading = document.getElementById('heading'); if (heading) heading.textContent = cat ? cat : 'All Inventory';
      history.replaceState({}, '', cat ? `?cat=${encodeURIComponent(cat)}` : 'list.html');
      run();
    }));
  }

  // Controls
  const search = document.getElementById('q');
  const locSel = document.getElementById('loc');
  const deptSel= document.getElementById('dept');
  const catSel = document.getElementById('cat');
  const wSel   = document.getElementById('wstat');
  const heading= document.getElementById('heading'); if (heading) heading.textContent = cat ? cat : 'All Inventory';

  // Populate options
  const setOptions = (sel, arr, label) => {
    if (!sel) return;
    sel.innerHTML = label ? `<option value="">${label}</option>` : '';
    Array.from(new Set(arr.filter(Boolean))).sort()
      .forEach(v => sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
  };
  setOptions(locSel, cfg.locations?.length ? cfg.locations : data.map(x=>x.location), 'All locations');
  setOptions(deptSel, data.map(x=>x.dept), 'All depts');
  setOptions(catSel, cats, 'All categories');
  setOptions(wSel, ['Active','Deactivated'], 'Any warranty');

  const run = () => {
    const q  = (search?.value || '').toLowerCase();
    const loc  = locSel?.value || '';
    const dept = deptSel?.value || '';
    const catDrop = catSel?.value || '';
    const w     = wSel?.value || '';

    // toggle green highlight on active filters
    setActive(search, !!q);
    setActive(locSel, !!loc);
    setActive(deptSel, !!dept);
    setActive(catSel, !!catDrop);
    setActive(wSel, !!w);

    let filtered = data;
    if (cat)      filtered = filtered.filter(x => (x.category || '').toLowerCase() === cat.toLowerCase());
    if (catDrop)  filtered = filtered.filter(x => (x.category || '').toLowerCase() === catDrop.toLowerCase());
    if (loc)      filtered = filtered.filter(x => (x.location || '') === loc);
    if (dept)     filtered = filtered.filter(x => (x.dept || '') === dept);
    if (w)        filtered = filtered.filter(x => (x.warranty_status || '').toLowerCase() === w.toLowerCase());
    if (q) {
      filtered = filtered.filter(x => {
        const hay = [x.title,x.brand,x.model,(x.user||x.user_name||''),x.os,x.asset_tag,x.serial,x.location,x.dept]
          .join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    renderCards(filtered, 'results');
  };

  [search, locSel, deptSel, catSel, wSel].forEach(el => el?.addEventListener('input', run));
  locSel?.addEventListener('change', run);
  deptSel?.addEventListener('change', run);
  catSel?.addEventListener('change', run);
  wSel?.addEventListener('change', run);
  run();
}

// ========== locations ==========
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
