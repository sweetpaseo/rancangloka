import type { APIRoute } from 'astro';
import { getDb, getSubscribers } from '../../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = await getDb(locals);
    const subscribers = await getSubscribers(db);

    // Build CSV Header
    let csv = 'ID,Email,Status,Source,Date Joined\n';

    // Build CSV Rows
    for (const sub of subscribers) {
      const date = new Date(sub.created_at || Date.now()).toISOString();
      const escapedEmail = `"${(sub.email || '').replace(/"/g, '""')}"`;
      const source = `"${(sub.source || 'website').replace(/"/g, '""')}"`;
      csv += `${sub.id},${escapedEmail},${sub.status || 'active'},${source},${date}\n`;
    }

    const filename = `rancangloka-subscribers-${new Date().toISOString().split('T')[0]}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    return new Response(`Gagal mengekspor CSV: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
