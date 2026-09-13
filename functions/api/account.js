import { json } from '../_lib/http.js';
import { requireAccount, accountPayload } from '../_lib/account.js';
import { confirmPaid } from '../_lib/waffo.js';

async function grantIfPaid(env, accountId) {
  const order = await env.DB.prepare("SELECT payment_request_id FROM orders WHERE account_id = ? AND credit_granted = 0 ORDER BY created_at DESC LIMIT 1").bind(accountId).first();
  if (!order) return;
  try {
    const checked = await confirmPaid(env, order.payment_request_id);
    if (checked.paid) {
      const marked = await env.DB.prepare("UPDATE orders SET status = 'PAY_SUCCESS', credit_granted = 1, updated_at = datetime('now') WHERE payment_request_id = ? AND credit_granted = 0").bind(order.payment_request_id).run();
      if (marked.meta.changes) await env.DB.prepare("UPDATE accounts SET credits = credits + 10, updated_at = datetime('now') WHERE id = ?").bind(accountId).run();
    }
  } catch { /* Webhook or the next poll will retry. */ }
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAccount(request, env);
  if (auth.error) return auth.error;
  await grantIfPaid(env, auth.account.id);
  const account = await env.DB.prepare('SELECT id, credits FROM accounts WHERE id = ?').bind(auth.account.id).first();
  const payload = await accountPayload(env, account);
  payload.pending = account.credits === 0;
  return json(payload);
}
