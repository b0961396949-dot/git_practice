'use strict';
// 無需伺服器或套件；localStorage 不可用時仍可在本次頁面操作購物車。
const KEY = 'everyday-goods-cart-v1';
const currency = value => 'NT$' + value.toLocaleString('zh-TW');
const productById = id => PRODUCTS.find(product => product.id === id);
let cart = {};
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [id, quantity] of Object.entries(saved)) {
      if (productById(id) && Number.isInteger(quantity) && quantity > 0 && quantity <= 99) cart[id] = quantity;
    }
  }
} catch { /* 損壞的資料視為空購物車。 */ }
let category = '全部商品';
let toastTimer;
const $ = id => document.getElementById(id);
function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2300);
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* 保留記憶體內的購物車。 */ }
}
function totals() {
  const entries = Object.entries(cart);
  const subtotal = entries.reduce((sum, [id, quantity]) => sum + productById(id).price * quantity, 0);
  const count = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const shipping = subtotal === 0 || subtotal >= 1000 ? 0 : 60;
  return { entries, subtotal, count, shipping, total: subtotal + shipping };
}
function renderProducts() {
  const query = $('search').value.trim().toLowerCase();
  let list = PRODUCTS.filter(product => (category === '全部商品' || product.category === category) && (product.name + product.category + product.desc).toLowerCase().includes(query));
  if ($('sort').value === 'price-asc') list.sort((a, b) => a.price - b.price);
  if ($('sort').value === 'price-desc') list.sort((a, b) => b.price - a.price);
  $('collection-title').firstChild.textContent = category + ' ';
  $('result-count').textContent = list.length + ' 件選物';
  $('no-results').hidden = list.length > 0;
  // 商品資料來自本地常數；使用者的搜尋內容不寫入 HTML。
  $('products').innerHTML = list.map(product => `<article class="product"><div class="product-image"><img src="${product.id}.svg" alt="${product.name}" width="320" height="250"><span class="product-tag">${product.tag}</span></div><p class="product-category">${product.category}</p><h3>${product.name}</h3><p class="product-desc">${product.desc}</p><div class="product-bottom"><span class="product-price">${currency(product.price)}</span><button class="add-button" data-add="${product.id}" aria-label="加入${product.name}到購物車">＋ 加入</button></div></article>`).join('');
}
function renderCart(focusAction, focusId) {
  const { entries, subtotal, count, shipping, total } = totals();
  $('cart-count').textContent = count;
  $('cart-types').textContent = entries.length + ' 款';
  $('cart-empty').hidden = count > 0;
  $('checkout').disabled = !count;
  $('clear-cart').hidden = !count;
  $('subtotal').textContent = currency(subtotal);
  $('shipping').textContent = !count ? '—' : shipping ? currency(shipping) : '免運';
  $('total').textContent = currency(total);
  $('shipping-hint').textContent = subtotal === 0 ? '滿 NT$1,000 免運費' : subtotal >= 1000 ? '已達免運門檻' : '再選 ' + currency(1000 - subtotal) + ' 即可免運';
  $('cart-items').innerHTML = entries.map(([id, quantity]) => {
    const product = productById(id);
    return `<article class="cart-row"><img src="${id}.svg" alt="" width="55" height="43"><div><h3>${product.name}<button class="remove" data-action="remove" data-id="${id}" aria-label="移除${product.name}">×</button></h3><p class="cart-price">${currency(product.price)}</p><div class="quantity"><div class="quantity-controls"><button data-action="decrease" data-id="${id}" aria-label="減少${product.name}數量">−</button><span aria-label="數量">${quantity}</span><button data-action="increase" data-id="${id}" aria-label="增加${product.name}數量" ${quantity >= 99 ? 'disabled' : ''}>＋</button></div><strong>${currency(product.price * quantity)}</strong></div></div></article>`;
  }).join('');
  if (focusId) {
    const target = $('cart-items').querySelector(`[data-action="${focusAction}"][data-id="${focusId}"]`);
    if (target && !target.disabled) target.focus();
    else ($('cart-items').querySelector('button') || $('search')).focus();
  }
}
$('categories').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  category = button.dataset.category;
  for (const item of $('categories').querySelectorAll('button')) {
    const selected = item === button;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-pressed', String(selected));
  }
  renderProducts();
});
$('search').addEventListener('input', renderProducts);
$('sort').addEventListener('change', renderProducts);
$('products').addEventListener('click', event => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const id = button.dataset.add;
  if ((cart[id] || 0) >= 99) { notify('每款商品最多 99 件'); return; }
  cart[id] = (cart[id] || 0) + 1;
  persist(); renderCart(); notify('已加入 ' + productById(id).name);
});
$('cart-items').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { id, action } = button.dataset;
  if (action === 'remove') delete cart[id];
  if (action === 'decrease') { cart[id]--; if (cart[id] <= 0) delete cart[id]; }
  if (action === 'increase' && cart[id] < 99) cart[id]++;
  persist(); renderCart(action, id);
});
$('clear-cart').addEventListener('click', () => { cart = {}; persist(); renderCart(); $('search').focus(); notify('購物車已清空'); });
function orderMarkup(order) {
  return order.entries.map(([id, quantity]) => `<div class="order-row"><span>${productById(id).name} × ${quantity}</span><span>${currency(productById(id).price * quantity)}</span></div>`).join('') + `<div class="order-row"><span>運費</span><span>${order.shipping ? currency(order.shipping) : '免運'}</span></div><div class="order-row order-total"><span>合計</span><span>${currency(order.total)}</span></div>`;
}
$('checkout').addEventListener('click', () => {
  const order = totals();
  if (!order.count) return;
  $('order-summary').innerHTML = orderMarkup(order);
  $('checkout-dialog').showModal();
});
$('confirm-order').addEventListener('click', () => {
  const order = totals();
  if (!order.count) { $('checkout-dialog').close(); return; }
  const number = 'DEMO-' + Date.now().toString(36).toUpperCase();
  $('receipt').innerHTML = `<p class="receipt-meta">模擬訂單編號：${number}</p>` + orderMarkup(order);
  cart = {}; persist(); renderCart();
  $('checkout-dialog').close(); $('receipt-dialog').showModal();
});
renderProducts();
renderCart();
