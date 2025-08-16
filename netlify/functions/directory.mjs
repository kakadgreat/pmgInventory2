// netlify/functions/directory.mjs
// Phone directory API with GET / POST / DELETE, plus actions: dedupe, wipe.
// Slug is stable: name + digits-only extension, or email, or name.

import { neon } from '@netlify/neon';
const sql = neon();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KNOWN = [
  'slug','name','email','extension','team','role','status',
  'direct_phone','mobile','location','timezone','voice_enabled',
  'created_date','updated_date',
  'device_vendor','device_model','mac','ip','notes'
];

function stableSlug(x){
  const name = String(x.name||'').trim().toLowerCase();
  const extDigits = String(x.extension||'').replace(/\D/g,'');     // ← digits-only
  const base = (name && extDigits) ? `${name}-${extDigits}`
             : (x.email ? String(x.email).trim().toLowerCase() : name || 'entry');
  return base.normalize('NFKD').replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,'') || `entry-${Date.now()}`;
}

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // ensure table
    await sql`CREATE TABLE IF NOT EXISTS directory (
      slug TEXT PRIMARY KEY,
      name TEXT, email TEXT,
      extension TEXT, direct_phone TEXT, mobile TEXT,
      team TEXT, role TEXT, status TEXT,
      location TEXT, timezone TEXT, voice_enabled TEXT,
      created_date TEXT, updated_date TEXT,
      device_vendor TEXT, device_model TEXT, mac TEXT, ip TEXT,
      notes TEXT,
      extra JSONB,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;

    const url = new URL(event.rawUrl);
    const action = url.searchParams.get('action');

    // ---------- GET ----------
    if (event.httpMethod === 'GET') {
      const slug = url.searchParams.get('slug');
      const loc  = url.searchParams.get('loc');
      const team = url.searchParams.get('team');
      const stat = url.searchParams.get('status');
      const q    = (url.searchParams.get('q')||'').toLowerCase();

      let rows = await sql`SELECT * FROM directory`;
      if (slug) rows = rows.filter(r => r.slug === slug);
      if (loc)  rows = rows.filter(r => (r.location||'') === loc);
      if (team) rows = rows.filter(r => (r.team||'').toLowerCase().includes(team.toLowerCase()));
      if (stat) rows = rows.filter(r => (r.status||'').toLowerCase() === stat.toLowerCase());
      if (q) {
        rows = rows.filter(r => {
          const hay = `${r.name} ${r.email} ${r.extension} ${r.direct_phone} ${r.mobile} ${r.location} ${r.team} ${r.role}`.toLowerCase();
          return hay.includes(q);
        });
      }
      return { statusCode: 200, headers, body: JSON.stringify(rows) };
    }

    // ---------- POST (upsert; accepts single or array) ----------
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      let items = [];
      if (Array.isArray(body)) items = body;
      else if (Array.isArray(body.items)) items = body.items;
      else if (body.item) items = [body.item];
      else items = [body];

      for (const raw of items) {
        const x = { ...raw };
        x.slug = x.slug || stableSlug(x);

        const extra = {};
        for (const k of Object.keys(x)) if (!KNOWN.includes(k)) extra[k] = x[k];

        await sql`
          INSERT INTO directory (slug, name, email, extension, direct_phone, mobile,
                                 team, role, status, location, timezone, voice_enabled,
                                 created_date, updated_date,
                                 device_vendor, device_model, mac, ip, notes, extra, updated_at)
          VALUES (${x.slug}, ${x.name||''}, ${x.email||''}, ${x.extension||''}, ${x.direct_phone||''}, ${x.mobile||''},
                  ${x.team||''}, ${x.role||''}, ${x.status||''}, ${x.location||''}, ${x.timezone||''}, ${x.voice_enabled||''},
                  ${x.created_date||''}, ${x.updated_date||''},
                  ${x.device_vendor||''}, ${x.device_model||''}, ${x.mac||''}, ${x.ip||''}, ${x.notes||''},
                  ${JSON.stringify(extra)}::jsonb, now())
          ON CONFLICT (slug) DO UPDATE SET
            name=EXCLUDED.name, email=EXCLUDED.email,
            extension=EXCLUDED.extension, direct_phone=EXCLUDED.direct_phone, mobile=EXCLUDED.mobile,
            team=EXCLUDED.team, role=EXCLUDED.role, status=EXCLUDED.status,
            location=EXCLUDED.location, timezone=EXCLUDED.timezone, voice_enabled=EXCLUDED.voice_enabled,
            created_date=EXCLUDED.created_date, updated_date=EXCLUDED.updated_date,
            device_vendor=EXCLUDED.device_vendor, device_model=EXCLUDED.device_model, mac=EXCLUDED.mac, ip=EXCLUDED.ip,
            notes=EXCLUDED.notes, extra=EXCLUDED.extra, updated_at=now()
        `;
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok:true, upserted: items.length }) };
    }

    // ---------- DELETE ----------
    if (event.httpMethod === 'DELETE') {
      // action=wipe  → delete ALL rows (useful before a clean import)
      if (action === 'wipe') {
        await sql`TRUNCATE TABLE directory`;
        return { statusCode: 200, headers, body: JSON.stringify({ ok:true, wiped:true }) };
      }

      // action=dedupe → keep newest per (extDigits OR email OR name)
      if (action === 'dedupe') {
        const res = await sql`
          WITH canon AS (
            SELECT slug,
                   COALESCE(NULLIF(regexp_replace(COALESCE(extension,''), '\D', '', 'g'), ''),
                            lower(trim(email)),
                            lower(trim(name))) AS key,
                   updated_at,
                   ROW_NUMBER() OVER (PARTITION BY
                     COALESCE(NULLIF(regexp_replace(COALESCE(extension,''), '\D', '', 'g'), ''),
                              lower(trim(email)), lower(trim(name)))
                     ORDER BY updated_at DESC, slug DESC) AS rn
            FROM directory
          )
          DELETE FROM directory d
          USING canon c
          WHERE d.slug = c.slug AND c.rn > 1
          RETURNING d.slug
        `;
        return { statusCode: 200, headers, body: JSON.stringify({ ok:true, removed: res.length }) };
      }

      // delete one row by slug
      const slug = new URL(event.rawUrl).searchParams.get('slug');
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error:'slug required' }) };
      await sql`DELETE FROM directory WHERE slug=${slug}`;
      return { statusCode: 200, headers, body: JSON.stringify({ ok:true, removed: slug }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error:'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
}
