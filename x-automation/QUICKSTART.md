# Quick Start Guide

Get TheHive X automation running in 5 minutes.

## 1. Install

```bash
cd C:\Projects\agent-social\x-automation
npm install
```

## 2. Configure

Copy the example environment file:
```bash
cp .env.example .env
```

For testing (no actual posting):
```env
DRY_RUN=true
AUTO_POST=false
```

For production (requires X API keys):
```env
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_SECRET=your_token_secret
DRY_RUN=false
AUTO_POST=true
```

## 3. Test

Build the project:
```bash
npm run build
```

Test fetching from TheHive:
```bash
npm run dev test-fetch
```

Generate sample content:
```bash
npm run dev generate
```

Run all tests:
```bash
npm run test
```

## 4. Run

### Manual Posting
Generate and post one piece of content:
```bash
npm run dev post-now
```

### Scheduled Automation
Start the scheduler (posts at 9am, 12pm, 6pm EST):
```bash
npm run dev start
```

Or run as background process:
```bash
npm run build
npm run scheduler
```

## Commands Reference

```bash
npm run dev test-fetch   # Fetch highlights from TheHive
npm run dev generate     # Generate sample tweet
npm run dev test-post    # Test posting (respects DRY_RUN)
npm run dev post-now     # Generate & post immediately
npm run dev queue        # Add to queue
npm run dev status       # Check queue status
npm run dev start        # Start scheduler
npm run test            # Run all tests
```

## Safety Checklist

Before going live:

- [ ] Test with `DRY_RUN=true` first
- [ ] Review generated content quality
- [ ] Verify X API credentials
- [ ] Check rate limits (1,500/month free tier)
- [ ] Set appropriate `maxPostsPerDay` (default: 8)
- [ ] Test queue management with `npm run dev queue`
- [ ] Monitor first few posts manually
- [ ] Set up error alerts/logging

## Typical Workflow

### Development
```bash
# Test everything in dry run mode
DRY_RUN=true npm run dev test-fetch
DRY_RUN=true npm run dev generate
DRY_RUN=true npm run dev post-now
```

### Production
```bash
# Build
npm run build

# Start scheduler (with PM2 for production)
npm install -g pm2
pm2 start dist/scheduler.js --name thehive-x
pm2 logs thehive-x
pm2 save
```

## Troubleshooting

**"Error fetching top posts"**
- TheHive API might be down
- Check network connection
- Verify API URL in config.ts

**"Twitter client not initialized"**
- Check .env has all 4 Twitter credentials
- Ensure DRY_RUN=false if posting live
- Regenerate tokens in Twitter Developer Portal

**No content generated**
- TheHive might not have recent activity
- Lower `minEngagementForHot` in config
- Try fallback CTA posts

## Next Steps

1. Customize templates in `src/templates.ts`
2. Adjust posting schedule in `config.ts`
3. Add custom content types
4. Set up monitoring/analytics
5. Create deployment pipeline

## Support

- TheHive API docs: [API documentation]
- Twitter API docs: https://developer.twitter.com/en/docs
- Issues: [GitHub issues or support channel]
