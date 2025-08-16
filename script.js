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
  try {
    const r = await fetch('/.netlify/functions/inventory');
    if (r.ok) { return await r.json(); }
  } catch (e) {
    console.warn('Function fetch failed, falling back to JSON:', e);
  }
  const res = await fetch('assets/inventory.json');
  return await res.json();
}

function slug(s){
  return String(s||'').toLowerCase().normalize('NFKD')
    .replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,'');
}
function groupBy(xs, key){
  return xs.reduce((acc,x) => {
    const k = x[key] || '';
    acc[k] = (acc[k]
