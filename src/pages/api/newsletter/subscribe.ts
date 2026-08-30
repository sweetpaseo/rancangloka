import type { APIRoute } from 'astro';
import { getDb, addSubscriber } from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { email, source = 'website' } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Format email tidak valid.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = await getDb(locals);
    const result = await addSubscriber(db, email, source);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Gagal memproses pendaftaran buletin.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
