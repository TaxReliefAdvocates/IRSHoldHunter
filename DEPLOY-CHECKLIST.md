# Render Deployment Checklist

Use this checklist to deploy step-by-step.

## Pre-Deploy Checklist

- [ ] Code is working locally
- [ ] All changes are committed
- [ ] Code is pushed to GitHub
- [ ] You have SuperAdmin RingCentral credentials ready:
  - [ ] Client ID
  - [ ] Client Secret  
  - [ ] JWT Token

## Deploy Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### 2. Create Render Account
- [ ] Go to https://render.com and sign up (free)
- [ ] Connect your GitHub account

### 3. Deploy via Blueprint
- [ ] Click **New** → **Blueprint**
- [ ] Select your GitHub repo
- [ ] Render detects `render.yaml`
- [ ] Click **Apply**

### 4. Set Environment Variables
In the Render dashboard, go to your web service → **Environment** tab:

- [ ] Add `RC_CLIENT_ID` = (your RingCentral client ID)
- [ ] Add `RC_CLIENT_SECRET` = (your RingCentral client secret)
- [ ] Add `RC_JWT_TOKEN` = (your SuperAdmin JWT token)
- [ ] Wait for app to deploy and note the URL

### 5. Update RingCentral OAuth
- [ ] Go to https://developers.ringcentral.com/my-account.html
- [ ] Select your app
- [ ] Go to **Settings** → **OAuth Settings**
- [ ] Add redirect URI: `https://your-app-name.onrender.com/oauth/callback`
- [ ] **Save**

### 6. Set Webhook URL (Optional but recommended)
Back in Render → **Environment** tab:
- [ ] Add `WEBHOOK_BASE_URL` = `https://your-app-name.onrender.com`
- [ ] Click **Save Changes** (app will redeploy)

### 7. Test the App
- [ ] Visit `https://your-app-name.onrender.com`
- [ ] Click **Login with RingCentral**
- [ ] Login with SuperAdmin account
- [ ] Verify you see your extension
- [ ] Click **Sync Extensions** to load all extensions
- [ ] Try starting a test job with an extension that has a phone number

## Post-Deploy

- [ ] Share the URL with your SuperAdmin for testing
- [ ] Monitor logs in Render dashboard
- [ ] Check `/health` endpoint: `https://your-app-name.onrender.com/health`

## Troubleshooting

### Build fails?
→ Check Render logs, fix errors locally, commit and push

### Can't login?
→ Verify OAuth redirect URI is correct in RingCentral settings

### Calls fail?
→ Ensure you're logged in as SuperAdmin with JWT token
→ Ensure extensions have direct phone numbers assigned

### App is slow?
→ Free tier sleeps after 15min inactivity (30s cold start is normal)
→ First request wakes it up

## Success Indicators

✅ Build completes successfully  
✅ App is "Live" in Render dashboard  
✅ `/health` endpoint returns `{"status":"ok"}`  
✅ Can login with RingCentral  
✅ Extensions show in the UI  
✅ Can start a job (if using extension with phone number)

## Need Help?

See detailed guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
