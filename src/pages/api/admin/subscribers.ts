import type { APIRoute } from 'astro';
import { getDb, getSubscribers, deleteSubscriber } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = await getDb(locals);
    const subscribers = await getSubscribers(db);
    return new Response(JSON.stringify({ success: true, subscribers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ success: false, message: 'ID subscriber diperlukan.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = await getDb(locals);
    await deleteSubscriber(db, Number(id));

    return new Response(JSON.stringify({ success: true, message: 'Subscriber berhasil dihapus.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
