# 爆款商品文案机

Cloudflare Pages 全栈 MVP：Waffo Pancake 托管支付、D1 额度与历史记录、Workers AI 文案和封面图生成。

## 运行架构

- 静态前端：Cloudflare Pages
- API：Pages Functions (`functions/api`)
- 数据：Cloudflare D1
- AI：Workers AI
- 支付：Waffo Pancake（默认沙盒）

## Cloudflare 配置

1. 用此仓库创建 Pages 项目，构建命令留空，输出目录为 `.`。
2. 创建 D1 数据库并绑定为 `DB`，执行 `migrations/0001_initial.sql`。
3. 绑定 Workers AI，变量名为 `AI`。
4. 添加普通变量：`WAFFO_BASE_URL`、`WAFFO_MERCHANT_ID`、`PRICE_CURRENCY`、`PRICE_AMOUNT`。
5. 添加加密 Secret：`WAFFO_API_KEY`、`WAFFO_PRIVATE_KEY`、`WAFFO_PUBLIC_KEY`。
6. Waffo Webhook 地址使用 `https://aikeji.xin/api/webhook/waffo`。

`wrangler.toml.example` 是配置模板，不包含真实密钥。

## 安全规则

- 浏览器只保存随机会话凭证，D1 只保存 SHA-256 哈希。
- Webhook 在处理前使用 Waffo 公钥验签，并主动查询订单最终状态。
- 每笔订单只发放一次额度；重复 Webhook 不会重复充值。
- AI 失败自动退回额度。
- Waffo 私钥和 API Key 只能放入 Cloudflare Secret。
