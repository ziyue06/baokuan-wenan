import { json, readJson } from '../_lib/http.js';
import { requireAccount, accountPayload } from '../_lib/account.js';

function clean(value, max) { return String(value || '').trim().slice(0, max); }

function responseText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) { const text = responseText(item); if (text) return text; }
    return '';
  }
  if (value && typeof value === 'object') {
    for (const key of ['response', 'text', 'content', 'output_text', 'result']) {
      const text = responseText(value[key]);
      if (text) return text;
    }
  }
  return '';
}

async function imageDataUrl(ai, prompt) {
  const result = await ai.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 4 });
  if (result?.image) return `data:image/jpeg;base64,${result.image}`;
  let bytes;
  if (result instanceof ReadableStream) bytes = new Uint8Array(await new Response(result).arrayBuffer());
  else if (result instanceof Response) bytes = new Uint8Array(await result.arrayBuffer());
  else if (result instanceof ArrayBuffer) bytes = new Uint8Array(result);
  else if (ArrayBuffer.isView(result)) bytes = new Uint8Array(result.buffer);
  if (!bytes) return '';
  let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `data:image/png;base64,${btoa(binary)}`;
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAccount(request, env);
  if (auth.error) return auth.error;
  let generationId = '';
  try {
    const source = await readJson(request);
    const input = { product: clean(source.product, 80), audience: clean(source.audience, 120), sellingPoints: clean(source.sellingPoints, 800), tone: clean(source.tone, 30) || '真实体验', promotion: clean(source.promotion, 100) };
    if (!input.product || !input.audience || !input.sellingPoints) return json({ error: '请填写完整的商品资料' }, 400);
    generationId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO generations (id, account_id, product, input_json, status) VALUES (?, ?, ?, ?, 'processing')").bind(generationId, auth.account.id, input.product, JSON.stringify(input)).run();
    const prompt = `你是资深小红书商品内容策划。根据资料生成中文内容：商品=${input.product}；目标人群=${input.audience}；卖点=${input.sellingPoints}；语气=${input.tone}；促销=${input.promotion || '无'}。不要虚构功效、检测数据或用户经历，不使用绝对化广告词。仅输出合法 JSON，不要 markdown，结构必须为 {"titles":[3个标题],"body":"正文","tags":[10个带#标签],"coverText":"不超过14字的封面标题","imagePrompt":"英文图片提示词，不出现文字、logo、水印，竖版商品生活方式摄影"}。`;
    const textResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages: [{ role: 'system', content: '只返回严格 JSON。' }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1400 });
    const raw = responseText(textResult);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('文案生成结果格式异常');
    const output = JSON.parse(match[0]);
    if (!Array.isArray(output.titles) || !Array.isArray(output.tags) || !output.body) throw new Error('文案生成结果不完整');
    const image = await imageDataUrl(env.AI, `${output.imagePrompt}. Vertical 3:4 editorial product photo, clean composition, no text, no letters, no watermark.`);
    await env.DB.prepare("UPDATE generations SET output_json = ?, image_data_url = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(output), image, generationId).run();
    const account = await env.DB.prepare('SELECT id, credits FROM accounts WHERE id = ?').bind(auth.account.id).first();
    return json({ account: await accountPayload(env, account) });
  } catch (error) {
    if (generationId) await env.DB.prepare("UPDATE generations SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?").bind(String(error.message || error).slice(0, 300), generationId).run();
    return json({ error: '生成暂时失败，额度已退回，请稍后重试' }, 500);
  }
}
