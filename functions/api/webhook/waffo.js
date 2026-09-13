import { json } from '../../_lib/http.js';
import { sha256 } from '../../_lib/crypto.js';
import { confirmPaid, verifyWaffoWebhook } from '../../_lib/waffo.js';

export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  const signature = request.headers.get('x-signature') || '';
  if (!await verifyWaffoWebhook(env, raw, signature)) return json({ message: 'failed' });
  try {
    const event = JSON.parse(raw);
    if (event.eventType !== 'PAYMENT_NOTIFICATION' || !event.result?.paymentRequestId) return json({ message: 'success' });
    const paymentRequestId = event.result.paymentRequestId;
    const eventHash = await sha256(raw);
    const order = await env.DB.prepare('SELECT id, account_id, credit_granted FROM orders WHERE payment_request_id = ?').bind(paymentRequestId).first();
    if (!order) return json({ message: 'success' });
    await env.DB.prepare('INSERT OR IGNORE INTO payment_events (id, order_id, event_hash, payload_json) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), order.id, eventHash, raw).run();
    const checked = await confirmPaid(env, paymentRequestId);
    if (!checked.paid) {
      await env.DB.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(checked.data.orderStatus || 'unknown', order.id).run();
      return json({ message: 'success' });
    }
    const marked = await env.DB.prepare("UPDATE orders SET status = 'PAY_SUCCESS', credit_granted = 1, acquiring_order_id = ?, updated_at = datetime('now') WHERE id = ? AND credit_granted = 0").bind(checked.data.acquiringOrderId || '', order.id).run();
    if (marked.meta.changes) await env.DB.prepare("UPDATE accounts SET credits = credits + 10, updated_at = datetime('now') WHERE id = ?").bind(order.account_id).run();
    return json({ message: 'success' });
  } catch { return json({ message: 'failed' }); }
}
