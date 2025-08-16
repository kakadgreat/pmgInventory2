// Stores categories & locations in Netlify Blobs so you can edit online.
import { getStore } from '@netlify/blobs';
const store = getStore({ name: 'inventory-config' });

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
  locations: []   // fill these with your PMG locations
};

export async function handler(event){
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (event.httpMethod === 'GET') {
    const cfg = await store.get('config.json', { type: 'json' });
    return { statusCode: 200, headers, body: JSON.stringify(cfg || DEFAULT) };
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const categories = Array.isArray(body.categories) ? body.categories : DEFAULT.categories;
    const locations  = Array.isArray(body.locations)  ? body.locations  : DEFAULT.locations;
    const cfg = { categories, locations };
    await store.setJSON('config.json', cfg);
    return { statusCode: 200, headers, body: JSON.stringify({ ok:true, cfg }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
}
