# Scout Uniform Ordering Platform

A simple web platform for scout parents to order uniforms, automatically generate invoices, upload payment receipts, and for admins to track who ordered and who has paid.

## Features

- Parent registration & login
- Browse uniform products, add to cart, place order
- Automatic invoice number + downloadable invoice
- Upload payment receipt → order status becomes **Paid**
- Admin dashboard: view orders, filter by status, see revenue

## Local Run

1. Install Node.js (LTS) from https://nodejs.org
2. Open terminal in this folder
3. Run:

```bash
npm install
npm start
```

4. Open http://localhost:3000

**Admin login**
- Email: `admin@scout.local`
- Password: `admin123`

## Deploy to get a Public Testing Link (Free)

### Recommended: Render.com (free)

1. Create a free account at https://render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub account (or use the manual method below)
4. Settings in Render:
   - **Name**: scout-uniform (or any name you like)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click **Create Web Service**
6. Wait 1–2 minutes. Render will give you a public URL like:
   `https://scout-uniform-xxxx.onrender.com`

That URL is your real public testing link that anyone can open.

> Note: On the free plan the app sleeps after some inactivity. The first visit after sleep may take 30–50 seconds. Data (orders & receipts) may reset when the service restarts because free hosting uses temporary storage.

### Alternative easy options
- **Railway.app**
- **Replit.com** (very beginner-friendly – you can upload the zip)

## Project Structure

```
├── server.js
├── package.json
├── README.md
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```
