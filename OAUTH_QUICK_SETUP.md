# OAuth Quick Setup Guide

## Status
✅ OAuth is now the primary authentication method  
✅ JWT fallback available for testing (optional)

## RingCentral App Configuration

### Required Settings

1. **Go to:** https://developers.ringcentral.com/my-account.html

2. **Click your app** (Client ID: AtpXtqyJ3bufjb8OL9CwbG)

3. **Auth Settings:**
   - Select: **● 3-legged OAuth flow authorization code**
   - App Type: **Server-side web app**

4. **OAuth Redirect URI:**
   ```
   http://localhost:3000/oauth/callback
   ```

5. **Required Permissions:**
   - ReadAccounts
   - EditExtensions
   - ReadCallLog
   - ReadCallRecording
   - ReadPresence
   - EditPresence
   - RingOut
   - WebhookSubscriptions
   - EditCallLog

6. **CLICK SAVE** and wait 30 seconds for changes to propagate

## Using OAuth

### Start the Application

```bash
# Backend (port 3000)
cd server && npm run dev

# Frontend (port 5173)
cd client && npm run dev
```

### Login Flow

1. Go to: http://localhost:5173
2. Click "Login with RingCentral"
3. Authorize the app in RingCentral
4. You'll be redirected back to the app
5. Start using the application

### Check Auth Status

```bash
curl http://localhost:3000/oauth/status
```

### Logout

Click the logout button in the UI, or:

```bash
curl -X POST http://localhost:3000/oauth/logout
```

## OAuth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/authorize` | GET | Redirects to RingCentral login |
| `/oauth/callback` | GET | Handles OAuth callback |
| `/oauth/status` | GET | Check authentication status |
| `/oauth/logout` | POST | Logout and revoke tokens |

## Token Management

- Tokens stored in Redis
- Auto-refresh handled by RingCentral SDK
- Refresh events logged and saved automatically
- Tokens cleared on logout

## JWT Fallback (Testing Only)

To use JWT instead of OAuth:

1. Uncomment JWT token in `server/.env`:
   ```bash
   RC_JWT_TOKEN=your_jwt_token_here
   ```

2. Restart server

3. App will authenticate with JWT automatically

JWT bypasses the login screen and provides full access.

## Troubleshooting

### "No redirect URI is registered"
- Add `http://localhost:3000/oauth/callback` to RingCentral app
- Click SAVE
- Wait 30 seconds

### "Unauthorized for this grant type"
- Select "3-legged OAuth flow authorization code" in RingCentral app
- Select "Server-side web app"
- Click SAVE
- Wait 30 seconds

### Tokens not refreshing
- Check server logs for refresh events
- Verify refresh_token is stored in Redis
- Try logging out and back in

### Frontend stuck on "Loading..."
- Check `/oauth/status` endpoint
- Verify proxy settings in `vite.config.ts`
- Restart Vite dev server

## What Changed

### Removed
- JWT as primary auth (now fallback only)
- Frontend auth bypass for testing

### Added
- OAuth as primary authentication
- Token refresh handling
- Proper logout with token revocation
- Auth status endpoint with JWT fallback detection
- Better error handling and logging

### Improved
- Token restoration on server startup
- Invalid token cleanup
- SuperAdmin detection
- User info display in UI
