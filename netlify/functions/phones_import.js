// netlify/functions/phones_import.js
import { neon } from '@neondatabase/serverless';

const originFromEvent = (e) => {
  const proto = e.headers['x-forwarded-proto'] || 'https';
  const host  = e.headers['x-forwarded-host'] || e.headers.host;
  return `${proto}://${host}`;
};

export async function handler(event) {
  try {
    const key = (event.queryStringParameters?.key || '').trim();
    if (!key || key !== process.env.ADMIN_KEY) {
      return { statusCode: 401, body: 'Unauthorized' };
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // 1) Ensure table exists
    await sql/*sql*/`
      CREATE TABLE IF NOT EXISTS phones (
        id         BIGSERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        extension  TEXT,
        direct     TEXT,
        mobile     TEXT,
        email      TEXT,
        location   TEXT,
        team       TEXT,
        role       TEXT,
        status     TEXT DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // 2) Pull live JSON from your site
    const base = process.env.SELF_BASE_URL || originFromEvent(event);
    const res  = await fetch(`${base}/phones.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch phones.json failed: ${res.status}`);
    const items = await res.json();
    if (!Array.isArray(items)) throw new Error('phones.json must be an array');

    // 3) Optional truncate
    const clear = (event.queryStringParameters?.clear || '').toLowerCase() === 'true';
    if (clear) await sql`TRUNCATE TABLE phones`;

    // 4) Insert
    for (const p of items) {
      const row = {
        name:      p.name || '',
        extension: p.extension || '',
        direct:    p.direct || p.direct_phone || '',
        mobile:    p.mobile || '',
        email:     p.email || '',
        location:  p.location || '',
        team:      p.team || '',
        role:      p.role || '',
        status:    p.status || 'Active'
      };

      await sql/*sql*/`
        INSERT INTO phones
          (name, extension, direct, mobile, email, location, team, role, status)
        VALUES
          (${row.name}, ${row.extension}, ${row.direct}, ${row.mobile},
           ${row.email}, ${row.location}, ${row.team}, ${row.role}, ${row.status})
      `;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, inserted: items.length, cleared: clear })
    };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
}
