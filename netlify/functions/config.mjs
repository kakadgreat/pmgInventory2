// netlify/functions/config.mjs
// Stores categories, locations, and TEAMS. Uses DB (Neon) fallback if Blobs unavailable.

import { neon } from '@netlify/neon';
let sql; try { sql = neon(); } catch {}

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEFAULT = {
  categories: [
    "Desktops","Laptops","Phones","Printers","Scanners",
    "Tablets","Monitors","Networking","Peripherals","Servers/NAS","Other"
  ],
  locations: [],
  teams: []
};

// Try Blobs (optional); DB fallback
let blobsOk = false, store;
try {
  const { getStore } = await import('@netlify/blobs');
  store = getStore({ name: 'inventory-config' });
  await store.get('healthcheck.txt');
  blobsOk = true;
} catch { blobsOk = false; }

async function ensureKv(){
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS kv_config (key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ DEFAULT now())`;
}
async function dbGet(key){ await ensureKv(); const r = await sql`SELECT value FROM kv_config WHERE key=${key}`; return r?.[0]?.value || null; }
async function dbSet(key,val){ await ensureKv(); await sql`
  INSERT INTO kv_config (key,value,updated_at) VALUES (${key}, ${JSON.stringify(val)}::jsonb, now())
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()
`; }

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };

  try {
    if (event.httpMethod === 'GET') {
      if (blobsOk) {
        const cfg = await store.get('config.json', { type:'json' });
        return { statusCode:200, headers, body: JSON.stringify(cfg || DEFAULT) };
      }
      const cfg = (sql ? await dbGet('config') : null) || DEFAULT;
      return { statusCode:200, headers, body: JSON.stringify(cfg) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const cfg = {
        categories: Array.isArray(body.categories) ? body.categories : DEFAULT.categories,
        locations:  Array.isArray(body.locations)  ? body.locations  : DEFAULT.locations,
        teams:      Array.isArray(body.teams)      ? body.teams      : DEFAULT.teams
      };
      if (blobsOk) { await store.setJSON('config.json', cfg); return { statusCode:200, headers, body: JSON.stringify({ ok:true, storage:'blobs', cfg }) }; }
      if (sql)     { await dbSet('config', cfg);    return { statusCode:200, headers, body: JSON.stringify({ ok:true, storage:'db', cfg }) }; }
      return { statusCode:500, headers, body: JSON.stringify({ error:'No Blobs or DB available' }) };
    }

    return { statusCode:405, headers, body: JSON.stringify({ error:'Method not allowed' }) };
  } catch (e) {
    return { statusCode:500, headers, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
}
