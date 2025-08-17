// netlify/functions/phones.js
import { neon } from '@neondatabase/serverless';

export async function handler() {
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    const rows = await sql/*sql*/`
      SELECT
        name,
        extension,
        direct AS direct_phone,      -- alias for UI
        mobile,
        email,
        location,
        team,
        role,
        status
      FROM phones
      ORDER BY lower(name) ASC
    `;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(rows)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err) })
    };
  }
}
