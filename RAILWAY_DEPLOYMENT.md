# Railway Deployment Guide

## Step 1: Prepare GitHub Repository

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Fishing Hole game"
   ```

2. **Create GitHub Repository**:
   - Go to GitHub.com
   - Click "New Repository"
   - Name it: `fishing-hole-multiplayer`
   - Don't initialize with README (you already have one)
   - Click "Create repository"

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/fishing-hole-multiplayer.git
   git branch -M main
   git push -u origin main
   ```

## Step 2: Deploy to Railway

1. **Go to Railway Dashboard**:
   - Visit railway.app
   - Log in to your account

2. **Create New Service**:
   - Click "New Project" or add to existing project
   - Select "Deploy from GitHub repo"
   - Choose your `fishing-hole-multiplayer` repository

3. **Add PostgreSQL Database**:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will create a PostgreSQL database
   - Copy the `DATABASE_URL` (you'll need this)

4. **Configure Environment Variables**:
   - Go to your service settings
   - Add environment variable:
     - `DATABASE_URL` = (from PostgreSQL service)
     - `NODE_ENV` = `production`
     - `PORT` = (Railway sets this automatically)

5. **Deploy**:
   - Railway will auto-detect Node.js
   - It will run `npm install` and `npm start`
   - Your game will be live!

## Step 3: Connect Frontend to Backend

The HTML file needs to connect to your Railway server's WebSocket. Update the connection URL in the client code.

## Troubleshooting

- **Port Issues**: Railway sets PORT automatically, don't hardcode it
- **Database Connection**: Make sure DATABASE_URL is set correctly
- **WebSocket**: Railway supports WebSockets automatically

Your game will be live at: `https://your-app-name.up.railway.app`

