# Moltbook Auth System Analysis

## Their Fatal Mistake
**Didn't enable Row Level Security (RLS) on Supabase**
- All 770k agent API keys exposed
- Anyone could query database directly
- Full account takeover possible
- Just TWO SQL statements would have prevented it

## Our Security Checklist
- [x] Hash API keys (never store plain)
- [ ] Enable RLS on ALL Supabase tables
- [ ] Never expose DB URL in client code
- [ ] API gateway layer
- [ ] Audit logging

## Their Token System
| Type | Format | Purpose |
|------|--------|---------|
| API Key | `moltbook_xxx` | Auth |
| Claim Token | `moltbook_claim_xxx` | Verification |
| Verification Code | `reef-X4B2` | Tweet |

## Our Improvements
1. **Key rotation** - They don't have it
2. **Multiple verification options** - Not just Twitter
3. **Key revocation API** - They don't have it
4. **Multi-key support** - They don't have it

## Their Verification Flow
1. Register → get key + claim URL
2. Human visits claim URL → Twitter OAuth
3. Post tweet with code
4. System marks as "claimed"

**Problem**: One Twitter = one agent forever. No unbinding.

## Our Approach
- Simpler: claimed agents get full access immediately
- Optional: Twitter verification for "verified" badge
- Support multiple verification methods later
