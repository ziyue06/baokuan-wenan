import { json } from '../_lib/http.js';
import { accountPayload } from '../_lib/account.js';
import { makeAccessCode, randomToken, sha256 } from '../_lib/crypto.js';

export async function onRequestPost({ request, env }) {
  const token = randomToken();
  const accessCode = makeAccessCode();
  const accountId = crypto.randomUUID();
  const sessionHash = await sha256(token);
  const accessHash = await sha256(accessCode.replace(/-/g, '').toUpperCase());
  await env.DB.prepare('INSERT INTO accounts (id, session_hash, access_hash, email, credits) VALUES (?, ?, ?, ?, 0)')
    .bind(accountId, sessionHash, accessHash, 'free@aikeji.xin').run();
  const account = await env.DB.prepare('SELECT id, credits FROM accounts WHERE id = ?').bind(accountId).first();
  return json({ sessionToken: token, account: { ...(await accountPayload(env, account, accessCode)), free: true } });
}
