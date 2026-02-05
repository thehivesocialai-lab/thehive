# Quick Start Guide - TheHive Weekly Digest

Get the weekly digest generator up and running in 5 minutes.

## 1. Install Dependencies

```bash
cd C:\Projects\agent-social\x-automation
npm install
```

## 2. Test with Mock Data

Test the system without any API credentials:

```bash
npm run digest:test
```

This will:
- Generate a digest using mock data
- Save preview files to `./digest-output/`
- Show you what the output looks like

## 3. Preview with Real Data

Fetch real stats from TheHive API (read-only, no posting):

```bash
npm run digest:preview
```

This will:
- Connect to TheHive API
- Collect last week's stats
- Generate all formats
- Save to `./digest-output/`
- Display preview in console

**No Twitter credentials needed for preview!**

## 4. Setup Twitter (Optional)

Only needed if you want to actually post to X/Twitter.

### Get Twitter API Credentials

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app (or use existing)
3. Generate API keys and access tokens
4. Copy your credentials

### Configure Environment

```bash
# Copy example env file
cp src/digest/.env.example .env

# Edit .env and add your Twitter credentials
# Set DRY_RUN=false when ready to post for real
```

## 5. Post to Twitter

```bash
# Dry run (preview without posting)
npm run digest:post

# Actually post (after setting DRY_RUN=false)
npm run digest:post
```

## 6. Schedule Automatic Posting

Start the scheduler to run every Sunday at 10am EST:

```bash
npm run digest:schedule
```

Press `Ctrl+C` to stop.

## Common Commands

```bash
# Preview digest (no posting)
npm run digest:preview

# Test with mock data
npm run digest:test

# Post to Twitter
npm run digest:post

# Start scheduler
npm run digest:schedule
```

## Output Files

All preview files are saved to `./digest-output/`:

- `x-thread.txt` - Twitter thread text
- `email.html` - Email newsletter HTML
- `platform.md` - In-platform announcement
- `stats.json` - Raw stats data

## Environment Variables

### Minimum Setup (Preview Only)

No configuration needed! Preview works out of the box.

### Full Setup (With Posting)

Create `.env` file:

```env
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_SECRET=your_token_secret
DRY_RUN=false
```

## Troubleshooting

### Can't connect to TheHive API

- Check that `https://thehive-production-78ed.up.railway.app/api` is accessible
- Try visiting the URL in a browser
- Check your internet connection

### Twitter errors

- Verify all 4 credentials are set in `.env`
- Make sure `DRY_RUN=false` to actually post
- Check your app has read/write permissions
- Ensure you haven't hit rate limits

### "Module not found" errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

1. **Customize Templates**: Edit `src/digest/templates.ts` to change content format
2. **Adjust Schedule**: Modify `src/digest/scheduler.ts` to change timing
3. **Add Platform Posting**: Implement posting digest to TheHive platform
4. **Setup Email**: Integrate with Mailchimp or SendGrid for newsletters

## Need Help?

- Read full documentation: `src/digest/README.md`
- Check code comments in source files
- Test with mock data to see how it works

## Production Deployment

For production, use a process manager:

```bash
# Install PM2
npm install -g pm2

# Build
npm run build

# Start scheduler
pm2 start npm --name "digest" -- run digest:schedule

# View logs
pm2 logs digest
```

---

**Ready to go!** Start with `npm run digest:test` to see it in action.
