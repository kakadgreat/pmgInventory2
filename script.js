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
    a.addEventListener('click', () => {
      if (getComputedStyle(b).display !== 'none') close();
    })
  );
})();

// Prefer Netlify Function; fall back to bundled JSON
async function loadInventory() {
  // 1) Try serverless function (DB)
  try {
    const r = await fetch('/.netlify/functions/inventory', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length) return data;
      console.warn('Function returned no rows, falling back to JSON.');
    } else {
      console.warn('Function not OK:', r.status);
    }
  } catch (e) {
    console.warn('Function fetch failed, falling back to JSON:', e);
  }
  // 2) Fallback to bundled JSON
  try {
    const r = await fetch('/assets/inventory.json', { cache: 'no-store' });
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Could not load inventory.json:', e);
    return [];
  }
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

function renderCards(list, mount){
  const el = document.getElementById(mount);
  if (!el) return;
  el.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    el.insertAdjacentHTML('beforeend', `<div class="small">No items found.</div>`);
    return;
  }
  list.forEach(x => {
    const user = x.user || x.user_name || ''; // JSON vs DB column
    const tags = [x.brand, x.model, x.os].filter(Boolean)
      .map(t => `<span class="badge">${t}</span>`).join(' ');
    el.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h3>${x.title || '-'}</h3>
        <div class="row">${tags}</div>
        <div class="kv">
          <div class="marker">Category</div><div>${x.category || '-'}</div>
          <div class="marker">User</div><div>${user || '-'}</div>
          <div class="marker">Location</div><div>${x.location || '-'}</div>
          <div class="marker">OS</div><div>${x.os || '-'}</div>
          <div class="marker">CPU/RAM/Storage</div>
          <div>${[x.cpu, x.ram, x.storage].filter(Boolean).join(' / ') || '-'}</div>
          <div class="marker">Asset / Serial</div>
          <div>${[x.asset_tag, x.serial].filter(Boolean).join(' / ') || '-'}</div>
          <div class="marker">Status</div><div>${x.status || '-'}</div>
        </div>
      </div>
    `);
  });
}

// INDEX
async function initIndex(){
  try{
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
  } catch(e){ console.error(e); }
}

// LIST
async function initList(){
  try{
    const params = new URLSearchParams(location.search);
    const cat = params.get('cat') || '';
    const data = await loadInventory();
    const filtered = cat
      ? data.filter(x => (x.category || '').toLowerCase() === cat.toLowerCase())
      : data;

    const heading = document.getElementById('heading');
    if (heading) heading.textContent = cat ? cat : 'All Inventory';

    const search = document.getElementById('q');
    const locSel = document.getElementById('loc');

    // build locations
    const locs = Array.from(new Set(data.map(x => x.location).filter(Boolean))).sort();
    if (locSel) {
      locs.forEach(l => locSel.insertAdjacentHTML('beforeend', `<option value="${l}">${l}</option>`));
    }

    const run = () => {
      const q = (search?.value || '').toLowerCase();
      const loc = locSel?.value || '';
      const subset = filtered.filter(x => {
        const hay = [x.title, x.brand, x.model, (x.user || x.user_name || ''), x.os, x.asset_tag, x.serial, x.location]
          .join(' ')
          .toLowerCase();
        const okQ = (!q || hay.includes(q));
        const okL = (!loc || (x.location || '') === loc);
        return okQ && okL;
      });
      renderCards(subset, 'results');
    };

    search?.addEventListener('input', run);
    locSel?.addEventListener('change', run);
    run();
  } catch(e){ console.error(e); }
}

// LOCATIONS
async function initLocations(){
  try{
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
  } catch(e){ console.error(e); }
}
