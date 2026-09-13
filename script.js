document.querySelector('#order-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const order = `【爆款商品文案机订单】\n商品：${data.get('product')}\n卖点：${data.get('sellingPoint')}\n目标人群：${data.get('audience')}\n联系方式：${data.get('contact')}\n套餐：29元 / 10次体验`;
  navigator.clipboard?.writeText(order).then(() => {
    document.querySelector('#form-note').textContent = '订单信息已复制，请粘贴发给客服，并附上付款截图。';
  }).catch(() => {
    window.prompt('请复制下面的订单信息发给客服：', order);
  });
});
