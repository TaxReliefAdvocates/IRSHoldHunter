# Quick Render Setup

## Option 1: One-Click Blueprint Deploy

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click **New** → **Blueprint**
4. Connect your GitHub repo
5. Render detects `render.yaml` automatically
6. Click **Apply**

## Required Environment Variables

Before deploying, you'll need to set these in Render's dashboard:

```bash
# Get from RingCentral Developer Portal
RC_CLIENT_ID=<your-value>
RC_CLIENT_SECRET=<your-value>
RC_JWT_TOKEN=<your-superadmin-jwt>

# Your Render app URL (after first deploy)
WEBHOOK_BASE_URL=https://your-app-name.onrender.com
```

## After Deploy

1. Note your app URL: `https://your-app-name.onrender.com`
2. Add OAuth redirect URI to RingCentral:
   - Go to https://developers.ringcentral.com/my-account.html
   - Add: `https://your-app-name.onrender.com/oauth/callback`
3. Visit your app and login!

## What Gets Deployed

- **Web Service**: Node.js app (server + frontend)
- **Redis**: Free Redis instance for data storage

## Free Tier Notes

- App sleeps after 15min inactivity (30s cold start)
- 750 hours/month free runtime
- Perfect for testing with SuperAdmin!

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)
