import { json, readJson } from '../_lib/http.js';
import { randomToken, sha256 } from '../_lib/crypto.js';
import { accountPayload } from '../_lib/account.js';

export async function onRequestPost({ request, env }) {
  try {
    const { accessCode = '' } = await readJson(request);
    const normalized = accessCode.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (normalized.length !== 12) return json({ error: '账户码格式不正确' }, 400);
    const account = await env.DB.prepare('SELECT id, credits FROM accounts WHERE access_hash = ?').bind(await sha256(normalized)).first();
    if (!account) return json({ error: '没有找到这个账户码' }, 404);
    const sessionToken = randomToken();
    await env.DB.prepare("UPDATE accounts SET session_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(await sha256(sessionToken), account.id).run();
    return json({ sessionToken, account: await accountPayload(env, account) });
  } catch (error) { return json({ error: error.message || '恢复账户失败' }, 500); }
}
