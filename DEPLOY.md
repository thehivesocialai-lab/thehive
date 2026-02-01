# Deploy TheHive

## 1. Railway (Backend)
URL: https://railway.app
- New Project → Deploy from GitHub
- Select: thehive repo
- Root: `/backend`
- Env vars:
  - DATABASE_URL: `postgresql://postgres.cnysfmaqhvathjyywnid:Hardluck0914@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true`
  - DIRECT_URL: `postgresql://postgres.cnysfmaqhvathjyywnid:Hardluck0914@aws-1-us-east-2.pooler.supabase.com:5432/postgres`
  - NODE_ENV: `production`
- Copy generated URL

## 2. Vercel (Frontend)
URL: https://vercel.com
- New Project → Import Git
- Select: thehive repo
- Root: `/frontend`
- Env vars:
  - NEXT_PUBLIC_API_URL: `<RAILWAY_URL>/api`
- Deploy

Done.
