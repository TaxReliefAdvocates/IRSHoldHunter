# IRS Hold Hunter - Quick Reference

## 🚀 Startup Sequence

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Server
cd server
npm run dev

# Terminal 3: Client
cd client
npm run dev

# Browser
open http://localhost:5173
```

## 📋 Initial Setup Commands

```bash
# 1. Generate JWT instructions
npm run generate-jwt

# 2. Test connection (after JWT set)
npm run test-connection

# 3. List extensions
npm run list-extensions

# 4. Update .env with extension IDs
# HOLD_EXTENSION_IDS=id1,id2,id3,id4,id5,id6
```

## 🔍 Debugging Commands

```bash
# Test RingCentral + Redis
npm run test-connection

# List all extensions
npm run list-extensions

# List webhook subscriptions
npm run list-subscriptions

# View Redis data
redis-cli KEYS *
redis-cli GET config:webhook_subscription_id
redis-cli SMEMBERS active_jobs

# Clear all Redis data
redis-cli FLUSHDB
# or
npm run clear-redis

# Monitor Redis in real-time
redis-cli MONITOR

# View logs
tail -f server/combined.log
tail -f server/error.log

# Watch for LIVE detection
tail -f server/combined.log | grep -E "LIVE|transfer|WON"
```

## 🔑 Environment Variables (Required)

```bash
# RingCentral
RC_CLIENT_ID=AtpXtqyJ3bufjb8OL9CwbG
RC_CLIENT_SECRET=35hUKtqVrdAav3mcFwNUohbAnXHQKdiT9ajJNTpGVG9Y
RC_JWT_TOKEN=<get-from-rc-console>

# System
IRS_NUMBER=+18008291040
QUEUE_E164=+18885551234  # Must be direct number, not extension
HOLD_EXTENSION_IDS=id1,id2,id3,id4,id5,id6  # 6 extension IDs

# Redis
REDIS_URL=redis://localhost:6379

# Server (optional)
PORT=3000
WEBHOOK_BASE_URL=http://localhost:3000  # Use ngrok URL for testing
CLIENT_URL=http://localhost:5173
```

## 📊 Redis Data Structure

```bash
# Jobs
job:{jobId}                     # Job data (JSON)

# Legs
leg:{legId}                     # Leg data (JSON)
job:{jobId}:legs                # Set of leg IDs for job

# Indexes
session:{sessionId}:{partyId}   # Maps session to leg ID

# Locks
job:{jobId}:winner              # Winner lock (60s TTL)

# Tracking
active_jobs                     # Set of all active job IDs

# Config
config:webhook_subscription_id  # RC webhook subscription ID
```

## 🧪 Test Sequence

1. ✅ `redis-cli ping` → PONG
2. ✅ `npm run test-connection` → All tests pass
3. ✅ `npm run list-extensions` → Shows extensions
4. ✅ Server starts without errors
5. ✅ Client loads at http://localhost:5173
6. ✅ Click "Start IRS Hunt"
7. ✅ 6 legs appear
8. ✅ Legs dial with 2s stagger
9. ✅ Status updates in real-time
10. ✅ First LIVE wins (🏆 trophy)
11. ✅ Winner transfers
12. ✅ Losers hang up

## 🚨 Common Issues

### JWT Token Invalid
```bash
# Solution: Regenerate token
npm run generate-jwt
# Follow instructions, update .env
```

### Redis Not Running
```bash
# Solution: Start Redis
redis-server
```

### Extensions Not Found
```bash
# Solution: Use real extension IDs
npm run list-extensions
# Copy IDs to HOLD_EXTENSION_IDS in .env
```

### Webhook Not Received
```bash
# Solution: Use ngrok for public HTTPS
ngrok http 3000
# Update WEBHOOK_BASE_URL in .env with ngrok URL
# Restart server
```

### Transfer Failed
```bash
# Causes:
# - QUEUE_E164 wrong (must be direct number)
# - Queue doesn't accept transfers
# - Check RC Admin → Call Queue → Settings
```

## 📡 API Endpoints

```bash
# Start job
curl -X POST http://localhost:3000/api/jobs/start

# Get job
curl http://localhost:3000/api/jobs/{jobId}

# Stop job
curl -X POST http://localhost:3000/api/jobs/{jobId}/stop

# List jobs
curl http://localhost:3000/api/jobs

# Health check
curl http://localhost:3000/health
```

## 📦 Key Services

**RCService** - RingCentral API wrapper
- `initiatePlaceCall()` - Start outbound call
- `transferToQueue()` - Transfer call to queue
- `hangUpParty()` - End call
- `createWebhookSubscription()` - Setup webhook

**JobService** - Job orchestration
- `startJob()` - Create job + 6 legs
- `getJob()` - Fetch job with legs
- `stopJob()` - Stop all legs

**TransferService** - Winner logic
- `attemptTransfer()` - Try to win + transfer
- `cleanupLosingLegs()` - Hang up losers

**WebhookService** - Event processing
- `processSessionEvent()` - Handle webhook
- Live detection: HOLDING → ANSWERED = LIVE

**RedisStore** - Data layer
- `createJob()` / `getJob()` / `updateJob()`
- `createCallLeg()` / `getCallLeg()` / `updateCallLeg()`
- `acquireWinnerLock()` - Atomic lock

## 🎯 Critical Code Paths

### Live Detection
```typescript
// WebhookService.ts
if (previousStatus === 'HOLDING' && party.status.code === 'Answered') {
  newStatus = 'LIVE';
  setImmediate(() => transferService.attemptTransfer(jobId, legId));
}
```

### Winner Lock
```typescript
// RedisStore.ts
async acquireWinnerLock(jobId: string, legId: string): Promise<boolean> {
  const result = await this.redis.set(`job:${jobId}:winner`, legId, 'EX', 60, 'NX');
  return result === 'OK';  // Only first leg gets true
}
```

### Staggered Dialing
```typescript
// JobService.ts
for (let i = 0; i < 6; i++) {
  await dialQueue.add({ legId, extensionId, irsNumber }, {
    delay: i * 2000  // 0s, 2s, 4s, 6s, 8s, 10s
  });
}
```

## 🔐 Production Checklist

- [ ] Use production RC credentials
- [ ] Set `NODE_ENV=production`
- [ ] Use managed Redis (not local)
- [ ] Configure HTTPS `WEBHOOK_BASE_URL`
- [ ] Add monitoring (Datadog, etc.)
- [ ] Setup log aggregation
- [ ] Configure alerts
- [ ] Add rate limiting
- [ ] Implement auth on frontend
- [ ] Document runbook

## 📞 Support Contacts

- **RingCentral Support:** https://support.ringcentral.com
- **Redis Documentation:** https://redis.io/docs
- **Project Issues:** GitHub Issues

## 📚 Full Documentation

- **README.md** - Overview
- **SETUP_GUIDE.md** - Detailed setup
- **DEPLOYMENT.md** - Production deployment
- **TESTING.md** - Testing guide
- **TROUBLESHOOTING.md** - Issue resolution
- **GO_LIVE_CHECKLIST.md** - Launch checklist

---

**Version:** 2.0.0 (Redis-Only Edition)  
**Last Updated:** 2025-01-27
