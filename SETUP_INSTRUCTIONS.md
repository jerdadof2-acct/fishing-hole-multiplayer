# Halley's Big Catch Friends System - Setup Instructions

## Overview
This document provides step-by-step instructions for setting up the friends system with PostgreSQL and Render deployment.

**Production:** https://kitty-creek.onrender.com

## Prerequisites
- Node.js 18+ installed
- PostgreSQL database (local or Render)
- GitHub account
- Render account

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
CREATE DATABASE halleys_big_catch;
```

3. Run the schema:
```bash
psql -d halleys_big_catch -f server/schema.sql
```

#### Option B: Render PostgreSQL
1. Create a Render account at https://render.com
2. Create a new PostgreSQL instance
3. Copy the `DATABASE_URL` from the Render dashboard
4. Set it as environment variable:
```bash
export DATABASE_URL="postgresql://user:pass@host:port/dbname"
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/halleys_big_catch
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

## Render Deployment

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

### 2. Render Setup

1. **Create Render Account**:
   - Go to https://render.com
   - Sign up with GitHub

2. **Create Web Service**:
   - New → Web Service
   - Connect your GitHub repository
   - Build: `npm install`
   - Start: `npm start`

3. **Add PostgreSQL Database**:
   - New → PostgreSQL
   - Copy `DATABASE_URL` and add it to the web service environment variables

4. **Configure Environment Variables**:
   - On the web service → Environment:
     - `DATABASE_URL` — from Render PostgreSQL
     - `NODE_ENV` = `production`
     - `PORT` — set automatically by Render
     - `FRONTEND_URL` = `https://kitty-creek.onrender.com`

5. **Run Database Migrations**:
   - Open your Render PostgreSQL shell or connect with `psql`
   - Run the contents of `server/schema.sql`

6. **Deploy**:
   - Render deploys automatically on push to `main`
   - Or trigger **Manual Deploy** from the dashboard

### 3. Frontend API URL

Production is served from **https://kitty-creek.onrender.com**. The API lives at `/api` on the same origin, so no extra client config is required.

For a split frontend/backend setup, set before bootstrap:
```html
<script>
  window.__API_BASE_URL__ = 'https://kitty-creek.onrender.com/api';
</script>
```
Or in `<head>`:
```html
<meta name="halleys-big-catch-api-base" content="https://kitty-creek.onrender.com/api">
```

## Testing the Deployment

### 1. Health Check
```bash
curl https://kitty-creek.onrender.com/api/health
```

Should return:
```json
{"status":"ok","database":"connected"}
```

### 2. Register a Player
```bash
curl -X POST https://kitty-creek.onrender.com/api/players/register \
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
- Verify `DATABASE_URL` is set correctly on the Render web service
- Check Render PostgreSQL is running
- Verify SSL settings (Render PostgreSQL requires SSL in production)

### CORS Issues
- Ensure `FRONTEND_URL` is set to `https://kitty-creek.onrender.com`
- Verify CORS middleware in `server/index.js`

### Migration Issues
- Ensure schema.sql ran successfully
- Check Render PostgreSQL logs
- Verify tables exist: `SELECT * FROM information_schema.tables;`

## Next Steps

1. ✅ Backend server running
2. ✅ Database set up
3. ⬜ Frontend integration (update Player class, add Friends UI)
4. ⬜ Test friend system end-to-end
5. ⬜ Deploy to production

## Support

For issues or questions:
- Check Render logs: dashboard → your web service → Logs
- Check database logs: dashboard → PostgreSQL → Logs
- Review `FRIENDS_SYSTEM_DESIGN.md` for architecture details
- See `RENDER_DEPLOYMENT.md` for a shorter deploy checklist
