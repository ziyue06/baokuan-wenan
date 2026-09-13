import { json, readJson, clientIp } from '../_lib/http.js';
import { makeAccessCode, randomToken, sha256 } from '../_lib/crypto.js';
import { waffoRequest } from '../_lib/waffo.js';

export async function onRequestPost({ request, env }) {
  try {
    const { email = '' } = await readJson(request);
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 160) return json({ error: '请输入有效邮箱' }, 400);
    const sessionToken = randomToken();
    const accessCode = makeAccessCode();
    const accountId = crypto.randomUUID();
    const paymentRequestId = crypto.randomUUID().replace(/-/g, '');
    const merchantOrderId = `AIK_${Date.now()}_${paymentRequestId.slice(0, 6)}`;
    const origin = new URL(request.url).origin;
    const sessionHash = await sha256(sessionToken);
    const accessHash = await sha256(accessCode.replace(/-/g, '').toUpperCase());
    await env.DB.batch([
      env.DB.prepare('INSERT INTO accounts (id, session_hash, access_hash, email, credits) VALUES (?, ?, ?, ?, 0)').bind(accountId, sessionHash, accessHash, email.toLowerCase()),
      env.DB.prepare("INSERT INTO orders (id, account_id, payment_request_id, merchant_order_id, status, currency, amount) VALUES (?, ?, ?, ?, 'created', ?, ?)").bind(crypto.randomUUID(), accountId, paymentRequestId, merchantOrderId, env.PRICE_CURRENCY || 'HKD', env.PRICE_AMOUNT || '1.00')
    ]);
    const payment = await waffoRequest(env, '/api/v1/order/create', {
      paymentRequestId, merchantOrderId, orderCurrency: env.PRICE_CURRENCY || 'HKD', orderAmount: env.PRICE_AMOUNT || '1.00', orderDescription: 'AI 商品文案生成 10 次额度', orderRequestedAt: new Date().toISOString(), notifyUrl: `${origin}/api/webhook/waffo`, successRedirectUrl: `${origin}/?payment=success`, failedRedirectUrl: `${origin}/?payment=failed`, cancelRedirectUrl: `${origin}/?payment=cancelled`, merchantInfo: { merchantId: env.WAFFO_MERCHANT_ID }, userInfo: { userId: accountId, userEmail: email.toLowerCase(), userTerminal: 'WEB', userBrowserIp: clientIp(request), userAgent: request.headers.get('user-agent') || '' }, paymentInfo: { productName: 'ONE_TIME_PAYMENT', cashierLanguage: 'zh-CN' }, goodsInfo: { goodsName: 'AI 商品文案生成 10 次额度', goodsUrl: origin }
    });
    const action = typeof payment.orderAction === 'string' ? JSON.parse(payment.orderAction) : payment.orderAction;
    const checkoutUrl = action?.actionType === 'DEEPLINK' ? action.deeplinkUrl : action?.webUrl;
    if (!checkoutUrl) throw new Error('支付服务未返回收银台地址');
    await env.DB.prepare("UPDATE orders SET status = ?, acquiring_order_id = ?, updated_at = datetime('now') WHERE payment_request_id = ?").bind(payment.orderStatus || 'PAY_IN_PROGRESS', payment.acquiringOrderId || '', paymentRequestId).run();
    return json({ checkoutUrl, sessionToken, accessCode });
  } catch (error) { return json({ error: error.message || '创建订单失败' }, 500); }
}
