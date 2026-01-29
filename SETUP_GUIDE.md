# IRS Hold Hunter - Complete Setup Guide

## Prerequisites

✅ **Required Software:**
- Node.js 20+
- Redis 7+
- RingCentral Account with Admin Access

✅ **RingCentral Requirements:**
- App created with Client ID & Secret
- 6+ User extensions (for hold lines)
- 1 Call Queue configured

---

## Step-by-Step Setup

### STEP 1: Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### STEP 2: Generate JWT Token

```bash
cd server
npm run generate-jwt
```

Follow the instructions displayed:
1. Go to RingCentral Developer Portal
2. Find your app with Client ID: `AtpXtqyJ3bufjb8OL9CwbG`
3. Click "Credentials" tab
4. Click "Create JWT"
5. Copy the token (starts with `eyJ...`)
6. Paste into `server/.env` as `RC_JWT_TOKEN`

### STEP 3: Test RingCentral Connection

```bash
npm run test-connection
```

**Expected Output:**
```
✅ Redis connected
✅ RingCentral authenticated
✅ Account: [Your Account Name]
✅ Token expires in: [XX] minutes
✅ Total extensions: [X]
✅ Enabled user extensions: [X]
✅ Active subscriptions: [X]
🎉 All tests passed!
```

**If Failed:**
- ❌ Redis: Start with `redis-server`
- ❌ JWT: Token expired, regenerate it
- ❌ Extensions < 6: Need more user extensions

### STEP 4: Get Extension IDs

```bash
npm run list-extensions
```

**Output Example:**
```
ID          Ext #       Name                Type        Status
────────────────────────────────────────────────────────────────
63663897001 101         John Doe            User        Enabled
63663897002 102         Jane Smith          User        Enabled
...
```

**Action Required:**
1. Pick 6 extension IDs from the list
2. Update `HOLD_EXTENSION_IDS` in `server/.env`:
   ```bash
   HOLD_EXTENSION_IDS=63663897001,63663897002,63663897003,63663897004,63663897005,63663897006
   ```

### STEP 5: Configure Queue Number

Get your Call Queue's direct phone number (not extension):

1. Go to RingCentral Admin Portal
2. Navigate to: Phone System → Groups → Call Queues
3. Click on your queue
4. Find "Phone Number" (e.g., +1-888-555-1234)
5. Update in `server/.env`:
   ```bash
   QUEUE_E164=+18885551234
   ```

### STEP 6: Start Redis

```bash
# macOS
redis-server

# Linux
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:7-alpine

# Verify
redis-cli ping  # Should return: PONG
```

### STEP 7: Start Server

```bash
cd server
npm run dev
```

**Expected Output:**
```
✅ Redis connected
✅ RingCentral SDK authenticated successfully
📡 Checking webhook subscription for: http://localhost:3000/api/webhooks/ringcentral
✅ Webhook subscription created: [subscription-id]
✅ Server running on port 3000
📡 Webhook endpoint: http://localhost:3000/api/webhooks/ringcentral
```

### STEP 8: Start Client

```bash
# New terminal
cd client
npm run dev
```

Open http://localhost:5173

### STEP 9: (Optional) Setup Ngrok for Webhook Testing

For real webhook testing, you need a public HTTPS URL:

```bash
# Install ngrok: https://ngrok.com/download

# Start ngrok
ngrok http 3000

# Copy HTTPS URL (e.g., https://abc123.ngrok.io)
# Update server/.env:
WEBHOOK_BASE_URL=https://abc123.ngrok.io

# Restart server
cd server
npm run dev
```

---

## Verification Checklist

### Server Checks
- [ ] `npm run test-connection` passes
- [ ] Server starts without errors
- [ ] Redis responds to `redis-cli ping`
- [ ] Webhook subscription created (check logs)
- [ ] `curl http://localhost:3000/health` returns `{"status":"ok"}`

### Client Checks
- [ ] Client loads at http://localhost:5173
- [ ] "Start IRS Hunt" button visible
- [ ] Socket.io connection indicator shows green
- [ ] No console errors

### Redis Data Checks
```bash
redis-cli

> KEYS *
# Should show: config:webhook_subscription_id

> GET config:webhook_subscription_id
# Should show subscription ID

> SMEMBERS active_jobs
# Should be empty initially
```

---

## First Test Run

1. **Click "Start IRS Hunt"**
   - Should see 6 call legs appear
   - Each leg starts as "DIALING"

2. **Watch Status Updates**
   - DIALING → RINGING → ANSWERED → HOLDING
   - First leg to go HOLDING → LIVE wins
   - Winner shows 🏆 trophy
   - Others hang up automatically

3. **Check Server Logs**
   ```
   🎯 [Queue] Dialing from extension...
   ✅ Call initiated: sessionId=...
   📨 Webhook received: telephony.sessions
   🎯 LIVE DETECTED: Leg [id] - IRS agent answered!
   🏆 Leg [id] WON the race!
   ✅ Transfer completed successfully
   ```

---

## Common Issues

### "Invalid JWT token"
**Solution:** Token expired, regenerate it:
```bash
npm run generate-jwt
# Follow instructions to get new token
```

### "Extension not found"
**Solution:** Verify extension IDs:
```bash
npm run list-extensions
# Copy real extension IDs to .env
```

### "Redis connection failed"
**Solution:** Start Redis:
```bash
redis-server
# In separate terminal, leave running
```

### "Webhook not receiving events"
**Solution:** Use ngrok for public HTTPS:
```bash
ngrok http 3000
# Update WEBHOOK_BASE_URL in .env with ngrok URL
# Restart server
```

### "Transfer failed"
**Causes:**
- QUEUE_E164 is wrong (must be direct number, not extension)
- Queue doesn't accept transfers (check RC admin portal)
- Call not in correct state

**Check:**
```bash
# Verify queue configured
# RC Admin → Call Queues → Your Queue → Settings
# Ensure "Allow transfers to this queue" is enabled
```

---

## Data Management

### View Current Jobs
```bash
redis-cli

> SMEMBERS active_jobs
> GET job:[job-id]
> SMEMBERS job:[job-id]:legs
> GET leg:[leg-id]
```

### Clear All Data
```bash
# Warning: Deletes everything in Redis
redis-cli FLUSHDB

# Or via npm
npm run clear-redis
```

### Data Auto-Expiry
All data automatically expires after 24 hours. No manual cleanup needed.

---

## Production Deployment

For production, see:
- **DEPLOYMENT.md** - Production setup guide
- **GO_LIVE_CHECKLIST.md** - Pre-launch checklist

Key production changes:
1. Use production RingCentral credentials
2. Set `NODE_ENV=production`
3. Use managed Redis (not local)
4. Configure proper `WEBHOOK_BASE_URL` (HTTPS)
5. Add monitoring and alerts

---

## Useful Commands

```bash
# Development
npm run dev                  # Start server in watch mode
npm run list-extensions      # List all extensions
npm run list-subscriptions   # List webhook subscriptions
npm run test-connection      # Test RC + Redis connection
npm run clear-redis          # Clear all Redis data

# Redis
redis-cli ping               # Test Redis
redis-cli KEYS *             # List all keys
redis-cli FLUSHDB            # Clear database
redis-cli MONITOR            # Watch all commands

# Logs
tail -f server/combined.log  # All logs
tail -f server/error.log     # Errors only
```

---

## Architecture Overview

**Storage:** Redis-only (no database)
- Jobs: `job:{jobId}` → JSON (24h TTL)
- Legs: `leg:{legId}` → JSON (24h TTL)
- Session Index: `session:{sessionId}:{partyId}` → legId
- Winner Lock: `job:{jobId}:winner` (60s TTL)
- Active Jobs: `active_jobs` → Set
- Config: `config:{key}` → value

**Call Flow:**
1. User starts job → Create job + 6 legs
2. Bull queue dials legs with 2s stagger
3. RingCentral webhooks stream events
4. HOLDING → ANSWERED = LIVE detection
5. First LIVE leg wins (Redis atomic lock)
6. Winner transfers to queue
7. Losers hang up
8. Frontend updates via Socket.io

---

## Support

If stuck, check:
1. **Server logs:** `tail -f combined.log`
2. **Redis data:** `redis-cli KEYS *`
3. **RC subscriptions:** `npm run list-subscriptions`
4. **Troubleshooting:** `TROUBLESHOOTING.md`

🎉 **You're ready to hunt!**
