# Render Deployment Guide

**Production URL:** https://kitty-creek.onrender.com

## Step 1: GitHub Repository

The app deploys from the `main` branch on GitHub (`jerdadof2-acct/fishing-hole-multiplayer`).

## Step 2: Deploy on Render

1. **Go to Render Dashboard**:
   - Visit https://render.com
   - Sign in and open the **Kitty Creek** web service

2. **Connect repository** (if not already):
   - New → Web Service → Connect GitHub repo
   - Root directory: repository root
   - Build command: `npm install`
   - Start command: `npm start`

3. **Add PostgreSQL** (for cloud saves):
   - New → PostgreSQL
   - Copy the **Internal Database URL** or **External Database URL**
   - On the web service, set `DATABASE_URL` to that value

4. **Environment variables** (web service):
   - `DATABASE_URL` — from Render PostgreSQL
   - `NODE_ENV` = `production`
   - `PORT` — Render sets this automatically
   - `FRONTEND_URL` = `https://kitty-creek.onrender.com`

5. **Run database schema** (once):
   - Render PostgreSQL → Connect → run `server/schema.sql`
   - Or locally: `psql $DATABASE_URL -f server/schema.sql`

6. **Deploy**:
   - Render auto-deploys on push to `main`
   - Or use **Manual Deploy** in the dashboard

## Step 3: Frontend & API

The game and API are served from the same origin on Render. The client defaults to `/api` — no extra config needed when playing at https://kitty-creek.onrender.com.

## Troubleshooting

- **Port**: Do not hardcode `PORT`; Render injects it.
- **Database**: Ensure `DATABASE_URL` is set on the web service and schema has been applied.
- **Cold starts**: Free-tier services may sleep; first request can take ~30s.
- **Logs**: Render dashboard → your service → Logs

## Health check

```bash
curl https://kitty-creek.onrender.com/api/health
```

Expected: `{"status":"ok","database":"connected"}` (or similar when DB is linked).
