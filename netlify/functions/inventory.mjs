// netlify/functions/inventory.mjs
import { neon } from '@netlify/neon';
const sql = neon(); // Uses NETLIFY_DATABASE_URL automatically

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS items (
        slug TEXT PRIMARY KEY,
        category TEXT,
        title TEXT,
        asset_tag TEXT,
        serial TEXT,
        brand TEXT,
        model TEXT,
        user_name TEXT,
        email TEXT,
        location TEXT,
        status TEXT,
        os TEXT,
        cpu TEXT,
        ram TEXT,
        storage TEXT,
        purchase_date TEXT,
        warranty_expires TEXT,
        notes TEXT,
        source_sheet TEXT,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    if (event.httpMethod === 'GET') {
      const url = new URL(event.rawUrl);
      const cat = url.searchParams.get('cat');
      const loc = url.searchParams.get('loc');
      const q = (url.searchParams.get('q')||'').toLowerCase();
      let rows = await sql`SELECT * FROM items`;
      if (cat) rows = rows.filter(r => (r.category||'').toLowerCase() === cat.toLowerCase());
      if (loc) rows = rows.filter(r => (r.location||'') === loc);
      if (q) rows = rows.filter(r => {
        const hay = `${r.title} ${r.brand} ${r.model} ${r.user_name} ${r.os} ${r.asset_tag} ${r.serial} ${r.location}`.toLowerCase();
        return hay.includes(q);
      });
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No items' }) };
      for (const x of items) {
        await sql`
          INSERT INTO items (slug, category, title, asset_tag, serial, brand, model, user_name, email, location, status, os, cpu, ram, storage, purchase_date, warranty_expires, notes, source_sheet, updated_at)
          VALUES (${x.slug}, ${x.category}, ${x.title}, ${x.asset_tag}, ${x.serial}, ${x.brand}, ${x.model}, ${x.user}, ${x.email}, ${x.location}, ${x.status}, ${x.os}, ${x.cpu}, ${x.ram}, ${x.storage}, ${x.purchase_date}, ${x.warranty_expires}, ${x.notes}, ${x.source_sheet}, now())
          ON CONFLICT (slug)
          DO UPDATE SET category=EXCLUDED.category, title=EXCLUDED.title, asset_tag=EXCLUDED.asset_tag, serial=EXCLUDED.serial,
                        brand=EXCLUDED.brand, model=EXCLUDED.model, user_name=EXCLUDED.user_name, email=EXCLUDED.email,
                        location=EXCLUDED.location, status=EXCLUDED.status, os=EXCLUDED.os, cpu=EXCLUDED.cpu, ram=EXCLUDED.ram,
                        storage=EXCLUDED.storage, purchase_date=EXCLUDED.purchase_date, warranty_expires=EXCLUDED.warranty_expires,
                        notes=EXCLUDED.notes, source_sheet=EXCLUDED.source_sheet, updated_at=now()
        `;
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, upserted: items.length }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
}
