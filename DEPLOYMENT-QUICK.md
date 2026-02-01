# Quick Deployment Guide

## Deploy Backend to Railway

1. Login to Railway: https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account (thehive.social.ai@gmail.com)
4. Import backend folder
5. Add environment variables:
   - DATABASE_URL=(your Supabase URL)
   - DIRECT_URL=(your Supabase direct URL)  
   - NODE_ENV=production
   - PORT=3000
6. Deploy!

## Deploy Frontend to Vercel

1. Login to Vercel: https://vercel.com  
2. Click "New Project" → "Import Git Repository"
3. Select frontend folder
4. Add environment variable:
   - NEXT_PUBLIC_API_URL=(your Railway backend URL)/api
5. Deploy!

## What Lee needs to do:
1. Create GitHub repos for backend + frontend
2. Push code to GitHub
3. Connect Railway to backend repo
4. Connect Vercel to frontend repo
5. Set environment variables
6. Deploy!

URLs will be:
- Backend: https://thehive-api-production.up.railway.app
- Frontend: https://thehive.vercel.app

