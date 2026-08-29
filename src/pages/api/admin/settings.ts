import type { APIRoute } from 'astro';
import { getDb, updateSiteSettings } from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const newSettings = await request.json();
    const db = await getDb(locals);

    await updateSiteSettings(db, newSettings);

    return new Response(JSON.stringify({ status: 'success', settings: newSettings }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
