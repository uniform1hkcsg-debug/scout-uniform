/**
 * Scout Uniform Ordering Platform
 * - Parents: browse, order, auto-invoice, upload payment receipt
 * - Admin: view who ordered, who paid, manage products
 * Database: simple JSON files (easy to replace with real DB later)
 */

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure folders exist
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Simple JSON DB helpers
function loadDB(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    const empty = name === 'products' ? getDefaultProducts() : [];
    fs.writeFileSync(file, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveDB(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getDefaultProducts() {
  return [
    { id: 'p1', name: 'Scout Uniform Shirt', description: 'Official scout shirt (short sleeve)', price: 180, sizes: ['XS','S','M','L','XL','XXL'], stock: 50 },
    { id: 'p2', name: 'Scout Uniform Trousers', description: 'Official scout trousers', price: 220, sizes: ['XS','S','M','L','XL','XXL'], stock: 40 },
    { id: 'p3', name: 'Scout Cap / Beret', description: 'Official headwear', price: 80, sizes: ['One Size'], stock: 60 },
    { id: 'p4', name: 'Scout Neckerchief', description: 'Group neckerchief', price: 45, sizes: ['One Size'], stock: 100 },
    { id: 'p5', name: 'Scout Belt', description: 'Leather scout belt with buckle', price: 90, sizes: ['S','M','L'], stock: 30 }
  ];
}

// Seed admin user if none
function ensureAdmin() {
  let users = loadDB('users');
  if (!users.find(u => u.role === 'admin')) {
    users.push({
      id: 'admin1',
      name: 'Admin',
      email: 'admin@scout.local',
      password: 'admin123', // demo only – change in production
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    saveDB('users', users);
  }
}
ensureAdmin();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'scout-uniform-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

// Multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${randomUUID().slice(0, 8)}${path.extname(file.originalname)}`;
    cb(null, unique);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only images and PDF allowed'));
  }
});

// Auth helpers
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please login first' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

// ========== AUTH ==========
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });

  let users = loadDB('users');
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const user = {
    id: randomUUID(),
    name,
    email: email.toLowerCase(),
    password, // demo – use bcrypt in production
    role: 'parent',
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveDB('users', users);

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;

  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = loadDB('users');
  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;

  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const users = loadDB('users');
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// ========== PRODUCTS ==========
app.get('/api/products', (req, res) => {
  res.json(loadDB('products'));
});

app.post('/api/products', requireAdmin, (req, res) => {
  const { name, description, price, sizes, stock } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });

  let products = loadDB('products');
  const product = {
    id: randomUUID(),
    name,
    description: description || '',
    price: Number(price),
    sizes: sizes || ['One Size'],
    stock: Number(stock) || 0
  };
  products.push(product);
  saveDB('products', products);
  res.json(product);
});

// ========== ORDERS ==========
app.post('/api/orders', requireLogin, (req, res) => {
  const { items } = req.body; // [{ productId, size, quantity }]
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items in order' });
  }

  const products = loadDB('products');
  let total = 0;
  const orderItems = [];

  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) return res.status(400).json({ error: `Product not found: ${item.productId}` });
    const qty = Math.max(1, Number(item.quantity) || 1);
    const lineTotal = product.price * qty;
    total += lineTotal;
    orderItems.push({
      productId: product.id,
      name: product.name,
      size: item.size || 'One Size',
      quantity: qty,
      unitPrice: product.price,
      lineTotal
    });
  }

  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  const order = {
    id: randomUUID(),
    userId: req.session.userId,
    parentName: req.session.name,
    items: orderItems,
    total,
    status: 'pending', // pending | paid | confirmed
    invoiceNumber,
    createdAt: new Date().toISOString(),
    paidAt: null,
    receiptFile: null
  };

  let orders = loadDB('orders');
  orders.push(order);
  saveDB('orders', orders);

  res.json({ ok: true, order });
});

app.get('/api/orders/my', requireLogin, (req, res) => {
  const orders = loadDB('orders').filter(o => o.userId === req.session.userId);
  res.json(orders.reverse());
});

app.get('/api/orders', requireAdmin, (req, res) => {
  const orders = loadDB('orders');
  res.json(orders.reverse());
});

app.get('/api/orders/:id', requireLogin, (req, res) => {
  const orders = loadDB('orders');
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.session.role !== 'admin' && order.userId !== req.session.userId) {
    return res.status(403).json({ error: 'Not your order' });
  }
  res.json(order);
});

// Upload payment receipt → auto update status to "paid"
app.post('/api/orders/:id/receipt', requireLogin, upload.single('receipt'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let orders = loadDB('orders');
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });

  const order = orders[idx];
  if (req.session.role !== 'admin' && order.userId !== req.session.userId) {
    return res.status(403).json({ error: 'Not your order' });
  }

  order.receiptFile = req.file.filename;
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  orders[idx] = order;
  saveDB('orders', orders);

  res.json({ ok: true, order, message: 'Receipt uploaded. Order marked as paid.' });
});

// Admin can manually mark paid / confirmed
app.patch('/api/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!['pending', 'paid', 'confirmed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  let orders = loadDB('orders');
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });

  orders[idx].status = status;
  if (status === 'paid' && !orders[idx].paidAt) {
    orders[idx].paidAt = new Date().toISOString();
  }
  saveDB('orders', orders);
  res.json({ ok: true, order: orders[idx] });
});

// Simple invoice text (can be upgraded to PDF later)
app.get('/api/orders/:id/invoice', requireLogin, (req, res) => {
  const orders = loadDB('orders');
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.session.role !== 'admin' && order.userId !== req.session.userId) {
    return res.status(403).json({ error: 'Not your order' });
  }

  let text = `========================================\n`;
  text += `       SCOUT UNIFORM INVOICE\n`;
  text += `========================================\n`;
  text += `Invoice No : ${order.invoiceNumber}\n`;
  text += `Date       : ${new Date(order.createdAt).toLocaleString()}\n`;
  text += `Parent     : ${order.parentName}\n`;
  text += `Status     : ${order.status.toUpperCase()}\n`;
  text += `----------------------------------------\n`;
  order.items.forEach(item => {
    text += `${item.name} (${item.size}) x${item.quantity}  @ $${item.unitPrice} = $${item.lineTotal}\n`;
  });
  text += `----------------------------------------\n`;
  text += `TOTAL: $${order.total}\n`;
  text += `========================================\n`;
  text += `Please pay and upload receipt in the system.\n`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${order.invoiceNumber}.txt"`);
  res.send(text);
});

// Dashboard stats for admin
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const orders = loadDB('orders');
  const totalOrders = orders.length;
  const paid = orders.filter(o => o.status === 'paid' || o.status === 'confirmed').length;
  const pending = orders.filter(o => o.status === 'pending').length;
  const revenue = orders
    .filter(o => o.status === 'paid' || o.status === 'confirmed')
    .reduce((sum, o) => sum + o.total, 0);

  res.json({ totalOrders, paid, pending, revenue });
});

// Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Scout Uniform Platform running at http://localhost:${PORT}`);
  console.log(`   Admin login : admin@scout.local / admin123`);
  console.log(`   Data folder : ${DATA_DIR}`);
  console.log(`   Uploads     : ${UPLOADS_DIR}\n`);
});
