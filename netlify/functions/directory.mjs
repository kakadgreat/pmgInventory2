// netlify/functions/directory.mjs
// Phone directory API with GET / POST / DELETE and a "dedupe" action.

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

function makeSlug(x){
  const s = (x.slug || `${x.name||''}-${x.extension||''}` || 'entry')
    .toLowerCase().normalize('NFKD').replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,'');
  return s || `entry-${Date.now()}`;
}

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // Ensure table
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

    // ---- GET ----
    if (event.httpMethod === 'GET') {
      const slug = url.searchParams.get('slug');
      const loc  = url.searchParams.get('loc');
      const team = url.searchParams.get('team');
      const stat = url.searchParams.get('status');
      const q    = (url.searchParams.get('q')||'').toLowerCase();

      if (action === 'dedupe-preview') {
        const rows = await sql`SELECT slug, name, extension, email, updated_at FROM directory`;
        // group by key we dedupe on
        const map = {};
        for (const r of rows) {
          const key = (r.extension || '').replace(/\D/g,'') || (r.email||'').toLowerCase() || (r.name||'').toLowerCase();
          (map[key] ||= []).push(r);
        }
        const dups = Object.values(map).filter(arr => arr.length > 1);
        return { statusCode: 200, headers, body: JSON.stringify({ groups: dups.length, samples: dups.slice(0,10) }) };
      }

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

    // ---- POST (insert / update, accepts single or batch) ----
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

    // ---- DELETE (by slug) or action=dedupe ----
    if (event.httpMethod === 'DELETE') {
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

      const slug = url.searchParams.get('slug');
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error:'slug required' }) };
      await sql`DELETE FROM directory WHERE slug=${slug}`;
      return { statusCode: 200, headers, body: JSON.stringify({ ok:true, removed: slug }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error:'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
}
