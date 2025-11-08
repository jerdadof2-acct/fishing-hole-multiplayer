# Kitty Creek Friends System - Setup Instructions

## Overview
This document provides step-by-step instructions for setting up the friends system with PostgreSQL and Railway deployment.

## Prerequisites
- Node.js 18+ installed
- PostgreSQL database (local or Railway)
- GitHub account
- Railway account

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup

#### Option A: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a database:
```sql
CREATE DATABASE kitty_creek;
```

3. Run the schema:
```bash
psql -d kitty_creek -f server/schema.sql
```

#### Option B: Railway PostgreSQL
1. Create a Railway account
2. Create a new PostgreSQL service
3. Copy the `DATABASE_URL` from Railway
4. Set it as environment variable:
```bash
export DATABASE_URL="postgresql://user:pass@host:port/dbname"
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/kitty_creek
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 4. Start the Server
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

The server will run on `http://localhost:3000`

### 5. Test the API
```bash
curl http://localhost:3000/api/health
```

## Railway Deployment

### 1. GitHub Setup

1. **Initialize Git** (if not already):
```bash
git init
git add .
git commit -m "Initial commit with friends system"
```

2. **Create GitHub Repository**:
   - Go to GitHub.com
   - Create a new repository
   - Don't initialize with README (we already have files)

3. **Push to GitHub**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 2. Railway Setup

1. **Create Railway Account**:
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL Database**:
   - In Railway project, click "+ New"
   - Select "Database" → "Add PostgreSQL"
   - Railway will automatically provide `DATABASE_URL`

4. **Configure Environment Variables**:
   - Go to your service → Variables
   - Add these variables:
     - `DATABASE_URL` - Automatically set by Railway PostgreSQL
     - `NODE_ENV` = `production`
     - `PORT` - Automatically set by Railway
     - `FRONTEND_URL` = Your production domain (e.g., `https://your-app.railway.app`)

5. **Run Database Migrations**:
   - Go to your PostgreSQL service in Railway
   - Click "Connect" → "Query"
   - Copy and paste the contents of `server/schema.sql`
   - Run the query

   OR use Railway CLI:
   ```bash
   railway login
   railway link
   railway run psql $DATABASE_URL -f server/schema.sql
   ```

6. **Deploy**:
   - Railway will automatically deploy on push to main
   - Or click "Deploy" in Railway dashboard

### 3. Update Frontend API URL

Once deployed, update your frontend to use the Railway URL:

1. In Railway, copy your service URL (e.g., `https://kitty-creek-production.up.railway.app`)
2. Update `index.html` so the frontend knows where to find the API:
   ```html
   <script>
     window.__API_BASE_URL__ = 'https://kitty-creek-production.up.railway.app/api';
   </script>
   ```
   Place this snippet **before** the `<script type="module" src="src/bootstrap.js"></script>` line.
3. Alternatively, add a meta tag inside `<head>`:
   ```html
   <meta name="kitty-creek-api-base" content="https://kitty-creek-production.up.railway.app/api">
   ```
4. If the game is served from the same origin as the API, no extra configuration is required (it defaults to `/api`).

## Testing the Deployment

### 1. Health Check
```bash
curl https://your-railway-url.railway.app/api/health
```

Should return:
```json
{"status":"ok","database":"connected"}
```

### 2. Register a Player
```bash
curl -X POST https://your-railway-url.railway.app/api/players/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}'
```

Should return:
```json
{
  "userId": "uuid",
  "username": "testuser",
  "friendCode": "ABC123",
  ...
}
```

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check Railway PostgreSQL service is running
- Verify SSL settings (Railway requires SSL)

### CORS Issues
- Ensure `FRONTEND_URL` is set correctly
- Check Railway service URL matches your domain
- Verify CORS middleware in `server/index.js`

### Migration Issues
- Ensure schema.sql ran successfully
- Check Railway PostgreSQL logs
- Verify tables exist: `SELECT * FROM information_schema.tables;`

## Next Steps

1. ✅ Backend server running
2. ✅ Database set up
3. ⬜ Frontend integration (update Player class, add Friends UI)
4. ⬜ Test friend system end-to-end
5. ⬜ Deploy to production

## Support

For issues or questions:
- Check Railway logs: Railway dashboard → Your service → Logs
- Check database logs: Railway dashboard → PostgreSQL → Logs
- Review `FRIENDS_SYSTEM_DESIGN.md` for architecture details



