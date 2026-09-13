import { signBody, verifyBody } from './crypto.js';

function config(env) {
  return { baseUrl: env.WAFFO_BASE_URL || 'https://api-sandbox.waffo.com', apiKey: env.WAFFO_API_KEY, privateKey: env.WAFFO_PRIVATE_KEY, publicKey: env.WAFFO_PUBLIC_KEY, merchantId: env.WAFFO_MERCHANT_ID };
}

export async function waffoRequest(env, path, payload) {
  const cfg = config(env);
  if (!cfg.apiKey || !cfg.privateKey || !cfg.publicKey || !cfg.merchantId) throw new Error('支付服务尚未完成配置');
  const body = JSON.stringify(payload);
  const signature = await signBody(body, cfg.privateKey);
  const response = await fetch(`${cfg.baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'x-api-version': '1.0.0', 'x-signature': signature }, body });
  const raw = await response.text();
  const responseSignature = response.headers.get('x-signature');
  if (!response.ok) throw new Error(`支付服务请求失败 (${response.status})`);
  if (!await verifyBody(raw, responseSignature, cfg.publicKey)) throw new Error('支付服务响应签名无效');
  const result = JSON.parse(raw);
  if (String(result.code) !== '0') throw new Error(result.msg || '支付服务拒绝了请求');
  return result.data;
}

export async function confirmPaid(env, paymentRequestId) {
  const data = await waffoRequest(env, '/api/v1/order/inquiry', { paymentRequestId });
  return { paid: data.orderStatus === 'PAY_SUCCESS', data };
}

export async function verifyWaffoWebhook(env, raw, signature) {
  return verifyBody(raw, signature, config(env).publicKey);
}
