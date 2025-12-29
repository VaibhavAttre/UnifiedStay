# UnifiedStay Deployment Guide

This guide walks you through deploying UnifiedStay to production using free tiers:
- **Frontend**: Vercel (free)
- **Backend**: Render (free)
- **Database**: Neon Postgres (free)

## Prerequisites

- GitHub account (to connect to Vercel/Render)
- Push your code to a GitHub repository

---

## Step 1: Set Up Neon Postgres Database

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create a new project called "unifiedstay"
3. Copy your connection string - it looks like:
   ```
   postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this - you'll need it for the backend

---

## Step 2: Deploy Backend to Render

### Option A: One-Click Deploy (Recommended)
1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Blueprint"
3. Connect your GitHub repo
4. Render will detect `render.yaml` and set up the service

### Option B: Manual Setup
1. Go to [render.com](https://render.com) → "New" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `unifiedstay-api`
   - **Region**: Oregon (or closest)
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**: 
     ```
     pnpm install && pnpm turbo build --filter=api && cd packages/database && npx prisma generate
     ```
   - **Start Command**: 
     ```
     cd apps/api && node dist/server.js
     ```
   - **Plan**: Free

4. Add Environment Variables in Render dashboard:
   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `HOST` | `0.0.0.0` |
   | `DATABASE_URL` | Your Neon connection string |
   | `JWT_SECRET` | Generate a random 32+ char string |
   | `FRONTEND_URL` | `https://your-app.vercel.app` (update after Vercel deploy) |

5. Click "Create Web Service"
6. Wait for deploy - copy your Render URL (e.g., `https://unifiedstay-api.onrender.com`)

### Run Database Migrations
After first deploy, you need to push the database schema:
1. In Render dashboard, go to your service → "Shell"
2. Run:
   ```bash
   cd packages/database && npx prisma db push
   ```

---

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `cd ../.. && pnpm turbo build --filter=web`
   - **Output Directory**: `dist`

5. Add Environment Variable:
   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://your-render-url.onrender.com/api` |

6. Click "Deploy"
7. Copy your Vercel URL (e.g., `https://unifiedstay.vercel.app`)

---

## Step 4: Update CORS Settings

Go back to Render and update the `FRONTEND_URL` environment variable to your Vercel URL:
```
FRONTEND_URL=https://unifiedstay.vercel.app
```

Redeploy the backend for changes to take effect.

---

## Step 5: Verify Deployment

1. Visit your Vercel URL
2. Register a new account
3. Create a property
4. Add a channel (iCal URL from Airbnb/Vrbo)
5. Verify calendar sync works

---

## Environment Variables Reference

### Backend (Render)
```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
JWT_SECRET=your-super-secret-key-min-32-chars
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (Vercel)
```env
VITE_API_URL=https://your-app.onrender.com/api
```

---

## Troubleshooting

### "Database connection failed"
- Check your Neon connection string includes `?sslmode=require`
- Verify DATABASE_URL is set correctly in Render

### "CORS error"
- Make sure FRONTEND_URL in Render matches your Vercel URL exactly
- Redeploy backend after changing FRONTEND_URL

### "Build failed on Render"
- Check build logs for errors
- Make sure pnpm-lock.yaml is committed to git

### "Calendar sync not working"
- Verify your iCal URLs are accessible
- Check Render logs for sync errors

---

## Optional: Custom Domain

### Vercel (Frontend)
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Render (Backend)
1. Go to Service Settings → Custom Domains
2. Add your API subdomain (e.g., `api.yourdomain.com`)
3. Update DNS records

Don't forget to update `FRONTEND_URL` and `VITE_API_URL` after adding custom domains!

---

## Costs

All services used have generous free tiers:

| Service | Free Tier Limits |
|---------|-----------------|
| Vercel | 100GB bandwidth, unlimited deploys |
| Render | 750 hours/month, spins down after 15min inactivity |
| Neon | 0.5GB storage, 191 compute hours/month |

For production use with more traffic, consider upgrading to paid tiers.

