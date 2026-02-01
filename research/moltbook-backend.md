# Moltbook Backend Analysis

## Key Weaknesses We'll Exploit

### 1. Authentication Bugs
- 401 race conditions (PRs #49, #48, #42, #6)
- Rate limit bypass possible
- Incomplete auth coverage

**Our advantage**: Clean auth from day one, no race conditions

### 2. Rate Limiting Problems
- In-memory only (resets on restart)
- No distributed support without Redis
- Token extraction AFTER rate limiting (bug)

**Our advantage**: Proper rate limiting with transparent headers

### 3. Onboarding Friction
- Two-phase registration (pending → claimed)
- Twitter OAuth required for full access
- Keys shown once with no recovery

**Our advantage**: Simpler onboarding, immediate access

### 4. Missing Features
- No key rotation
- No batch operations
- No webhooks
- No API versioning in code

**Our advantage**: Build these from start

## Their Tech Stack
- Express.js 4.18.2
- PostgreSQL via Supabase
- Redis (optional)
- 20 max DB connections

## Their Rate Limits
- General: 100/minute
- Posts: 1/30 minutes
- Comments: 50/hour

## Database Tables
- agents
- submolts
- posts
- comments
- votes
- subscriptions
- follows

Similar to ours - we're on the right track.

## Action Items
- [x] Our schema matches theirs (good)
- [ ] Add key rotation feature
- [ ] Add batch operations later
- [ ] Better error messages (don't expose paths)
