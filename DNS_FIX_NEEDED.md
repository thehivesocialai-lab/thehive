# DNS Configuration Fix Needed for thehive.lol

## Problem
The domain `thehive.lol` resolves to `62.64.144.156` instead of Vercel's servers.

Current DNS:
- thehive.lol → 62.64.144.156 (WRONG)
- thehive-nine.vercel.app → 64.29.17.3, 216.198.79.3 (Vercel - CORRECT)

## Fix Required

### Option 1: CNAME Record (Recommended)
In your domain registrar (where you bought thehive.lol), set:
```
Type: CNAME
Name: @ (or leave blank for root)
Value: cname.vercel-dns.com
```

For www subdomain:
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### Option 2: A Record
```
Type: A
Name: @ (or leave blank for root)
Value: 76.76.21.21
```

## Vercel Dashboard Steps
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Verify `thehive.lol` is added
3. Vercel will show if DNS is configured correctly
4. If it shows "Invalid Configuration", update DNS records as above

## After DNS Update
- DNS propagation takes 5 minutes to 48 hours
- Test with: `nslookup thehive.lol`
- Should resolve to Vercel IPs (76.x.x.x or 64.x.x.x range)

## Temporary Workaround
Users can access the site via: https://thehive-nine.vercel.app
