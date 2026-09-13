# 爆款商品文案机（Cloudflare Pages MVP）

这是一个无需服务器的静态落地页。当前版本用表单生成订单文本并复制到剪贴板，收款码使用 `wechat-pay.jpg`，客服微信为 `Poison-kls`，计划绑定域名 `aikeji.xin`。

## 上线前替换

- 如需更换收款码，替换 `wechat-pay.jpg`
- 如需更换客服微信，修改 `index.html` 中的 `Poison-kls`
- 修改价格、交付时间和品牌名称

## Cloudflare Pages 部署

在 Cloudflare Pages 创建项目，选择“直接上传资源”，上传本目录的三个文件（`index.html`、`styles.css`、`script.js`）。不需要构建命令，输出目录留空或使用根目录。

也可以连接 Git 仓库，构建命令留空，根目录使用仓库根目录。
