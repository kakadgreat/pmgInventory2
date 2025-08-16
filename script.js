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
        <div style="display:flex;justify-content:space-between;align-items:center;g
