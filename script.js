const state = { token: localStorage.getItem('aikeji_session') || '', account: null, pollTimer: null };
const $ = (selector) => document.querySelector(selector);

function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  button.querySelector('.button-label').hidden = busy;
  button.querySelector('.spinner').hidden = !busy;
}

function setNote(selector, message, type = '') {
  const node = $(selector);
  node.textContent = message;
  node.className = `form-note ${type}`.trim();
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set('Content-Type', 'application/json');
  if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试');
  return data;
}

function selectTab(name) {
  document.querySelectorAll('.panel-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.toggle('active', pane.dataset.pane === name));
}

function renderAccount(data) {
  state.account = data;
  $('#credit-count').textContent = data.credits ?? 0;
  $('#account-state').textContent = data.pending ? '等待支付确认' : '账户已连接';
  if (data.accessCode) {
    $('#access-code').textContent = data.accessCode;
    $('#access-code-box').hidden = false;
  }
  renderHistory(data.generations || []);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function renderHistory(items) {
  const list = $('#history-list');
  if (!items.length) {
    list.innerHTML = '<p class="empty-state">还没有生成记录。购买额度后即可开始。</p>';
    return;
  }
  list.innerHTML = items.map((item) => {
    const output = item.output || {};
    const titles = (output.titles || []).map((title) => `<li>${escapeHtml(title)}</li>`).join('');
    const tags = (output.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
    const image = item.imageDataUrl ? `<img class="result-cover" src="${item.imageDataUrl}" alt="${escapeHtml(item.product)}封面图">` : '';
    return `<details class="result-card"><summary>${escapeHtml(item.product)}<span>${escapeHtml(item.createdAt)}</span></summary><div class="result-body"><button class="button button-small button-ghost copy-result" type="button" data-copy="${item.id}">复制全文</button><h4>标题</h4><ol class="result-titles">${titles}</ol><h4>正文</h4><p>${escapeHtml(output.body || '')}</p><h4>标签</h4><div class="tags">${tags}</div>${image}</div></details>`;
  }).join('');
  list.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', () => {
    const item = items.find((entry) => entry.id === button.dataset.copy);
    const text = `${item.output.titles.join('\n')}\n\n${item.output.body}\n\n${item.output.tags.join(' ')}`;
    navigator.clipboard.writeText(text).then(() => { button.textContent = '已复制'; });
  }));
}

async function refreshAccount() {
  if (!state.token) return;
  try {
    const data = await api('/api/account');
    renderAccount(data);
    if (data.credits > 0) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
      selectTab('create');
      setNote('#checkout-note', '支付已确认，10 次额度已经到账。', 'success');
    }
  } catch (error) {
    if (error.message.includes('账户')) localStorage.removeItem('aikeji_session');
  }
}

document.querySelectorAll('.panel-tab').forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset.tab)));

const checkoutForm = $('#checkout-form');
checkoutForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setBusy(form, true);
  setNote('#checkout-note', '正在创建安全支付订单...');
  try {
    const email = new FormData(form).get('email');
    const data = await api('/api/checkout', { method: 'POST', body: JSON.stringify({ email }) });
    state.token = data.sessionToken;
    localStorage.setItem('aikeji_session', state.token);
    renderAccount({ credits: 0, pending: true, accessCode: data.accessCode, generations: [] });
    window.location.assign(data.checkoutUrl);
  } catch (error) {
    setNote('#checkout-note', error.message, 'error');
    setBusy(form, false);
  }
});

$('#generate-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.token) { selectTab('buy'); setNote('#checkout-note', '请先购买额度或恢复已有账户。', 'error'); return; }
  const form = event.currentTarget;
  setBusy(form, true);
  setNote('#generate-note', 'AI 正在撰写文案并制作封面图，通常需要 20-60 秒...');
  try {
    const payload = Object.fromEntries(new FormData(form));
    const data = await api('/api/generate', { method: 'POST', body: JSON.stringify(payload) });
    renderAccount(data.account);
    selectTab('history');
  } catch (error) {
    setNote('#generate-note', error.message, 'error');
  } finally {
    setBusy(form, false);
  }
});

$('#open-recovery').addEventListener('click', () => $('#recovery-dialog').showModal());
$('#recover-account').addEventListener('click', async () => {
  const code = $('#recovery-code').value.trim();
  if (!code) return;
  try {
    const data = await api('/api/recover', { method: 'POST', body: JSON.stringify({ accessCode: code }) });
    state.token = data.sessionToken;
    localStorage.setItem('aikeji_session', state.token);
    renderAccount(data.account);
    $('#recovery-dialog').close();
    selectTab(data.account.credits > 0 ? 'create' : 'buy');
    location.hash = 'studio';
  } catch (error) { setNote('#recovery-note', error.message, 'error'); }
});

$('#copy-code').addEventListener('click', () => navigator.clipboard.writeText($('#access-code').textContent));

const paymentReturn = new URLSearchParams(location.search).get('payment');
if (paymentReturn && state.token) {
  history.replaceState({}, '', `${location.pathname}#studio`);
  setNote('#checkout-note', '正在确认支付结果，请不要关闭页面...');
  state.pollTimer = setInterval(refreshAccount, 3000);
  setTimeout(() => { if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; setNote('#checkout-note', '支付结果仍在确认中。稍后刷新页面即可，不会丢单。'); } }, 120000);
}
async function ensureFreeAccount() {
  if (state.token) return refreshAccount();
  try {
    const data = await api('/api/free-account', { method: 'POST' });
    state.token = data.sessionToken;
    localStorage.setItem('aikeji_session', state.token);
    renderAccount(data.account);
    selectTab('create');
    setNote('#checkout-note', '免费账户已准备好，可以开始生成。', 'success');
  } catch (error) {
    setNote('#checkout-note', error.message, 'error');
  }
}
ensureFreeAccount();
