# Troubleshooting Guide

Common issues and solutions for IRS Hold Hunter.

## Table of Contents
- [Installation Issues](#installation-issues)
- [Server Issues](#server-issues)
- [Database Issues](#database-issues)
- [RingCentral Issues](#ringcentral-issues)
- [Webhook Issues](#webhook-issues)
- [Redis Issues](#redis-issues)
- [Frontend Issues](#frontend-issues)
- [Call Flow Issues](#call-flow-issues)
- [Performance Issues](#performance-issues)

## Installation Issues

### "Module not found" errors

```bash
# Clear caches and reinstall
cd server
rm -rf node_modules package-lock.json
npm install

cd ../client
rm -rf node_modules package-lock.json
npm install
```

### TypeScript compilation errors

```bash
# Regenerate Prisma client
cd server
npx prisma generate

# Rebuild
npm run build
```

### Port already in use

```bash
# Find process using port
lsof -i :3000
# or
lsof -i :5173

# Kill process
kill -9 <PID>

# Or change port in .env (server) or vite.config.ts (client)
```

## Server Issues

### "Failed to start server"

**Check Redis connection:**
```bash
redis-cli ping
# Should return: PONG

# If not running:
brew services start redis  # macOS
sudo systemctl start redis  # Linux
```

**Check database:**
```bash
cd server
npx prisma migrate status
# If migrations pending:
npx prisma migrate dev
```

**Check environment variables:**
```bash
cd server
cat .env | grep -v "^#" | grep -v "^$"
# Verify all required variables are set
```

### "RingCentral SDK authentication failed"

**Problem:** Invalid or expired JWT token

**Solution:**
1. Get new JWT token from RingCentral Developer Portal
2. Update `RC_JWT_TOKEN` in `.env`
3. Restart server

**Verify credentials:**
```bash
# Check RC_CLIENT_ID and RC_CLIENT_SECRET match your app
# JWT tokens expire - get fresh one if older than 1 hour
```

### "Database connection failed"

```bash
cd server

# Reset database
rm prisma/dev.db
npx prisma migrate dev --name init
npm run prisma:seed

# Verify
npx prisma studio
```

## Database Issues

### "Migration failed"

```bash
cd server

# Reset database
npx prisma migrate reset

# Apply migrations
npx prisma migrate dev

# Seed hold lines
npm run prisma:seed
```

### "Prisma Client not found"

```bash
cd server
npx prisma generate
npm run build
```

### "No hold lines available"

```bash
# Verify hold lines seeded
cd server
npx prisma studio
# Check HoldLine table

# If empty, run seed
npm run prisma:seed
```

## RingCentral Issues

### "Failed to create webhook subscription"

**Problem 1:** Invalid webhook URL
```bash
# Verify WEBHOOK_BASE_URL is HTTPS
echo $WEBHOOK_BASE_URL
# Should be: https://xxxxx.ngrok.io (not http://)
```

**Problem 2:** ngrok not accessible
```bash
# Test endpoint
curl https://your-ngrok-url.ngrok.io/health
# Should return: {"status":"ok",...}

# If fails, restart ngrok
ngrok http 3000
```

**Problem 3:** Subscription already exists
```bash
# Check server logs for existing subscription ID
# Server will reuse active subscription
```

### "Call-out failed"

**Problem 1:** Invalid extension ID
```bash
# Verify extension IDs in .env match your RC account
# Login to RingCentral Admin Portal → Extensions
# Compare extension IDs

# Update HOLD_EXTENSION_IDS in .env
HOLD_EXTENSION_IDS=12345,12346,12347,...
```

**Problem 2:** Extension in use
```bash
# Ensure extensions aren't actively on calls
# Check RC admin portal for extension status
```

**Problem 3:** Extension lacks outbound calling permission
```bash
# In RC Admin Portal:
# Extensions → Select Extension → Calling → Outbound Calling
# Ensure "Enabled" is checked
```

### "Transfer failed"

**Problem 1:** Invalid queue number
```bash
# QUEUE_E164 must be Call Queue's DIRECT NUMBER, not extension
# Find in RC Admin Portal → Call Queue → Phone Number
# Update in .env:
QUEUE_E164=+18885551234
```

**Problem 2:** Queue doesn't accept transfers
```bash
# In RC Admin Portal:
# Call Queue → Settings → Advanced
# Check "Allow transfers to this queue" is enabled
```

**Problem 3:** Call not in correct state
```bash
# Review logs for call status before transfer attempt
# Transfer only works from ANSWERED state
```

## Webhook Issues

### "Webhooks not received"

**Check 1:** Verify ngrok running
```bash
curl https://your-ngrok-url.ngrok.io/health
```

**Check 2:** Test webhook endpoint
```bash
curl -X POST https://your-ngrok-url.ngrok.io/api/webhooks/ringcentral \
  -H "Validation-Token: test123"
# Should return header: Validation-Token: test123
```

**Check 3:** Verify subscription active
```bash
# Check server logs for:
# "✅ Webhook subscription created: <id>"
# or "✅ Active webhook subscription found: <id>"
```

**Check 4:** Check RingCentral subscription
```bash
# In RC Developer Portal:
# Your App → Webhooks → Active Subscriptions
# Verify subscription exists and is Active
```

### "Webhook validation failed"

```bash
# Server automatically handles Validation-Token
# If fails, check server logs for errors
# Ensure WebhookService.validateWebhookToken() is working
```

### "Webhook events delayed"

**Problem:** Network latency or RC server load

**Solutions:**
- Check server network connection
- Verify server has sufficient resources
- Review webhook processing time in logs
- Consider upgrading server resources

## Redis Issues

### "Redis connection refused"

```bash
# Start Redis
brew services start redis  # macOS
sudo systemctl start redis  # Linux
docker run -d -p 6379:6379 redis:7-alpine  # Docker

# Verify
redis-cli ping
```

### "Redis authentication failed"

```bash
# If using Redis with password
# Update REDIS_URL in .env:
REDIS_URL=redis://:password@localhost:6379

# Update server/src/config/redis.ts if needed
```

### "Bull queue not processing"

```bash
# Check queue
redis-cli KEYS "bull:dial-queue:*"

# Check active jobs
redis-cli LRANGE "bull:dial-queue:active" 0 -1

# Clear stuck jobs (DANGER - only in development)
redis-cli DEL bull:dial-queue:active
redis-cli DEL bull:dial-queue:wait
```

## Frontend Issues

### "Cannot connect to server"

**Check 1:** Server running
```bash
curl http://localhost:3000/health
```

**Check 2:** CORS configuration
```bash
# In server/src/server.ts, verify CLIENT_URL matches:
CLIENT_URL=http://localhost:5173
```

**Check 3:** Proxy configuration
```bash
# In client/vite.config.ts, verify proxy target:
target: 'http://localhost:3000'
```

### "Socket.io not connecting"

**Check 1:** Connection indicator
- Red dot = disconnected
- Green dot = connected

**Check 2:** Browser console
```javascript
// Check for errors
// Look for "Socket connected" or connection errors
```

**Check 3:** Socket.io server
```bash
# Verify Socket.io initialized in server/src/server.ts
# Check logs for "Client connected: <socket-id>"
```

### "Real-time updates not working"

**Check 1:** Socket.io events
```javascript
// In browser console
socket.on('leg:updated', console.log);
socket.on('job:transferred', console.log);
```

**Check 2:** TanStack Query cache
```javascript
// Clear cache
queryClient.invalidateQueries(['job']);
```

**Check 3:** Job subscription
```bash
# Server logs should show:
# "📡 Client <id> subscribed to job:<jobId>"
```

## Call Flow Issues

### "Calls not dialing"

**Check 1:** Hold lines available
```bash
cd server
npx prisma studio
# Check HoldLine table - should have 6 entries with isAvailable=true
```

**Check 2:** Bull queue
```bash
redis-cli LRANGE "bull:dial-queue:wait" 0 -1
# Should show queued jobs

# Check for errors
cd server
tail -f combined.log | grep "Queue"
```

**Check 3:** Extension IDs
```bash
# Verify HOLD_EXTENSION_IDS in .env
# Must match actual extension IDs in RC account
```

### "LIVE status not detected"

**Problem:** Webhook not processing HOLDING → ANSWERED transition

**Debug:**
```bash
# Monitor webhook events
cd server
tail -f combined.log | grep "LIVE"

# Should see:
# "🎯 LIVE DETECTED: Leg <id> (session <session>) - IRS agent answered!"
```

**Check WebhookService logic:**
```typescript
// In WebhookService.processSessionEvent()
if (previousStatus === 'HOLDING' && party.status.code === 'Answered') {
  newStatus = 'LIVE';
  // ...
}
```

### "Transfer not happening"

**Check 1:** Winner lock
```bash
# Check Redis lock
redis-cli GET "job:<jobId>:winner"
# Should return winning leg ID
```

**Check 2:** Transfer logs
```bash
cd server
tail -f combined.log | grep "transfer"

# Should see:
# "🏆 Leg <id> WON the race! Starting transfer..."
# "🔄 Transferring call..."
# "✅ Transfer completed successfully"
```

**Check 3:** RingCentral API response
```bash
# Review error logs for API errors
tail -f error.log
```

### "Losing legs not hanging up"

**Check cleanup logs:**
```bash
cd server
tail -f combined.log | grep "Cleaning up"

# Should see:
# "🧹 Cleaning up losing legs for job <id>..."
# "📴 Hanging up X losing legs"
# "✅ Cleanup completed for job <id>"
```

**Manual cleanup:**
```bash
# If legs stuck, manually stop job
curl -X POST http://localhost:3000/api/jobs/<jobId>/stop
```

## Performance Issues

### "High latency"

**Measure latency:**
```bash
# Monitor logs for timestamps
cd server
tail -f combined.log | grep -E "LIVE|transfer|WON"

# Calculate time between:
# 1. LIVE DETECTED
# 2. WON the race
# 3. Transfer completed
# Should be < 500ms total
```

**Optimize:**
- Ensure Redis on same network
- Upgrade server resources
- Check network latency to RingCentral

### "High CPU usage"

**Check Bull queue:**
```bash
# Monitor queue processing
redis-cli LLEN "bull:dial-queue:wait"
redis-cli LLEN "bull:dial-queue:active"

# If high, may need to adjust concurrency
```

**Check webhook volume:**
```bash
# Monitor webhook events
cd server
tail -f combined.log | grep "Webhook received"

# If excessive, RC may be sending too many events
```

### "Memory leak"

**Monitor memory:**
```bash
# If using PM2
pm2 monit

# Check for:
# - Increasing memory usage over time
# - Unclosed database connections
# - Socket.io connections not closing
```

**Solutions:**
- Restart server periodically
- Review code for unclosed connections
- Add memory limits to PM2 config

## Logging

### View all logs
```bash
cd server
tail -f combined.log
```

### View only errors
```bash
cd server
tail -f error.log
```

### View specific component
```bash
cd server
tail -f combined.log | grep "RingCentral"
tail -f combined.log | grep "Queue"
tail -f combined.log | grep "Transfer"
```

### Enable debug logging
```bash
# In server/.env
NODE_ENV=development

# Restart server
```

## Getting Help

### Collect diagnostic info

```bash
# System info
node --version
npm --version
redis-cli --version

# Server status
curl http://localhost:3000/health

# Database status
cd server
npx prisma studio

# Redis status
redis-cli INFO

# Environment
cd server
cat .env | grep -v "SECRET\|TOKEN" | grep -v "^#"

# Recent logs
cd server
tail -100 combined.log > debug.log
tail -100 error.log >> debug.log
```

### Common error messages

**"ECONNREFUSED"**
- Service not running
- Wrong port
- Firewall blocking

**"EADDRINUSE"**
- Port already in use
- Kill existing process or change port

**"UnhandledPromiseRejectionWarning"**
- Missing error handling
- Check async/await usage
- Review logs for original error

**"ERR_MODULE_NOT_FOUND"**
- Missing dependency
- Run `npm install`
- Check import paths

**"ETIMEDOUT"**
- Network issue
- Service unreachable
- Check firewall/network

## Still Stuck?

1. **Check documentation:**
   - README.md
   - QUICKSTART.md
   - PROJECT_SUMMARY.md

2. **Run verification script:**
   ```bash
   ./scripts/verify-setup.sh
   ```

3. **Review test results:**
   - TESTING.md

4. **Enable verbose logging:**
   ```bash
   # In server/src/config/logger.ts
   level: 'debug'
   ```

5. **Check GitHub issues:**
   - Search for similar problems
   - Create new issue with diagnostic info

6. **Contact support:**
   - Include diagnostic info
   - Include relevant logs
   - Describe steps to reproduce
