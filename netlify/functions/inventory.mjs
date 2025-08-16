import { neon } from '@netlify/neon';
const sql = neon();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KNOWN = [
  'slug','category','title','asset_tag','serial','brand','model',
  'user','user_name','email','location','room','dept',
  'status','warranty_status','os','cpu','ram','storage',
  'purchase_date','warranty_expires','notes','source_sheet'
];

function makeSlug(x) {
  const base = (x.slug || `${x.title || ''}-${x.asset_tag || ''}-${x.serial || ''}`)
    .toLowerCase().normalize('NFKD').replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,'');
  return base || `item-${Date.now()}`;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    await sql`CREATE TABLE IF NOT EXISTS items (
      slug TEXT PRIMARY KEY,
      category TEXT, title TEXT,
      asset_tag TEXT, serial TEXT,
      brand TEXT, model TEXT,
      user_name TEXT, email TEXT,
      location TEXT, room TEXT, dept TEXT,
      status TEXT, warranty_status TEXT,
      os TEXT, cpu TEXT, ram TEXT, storage TEXT,
      purchase_date TEXT, warranty_expires TEXT,
      notes TEXT, source_sheet TEXT,
      extra JSONB,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`ALTER TABLE items
      ADD COLUMN IF NOT EXISTS room TEXT,
      ADD COLUMN IF NOT EXISTS dept TEXT,
      ADD COLUMN IF NOT EXISTS warranty_status TEXT,
      ADD COLUMN IF NOT EXISTS extra JSONB`;

    if (event.httpMethod === 'GET') {
      const url = new URL(event.rawUrl);
      const cat = url.searchParams.get('cat');
      const loc = url.searchParams.get('loc');
      const slug = url.searchParams.get('slug');
      const q = (url.searchParams.get('q') || '').toLowerCase();

      let rows = await sql`SELECT * FROM items`;
      if (slug) rows = rows.filter(r => r.slug === slug);
      if (cat)  rows = rows.filter(r => (r.category||'').toLowerCase() === cat.toLowerCase());
      if (loc)  rows = rows.filter(r => (r.location||'') === loc);
      if (q) {
        rows = rows.filter(r => {
          const hay = `${r.title} ${r.brand} ${r.model} ${r.user_name} ${r.os} ${r.asset_tag} ${r.serial} ${r.location}`.toLowerCase();
          return hay.includes(q);
        });
      }
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      let items = [];
      if (Array.isArray(body)) items = body;
      else if (Array.isArray(body.items)) items = body.items;
      else if (body.item) items = [body.item];
      else items = [body];

      for (const raw of items) {
        const x = { ...raw };
        x.slug = makeSlug(x);
        x.user_name = x.user_name || x.user || '';
        const extra = {};
        for (const k of Object.keys(x)) if (!KNOWN.includes(k)) extra[k] = x[k];

        await sql`
          INSERT INTO items (slug, category, title, asset_tag, serial, brand, model, user_name, email,
                             location, room, dept, status, warranty_status, os, cpu, ram, storage,
                             purchase_date, warranty_expires, notes, source_sheet, extra, updated_at)
          VALUES (${x.slug}, ${x.category||''}, ${x.title||''}, ${x.asset_tag||''}, ${x.serial||''},
                  ${x.brand||''}, ${x.model||''}, ${x.user_name||''}, ${x.email||''},
                  ${x.location||''}, ${x.room||''}, ${x.dept||''}, ${x.status||''}, ${x.warranty_status||''},
                  ${x.os||''}, ${x.cpu||''}, ${x.ram||''}, ${x.storage||''},
                  ${x.purchase_date||''}, ${x.warranty_expires||''}, ${x.notes||''}, ${x.source_sheet||''},
                  ${JSON.stringify(extra)}::jsonb, now())
          ON CONFLICT (slug) DO UPDATE SET
            category=EXCLUDED.category, title=EXCLUDED.title,
            asset_tag=EXCLUDED.asset_tag, serial=EXCLUDED.serial,
            brand=EXCLUDED.brand, model=EXCLUDED.model,
            user_name=EXCLUDED.user_name, email=EXCLUDED.email,
            location=EXCLUDED.location, room=EXCLUDED.room, dept=EXCLUDED.dept,
            status=EXCLUDED.status, warranty_status=EXCLUDED.warranty_status,
            os=EXCLUDED.os, cpu=EXCLUDED.cpu, ram=EXCLUDED.ram, storage=EXCLUDED.storage,
            purchase_date=EXCLUDED.purchase_date, warranty_expires=EXCLUDED.warranty_expires,
            notes=EXCLUDED.notes, source_sheet=EXCLUDED.source_sheet,
            extra=EXCLUDED.extra, updated_at=now()
        `;
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, upserted: items.length }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
}
