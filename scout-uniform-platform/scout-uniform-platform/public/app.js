let currentUser = null;
let products = [];
let cart = []; // { productId, name, size, quantity, unitPrice }
let authMode = 'login'; // or 'register'
let currentUploadOrderId = null;

// ========== INIT ==========
async function init() {
  await checkMe();
  if (currentUser) {
    showPage(currentUser.role === 'admin' ? 'admin' : 'shop');
  } else {
    showPage('auth');
  }
}

async function checkMe() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    currentUser = data.user;
    updateNav();
  } catch (e) {
    currentUser = null;
  }
}

function updateNav() {
  const info = document.getElementById('user-info');
  const btnLogout = document.getElementById('btn-logout');
  const btnMy = document.getElementById('btn-myorders');
  const btnAdmin = document.getElementById('btn-admin');

  if (currentUser) {
    info.textContent = `${currentUser.name} (${currentUser.role})`;
    btnLogout.style.display = 'inline-block';
    btnMy.style.display = currentUser.role === 'parent' ? 'inline-block' : 'none';
    btnAdmin.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
  } else {
    info.textContent = '';
    btnLogout.style.display = 'none';
    btnMy.style.display = 'none';
    btnAdmin.style.display = 'none';
  }
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const page = document.getElementById(`page-${name}`);
  if (page) page.style.display = 'block';

  if (name === 'shop') loadProducts();
  if (name === 'myorders') loadMyOrders();
  if (name === 'admin') {
    loadAdminStats();
    loadAdminOrders('all');
  }
}

// ========== AUTH ==========
function toggleAuthMode(e) {
  e.preventDefault();
  authMode = authMode === 'login' ? 'register' : 'login';
  document.getElementById('auth-title').textContent = authMode === 'login' ? 'Login' : 'Register';
  document.getElementById('auth-submit').textContent = authMode === 'login' ? 'Login' : 'Register';
  document.getElementById('name-field').style.display = authMode === 'register' ? 'block' : 'none';
  document.getElementById('switch-text').textContent = authMode === 'login' ? "Don't have an account?" : 'Already have an account?';
  document.getElementById('switch-link').textContent = authMode === 'login' ? 'Register' : 'Login';
  document.getElementById('auth-error').textContent = '';
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value.trim();
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  const url = authMode === 'login' ? '/api/login' : '/api/register';
  const body = authMode === 'login' ? { email, password } : { name, email, password };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Failed';
      return;
    }
    currentUser = data.user;
    updateNav();
    showPage(currentUser.role === 'admin' ? 'admin' : 'shop');
  } catch (err) {
    errEl.textContent = 'Network error';
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  cart = [];
  updateNav();
  showPage('auth');
}

// ========== SHOP / CART ==========
async function loadProducts() {
  const res = await fetch('/api/products');
  products = await res.json();
  const list = document.getElementById('product-list');
  list.innerHTML = products.map(p => `
    <div class="product">
      <h4>${p.name}</h4>
      <div class="desc">${p.description || ''}</div>
      <div class="price">$${p.price}</div>
      <label>Size</label>
      <select id="size-${p.id}">
        ${(p.sizes || ['One Size']).map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <label>Qty</label>
      <input type="number" id="qty-${p.id}" value="1" min="1" max="20" />
      <button class="btn primary" onclick="addToCart('${p.id}')">Add to Cart</button>
    </div>
  `).join('');
  renderCart();
}

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const size = document.getElementById(`size-${productId}`).value;
  const quantity = parseInt(document.getElementById(`qty-${productId}`).value) || 1;

  const existing = cart.find(c => c.productId === productId && c.size === size);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId,
      name: product.name,
      size,
      quantity,
      unitPrice: product.price
    });
  }
  renderCart();
}

function renderCart() {
  const el = document.getElementById('cart-items');
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  const btn = document.getElementById('btn-place-order');

  countEl.textContent = cart.reduce((s, c) => s + c.quantity, 0);
  const total = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  totalEl.textContent = total;

  if (cart.length === 0) {
    el.innerHTML = '<p style="color:#718096">Cart is empty</p>';
    btn.disabled = true;
  } else {
    el.innerHTML = cart.map((c, i) => `
      <div class="cart-line">
        <span>${c.name} (${c.size}) × ${c.quantity}</span>
        <span>$${c.unitPrice * c.quantity}
          <button class="btn small" onclick="removeFromCart(${i})" style="margin-left:8px">✕</button>
        </span>
      </div>
    `).join('');
    btn.disabled = false;
  }
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

async function placeOrder() {
  if (!currentUser) {
    alert('Please login first');
    showPage('auth');
    return;
  }
  if (cart.length === 0) return;

  const items = cart.map(c => ({
    productId: c.productId,
    size: c.size,
    quantity: c.quantity
  }));

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Order failed');
      return;
    }
    cart = [];
    renderCart();
    alert(`Order placed!\nInvoice: ${data.order.invoiceNumber}\nTotal: $${data.order.total}\n\nGo to My Orders to download invoice and upload payment receipt.`);
    showPage('myorders');
  } catch (e) {
    alert('Network error');
  }
}

// ========== MY ORDERS ==========
async function loadMyOrders() {
  const res = await fetch('/api/orders/my');
  const orders = await res.json();
  const el = document.getElementById('my-orders-list');

  if (orders.length === 0) {
    el.innerHTML = '<p>No orders yet.</p>';
    return;
  }

  el.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="meta">
        <strong>${o.invoiceNumber}</strong> · ${new Date(o.createdAt).toLocaleString()}
        <span class="badge ${o.status}">${o.status}</span>
      </div>
      <div>
        ${o.items.map(i => `${i.name} (${i.size}) × ${i.quantity}`).join(', ')}
      </div>
      <div><strong>Total: $${o.total}</strong></div>
      <div class="order-actions">
        <a class="btn small" href="/api/orders/${o.id}/invoice" target="_blank">Download Invoice</a>
        ${o.status === 'pending' ? `<button class="btn small primary" onclick="openUploadModal('${o.id}', '${o.invoiceNumber}')">Upload Receipt</button>` : ''}
        ${o.receiptFile ? `<a class="btn small" href="/uploads/${o.receiptFile}" target="_blank">View Receipt</a>` : ''}
      </div>
    </div>
  `).join('');
}

function openUploadModal(orderId, invoiceNumber) {
  currentUploadOrderId = orderId;
  document.getElementById('modal-order-id').textContent = invoiceNumber;
  document.getElementById('receipt-file').value = '';
  document.getElementById('modal-error').textContent = '';
  document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  currentUploadOrderId = null;
}

async function uploadReceipt() {
  const fileInput = document.getElementById('receipt-file');
  if (!fileInput.files || !fileInput.files[0]) {
    document.getElementById('modal-error').textContent = 'Please choose a file';
    return;
  }

  const form = new FormData();
  form.append('receipt', fileInput.files[0]);

  try {
    const res = await fetch(`/api/orders/${currentUploadOrderId}/receipt`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('modal-error').textContent = data.error || 'Upload failed';
      return;
    }
    closeModal();
    alert('Receipt uploaded successfully. Order marked as PAID.');
    loadMyOrders();
  } catch (e) {
    document.getElementById('modal-error').textContent = 'Network error';
  }
}

// ========== ADMIN ==========
async function loadAdminStats() {
  const res = await fetch('/api/admin/stats');
  const s = await res.json();
  document.getElementById('admin-stats').innerHTML = `
    <div class="stat"><div class="label">Total Orders</div><div class="value">${s.totalOrders}</div></div>
    <div class="stat"><div class="label">Paid</div><div class="value">${s.paid}</div></div>
    <div class="stat"><div class="label">Pending</div><div class="value">${s.pending}</div></div>
    <div class="stat"><div class="label">Revenue</div><div class="value">$${s.revenue}</div></div>
  `;
}

async function loadAdminOrders(filter) {
  const res = await fetch('/api/orders');
  let orders = await res.json();
  if (filter === 'pending') orders = orders.filter(o => o.status === 'pending');
  if (filter === 'paid') orders = orders.filter(o => o.status === 'paid' || o.status === 'confirmed');

  const el = document.getElementById('admin-orders-list');
  if (orders.length === 0) {
    el.innerHTML = '<p>No orders.</p>';
    return;
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Parent</th>
          <th>Items</th>
          <th>Total</th>
          <th>Status</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td>${o.invoiceNumber}</td>
            <td>${o.parentName}</td>
            <td>${o.items.map(i => `${i.name}(${i.size})×${i.quantity}`).join(', ')}</td>
            <td>$${o.total}</td>
            <td><span class="badge ${o.status}">${o.status}</span></td>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            <td>
              ${o.receiptFile ? `<a href="/uploads/${o.receiptFile}" target="_blank">Receipt</a> · ` : ''}
              <a href="/api/orders/${o.id}/invoice" target="_blank">Invoice</a>
              ${o.status === 'pending' ? ` · <button class="btn small" onclick="markPaid('${o.id}')">Mark Paid</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function markPaid(orderId) {
  if (!confirm('Mark this order as paid?')) return;
  await fetch(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'paid' })
  });
  loadAdminStats();
  loadAdminOrders('all');
}

// Start
init();
