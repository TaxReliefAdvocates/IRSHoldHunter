# Deployment Guide - Render

This guide walks you through deploying the IRS Hold Hunter to Render.

## Prerequisites

1. A GitHub account with your code pushed to a repository
2. A Render account (free tier works)
3. Your RingCentral credentials:
   - Client ID
   - Client Secret
   - JWT Token (for SuperAdmin access)

## Step 1: Push Code to GitHub

If you haven't already, push your code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Step 2: Deploy to Render

### Option A: Using Render Blueprint (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file
5. Click **"Apply"**

### Option B: Manual Setup

If the blueprint doesn't work, follow these manual steps:

#### 2.1: Create Redis Instance

1. Go to Render Dashboard → **"New"** → **"Redis"**
2. Name: `irs-hunter-redis`
3. Plan: **Free**
4. Click **"Create Redis"**
5. **Copy the Internal Redis URL** (you'll need this later)

#### 2.2: Create Web Service

1. Go to Render Dashboard → **"New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `irs-hold-hunter`
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**:
     ```bash
     cd server && npm install && npm run build && cd ../client && npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     cd server && npm start
     ```
   - **Plan**: Free

## Step 3: Configure Environment Variables

In your Render Web Service settings, go to **"Environment"** tab and add these variables:

### Required Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `RC_SERVER_URL` | `https://platform.ringcentral.com` | Production URL |
| `RC_CLIENT_ID` | `<your-client-id>` | From RingCentral Developer Portal |
| `RC_CLIENT_SECRET` | `<your-client-secret>` | From RingCentral Developer Portal |
| `RC_JWT_TOKEN` | `<your-jwt-token>` | SuperAdmin JWT token |
| `REDIS_URL` | `<redis-internal-url>` | From step 2.1 |
| `PORT` | `10000` | Render's default port |
| `NODE_ENV` | `production` | |

### Optional Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `IRS_NUMBER` | `+18008291040` | Default IRS phone number |
| `QUEUE_E164` | `+18885551234` | Default queue number |
| `WEBHOOK_BASE_URL` | `<your-render-url>` | Your app's URL (e.g., `https://irs-hold-hunter.onrender.com`) |

## Step 4: Update RingCentral OAuth Settings

1. Go to [RingCentral Developer Portal](https://developers.ringcentral.com/my-account.html)
2. Select your app
3. Go to **"Settings"** → **"OAuth"**
4. Add your Render URL to **OAuth Redirect URIs**:
   ```
   https://your-app-name.onrender.com/oauth/callback
   ```
5. Save changes

## Step 5: First Deploy

1. Click **"Create Web Service"** (or **"Save Changes"**)
2. Render will start building and deploying your app
3. Wait for the build to complete (5-10 minutes for first deploy)
4. Once deployed, you'll see a URL like: `https://irs-hold-hunter.onrender.com`

## Step 6: Test the Deployment

1. Visit your app URL
2. Click **"Login with RingCentral"**
3. Authenticate with a SuperAdmin account
4. Try syncing extensions and starting a job

## Troubleshooting

### Build Fails

**Check the build logs** in Render dashboard. Common issues:
- Missing dependencies → Ensure `package.json` is correct
- TypeScript errors → Fix any type errors locally first
- Build timeout → Free tier has 15min build limit

### App Crashes on Start

**Check the runtime logs**. Common issues:
- Missing environment variables → Verify all required vars are set
- Redis connection fails → Check `REDIS_URL` is correct
- Port binding issues → Ensure `PORT=10000`

### OAuth Doesn't Work

- Verify redirect URI is added to RingCentral app settings
- Check `RC_CLIENT_ID` and `RC_CLIENT_SECRET` are correct
- Ensure you're using the **production** RingCentral credentials

### Calls Fail

- **No direct phone number**: Extensions need direct phone numbers assigned
- **Insufficient permissions**: SuperAdmin JWT token required
- **Webhook issues**: Set `WEBHOOK_BASE_URL` to your Render URL

### Free Tier Limitations

Render's free tier has:
- Service spins down after 15 minutes of inactivity (cold start takes ~30 seconds)
- 750 hours/month runtime
- 512MB RAM
- 0.1 CPU

For production use, consider upgrading to a paid plan.

## Monitoring

### View Logs

Go to your service in Render → **"Logs"** tab to see real-time logs.

### Health Check

Visit `https://your-app.onrender.com/health` to verify the server is running.

## Updating Your App

After making changes locally:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Render will automatically detect the push and redeploy your app.

## Security Notes

1. **Never commit** `.env` files to Git
2. **Use Render's environment variables** for all secrets
3. **Rotate credentials** regularly
4. Consider using **IP allowlisting** for Redis in production

## Need Help?

- Check Render's [documentation](https://render.com/docs)
- View your service logs for errors
- Test locally first: `npm run dev` (in both client and server folders)
