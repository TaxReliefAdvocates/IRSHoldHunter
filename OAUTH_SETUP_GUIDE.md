# OAuth Setup Guide - RingCentral App Configuration

## Step 1: Configure OAuth Settings in RingCentral

### Go to: https://developers.ringcentral.com/my-account.html

1. Click your app: **AtpXtqyJ3bufjb8OL9CwbG**
2. Go to **"Settings"** tab
3. Find the **"Auth"** section

### OAuth Configuration:

**Select: "3-legged OAuth flow authorization code"** ✅

**From what type of app will you be calling the API?**
- Select: **"Server-side web app (most common)"** ✅

**OAuth Redirect URI:**
```
http://localhost:3000/oauth/callback
```
(For local development)

**For Production, add:**
```
https://your-domain.com/oauth/callback
```

**Click "Save"** ✅

---

## Step 2: Required App Permissions

Make sure these permissions are enabled in **"OAuth Settings"**:

- ✅ **CallControl** (Make and manage calls)
- ✅ **ReadAccounts** (Read account info)
- ✅ **EditExtensions** (Manage extensions)
- ✅ **WebhookSubscriptions** (Receive call events)
- ✅ **ReadCallLog** (Optional but helpful)

---

## Step 3: Start the Server

```bash
cd server
npm run dev
```

Server will start in **OAuth mode**.

You'll see:
```
🔐 OAuth Mode - Users must login via RingCentral
ℹ️  No OAuth tokens found - user needs to login
✅ Server running on port 3000
🔐 OAuth Login: http://localhost:3000/oauth/authorize
```

---

## Step 4: Login Flow

### Option A: Via Frontend (Recommended)
1. Go to: http://localhost:5173
2. Click **"Login with RingCentral"** button
3. Redirected to RingCentral login page
4. Enter **SuperAdmin credentials** ⭐
5. Click "Authorize"
6. Redirected back to app
7. Ready to use! ✅

### Option B: Direct URL
1. Go to: http://localhost:3000/oauth/authorize
2. Login with **SuperAdmin credentials**
3. Authorize the app
4. Redirected to: http://localhost:5173?auth=success
5. Ready to use! ✅

---

## What Happens After Login:

1. ✅ Access token stored in Redis
2. ✅ Refresh token stored in Redis
3. ✅ Tokens auto-refresh every hour
4. ✅ Never need to login again (until manual logout)
5. ✅ If SuperAdmin: Can call from all 68 extensions!
6. ✅ If Regular User: Can call from your extension only

---

## How to Check Auth Status:

### In Browser:
- Look at top-right corner of app
- Shows: **"Your Name (Ext XXX) ⭐ SuperAdmin"**
- Green = SuperAdmin (multi-extension)
- No star = Regular user (single extension)

### Via API:
```bash
curl http://localhost:3000/oauth/status
```

Returns:
```json
{
  "authenticated": true,
  "user": {
    "name": "Admin User",
    "extensionNumber": "101",
    "isAdmin": true
  }
}
```

---

## Logout:

Click **"Logout"** button in top-right corner.

Or via API:
```bash
curl -X POST http://localhost:3000/oauth/logout
```

---

## Troubleshooting:

### "Redirect URI mismatch" error:
- Make sure you added `http://localhost:3000/oauth/callback` in app settings
- Check exact URL matches (no trailing slash)

### "Authentication failed":
- Check app credentials in .env
- Make sure app is enabled in RingCentral
- Try regenerating Client Secret

### Tokens not refreshing:
- Check server logs for refresh errors
- May need to re-login if tokens were invalid

---

## Benefits of OAuth Flow:

✅ **Auto-refreshing tokens** - Never expire!
✅ **More secure** - No passwords in .env
✅ **Standard pattern** - Industry best practice
✅ **User-specific** - Each user can login
✅ **SuperAdmin support** - Just login with SuperAdmin account!

---

## The Magic:

**If SuperAdmin logs in:**
- ✅ Can call from extension 101
- ✅ Can call from extension 105
- ✅ Can call from all 68 extensions
- ✅ Multi-line calling works! 🎉

**If Regular User logs in:**
- ⚠️  Can only call from their own extension
- ⚠️  Need to assign phone number to their extension
- ⚠️  Limited to 1 line

---

## Next Steps:

1. ✅ Add redirect URI in RingCentral app settings
2. ✅ Save the app settings
3. ✅ Restart your server (npm run dev)
4. ✅ Go to http://localhost:5173
5. ✅ Click "Login with RingCentral"
6. ✅ Login with **SuperAdmin account**
7. ✅ Test multi-extension calling!
