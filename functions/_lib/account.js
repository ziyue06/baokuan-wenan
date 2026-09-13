import { bearer, json } from './http.js';
import { sha256 } from './crypto.js';

export async function requireAccount(request, env) {
  const token = bearer(request);
  if (!token) return { error: json({ error: '请先连接账户' }, 401) };
  const hash = await sha256(token);
  const account = await env.DB.prepare('SELECT id, credits, created_at FROM accounts WHERE session_hash = ?').bind(hash).first();
  if (!account) return { error: json({ error: '账户凭证无效，请使用账户码恢复' }, 401) };
  return { account };
}

export async function accountPayload(env, account, accessCode = '') {
  const rows = await env.DB.prepare("SELECT id, product, output_json, image_data_url, created_at FROM generations WHERE account_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 20").bind(account.id).all();
  return { credits: account.credits, accessCode, generations: (rows.results || []).map((row) => ({ id: row.id, product: row.product, output: JSON.parse(row.output_json), imageDataUrl: row.image_data_url || '', createdAt: row.created_at })) };
}
