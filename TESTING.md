# Testing Guide

Comprehensive testing guide for IRS Hold Hunter.

## Prerequisites

Before testing, ensure:
- [ ] Server is running (`npm run dev` in server/)
- [ ] Client is running (`npm run dev` in client/)
- [ ] Redis is running (`redis-cli ping` returns PONG)
- [ ] ngrok is exposing port 3000
- [ ] WEBHOOK_BASE_URL is updated in .env
- [ ] RingCentral credentials are valid

## Manual Testing

### 1. Health Check

```bash
# Test server health
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-27T..."}
```

### 2. Webhook Validation

```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/api/webhooks/ringcentral \
  -H "Content-Type: application/json" \
  -H "Validation-Token: test-token-123"

# Expected: Response header should contain "Validation-Token: test-token-123"
```

### 3. Start Job via API

```bash
# Start a new job
curl -X POST http://localhost:3000/api/jobs/start \
  -H "Content-Type: application/json"

# Expected response:
# {"jobId":"clxxx...","message":"Job started successfully"}

# Save the jobId for next steps
export JOB_ID="<job-id-from-response>"
```

### 4. Get Job Status

```bash
# Get job details
curl http://localhost:3000/api/jobs/$JOB_ID

# Expected: JSON with job details and callLegs array
```

### 5. List Jobs

```bash
# List all jobs
curl http://localhost:3000/api/jobs

# Expected: Array of job objects
```

### 6. Stop Job

```bash
# Stop the job
curl -X POST http://localhost:3000/api/jobs/$JOB_ID/stop

# Expected: {"message":"Job stopped successfully"}
```

## Frontend Testing

### Test 1: Start Job

1. Open http://localhost:5173
2. Click "Start IRS Hunt"
3. Verify:
   - [ ] Button shows "Starting Hunt..."
   - [ ] Redirects to job view
   - [ ] Shows 6 call legs
   - [ ] Socket.io indicator is green (connected)

### Test 2: Real-time Updates

1. Watch call leg statuses
2. Verify transitions:
   - [ ] DIALING (initial state)
   - [ ] RINGING (call proceeding)
   - [ ] ANSWERED (call connected)
   - [ ] HOLDING (on hold)
   - [ ] LIVE (agent picked up) - CRITICAL
   - [ ] TRANSFERRED (winner only)
   - [ ] ENDED (losers)

### Test 3: Winner Detection

1. Watch for first LIVE status
2. Verify:
   - [ ] Leg row highlights in yellow
   - [ ] 🏆 trophy icon appears
   - [ ] "Winner" section shows at top
   - [ ] Live Detected timestamp appears
   - [ ] Job status changes to TRANSFERRED
   - [ ] Other legs change to ENDED

### Test 4: Stop Job

1. While job is RUNNING
2. Click "Stop Job"
3. Verify:
   - [ ] All legs change to ENDED
   - [ ] Job status changes to STOPPED
   - [ ] Button disappears

### Test 5: Start New Job

1. After job completes
2. Click "Start New Hunt"
3. Verify:
   - [ ] Returns to starter screen
   - [ ] Can start new job
   - [ ] Previous job data is preserved

## WebSocket Testing

### Test Socket Connection

Open browser console and run:

```javascript
// Check socket connection
window.socket = io('http://localhost:3000');

window.socket.on('connect', () => {
  console.log('✅ Connected');
});

window.socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

// Subscribe to job
window.socket.emit('subscribe:job', 'YOUR_JOB_ID');

// Listen for events
window.socket.on('leg:updated', (data) => {
  console.log('Leg updated:', data);
});

window.socket.on('job:transferred', (data) => {
  console.log('Job transferred:', data);
});
```

## Database Testing

### Test 1: Verify Hold Lines

```bash
cd server
npx prisma studio

# Navigate to HoldLine table
# Verify:
# - 6 hold lines exist
# - Each has unique extensionId
# - All are isAvailable: true
```

### Test 2: Verify Job Creation

```bash
# After starting a job, check Job table
# Verify:
# - Job status is RUNNING
# - irsNumber matches IRS_NUMBER
# - queueNumber matches QUEUE_E164
# - startedAt timestamp is recent
```

### Test 3: Verify Call Legs

```bash
# Check CallLeg table
# Verify:
# - 6 legs exist for job
# - Each has different holdExtensionId
# - telephonySessionId populated after dial
# - partyId populated after dial
# - Status updates occur
```

## Redis Testing

### Test 1: Verify Connection

```bash
redis-cli ping
# Expected: PONG
```

### Test 2: Check Winner Lock

```bash
# While job is running
redis-cli KEYS "job:*:winner"

# After winner determined
redis-cli GET "job:YOUR_JOB_ID:winner"
# Expected: Winning leg ID
```

### Test 3: Check Bull Queue

```bash
# Check queue jobs
redis-cli KEYS "bull:dial-queue:*"

# Check active jobs
redis-cli LRANGE "bull:dial-queue:active" 0 -1

# Check completed jobs
redis-cli LRANGE "bull:dial-queue:completed" 0 -1
```

## Load Testing

### Test Multiple Jobs

```bash
# Start 3 jobs simultaneously
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/jobs/start &
done

# Verify:
# - All jobs created successfully
# - Each job has 6 legs
# - No resource conflicts
# - Redis handles concurrent locks
```

## Error Testing

### Test 1: Invalid Extension

```bash
# Temporarily change HOLD_EXTENSION_IDS to invalid value
# Start job
# Verify:
# - Error logged
# - Leg status changes to FAILED
# - Other legs continue
```

### Test 2: Webhook Failure

```bash
# Stop server
# Send webhook event
curl -X POST https://your-ngrok-url.ngrok.io/api/webhooks/ringcentral \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'

# Verify:
# - ngrok shows 502 error
# - RingCentral will retry
```

### Test 3: Redis Failure

```bash
# Stop Redis
brew services stop redis

# Try to start job
# Verify:
# - Error logged
# - Job creation fails gracefully
```

### Test 4: Database Failure

```bash
# Corrupt database file
mv server/prisma/dev.db server/prisma/dev.db.bak

# Try to start job
# Verify:
# - Error logged
# - Descriptive error message
```

## Performance Testing

### Test Call Placement Latency

```bash
# Monitor logs during job start
# Measure time between:
# 1. Job created log
# 2. First "Dialing from extension" log
# 3. First "Call initiated" log

# Expected: <500ms total
```

### Test Transfer Latency

```bash
# Monitor logs for transfer
# Measure time between:
# 1. "LIVE DETECTED" log
# 2. "WON the race" log
# 3. "Transfer completed" log

# Expected: <500ms total
```

### Test Cleanup Latency

```bash
# Measure time between:
# 1. "Transfer completed" log
# 2. "Cleaning up losing legs" log
# 3. "Cleanup completed" log

# Expected: <2 seconds
```

## Integration Testing

### Full End-to-End Test

```bash
# 1. Start server and client
# 2. Open frontend
# 3. Start job
# 4. Wait for LIVE detection
# 5. Verify transfer
# 6. Check database
# 7. Verify logs

# Success criteria:
# ✅ All 6 legs dial
# ✅ Stagger is 2 seconds
# ✅ Webhooks received
# ✅ LIVE detected
# ✅ Winner transfers
# ✅ Losers hang up
# ✅ Database updated
# ✅ Frontend shows winner
# ✅ No errors in logs
```

## RingCentral API Testing

### Test 1: Authentication

```bash
# Check server logs for:
# "✅ RingCentral SDK authenticated successfully"

# If auth fails:
# - Verify RC_JWT_TOKEN is valid
# - Check RC_CLIENT_ID and RC_CLIENT_SECRET
# - Ensure JWT hasn't expired
```

### Test 2: Webhook Subscription

```bash
# Check logs for:
# "✅ Webhook subscription created: {id}"

# List subscriptions via API:
curl -X GET https://platform.ringcentral.com/restapi/v1.0/subscription \
  -H "Authorization: Bearer <token>"
```

### Test 3: Call-Out

```bash
# Monitor first call attempt
# Check for:
# - "📞 Initiating call from extension..."
# - "✅ Call initiated: sessionId=..., partyId=..."

# If fails:
# - Verify extension IDs are correct
# - Check extension isn't in use
# - Verify extension can make outbound calls
```

### Test 4: Transfer

```bash
# Monitor transfer attempt
# Check for:
# - "🔄 Transferring call..."
# - "✅ Transfer completed successfully"

# If fails:
# - Verify QUEUE_E164 is correct
# - Check queue exists and accepts transfers
# - Verify call is in correct state
```

## Monitoring Dashboard

Create a monitoring checklist:

### Server Health
- [ ] Server running
- [ ] No error logs
- [ ] CPU usage <50%
- [ ] Memory usage <500MB

### Database Health
- [ ] Prisma connected
- [ ] Queries executing
- [ ] No locked rows

### Redis Health
- [ ] Connected
- [ ] Memory usage <100MB
- [ ] No connection errors

### RingCentral Health
- [ ] Authenticated
- [ ] Webhook active
- [ ] API calls succeeding

### Frontend Health
- [ ] Socket.io connected
- [ ] UI responsive
- [ ] No console errors

## Test Results Template

```markdown
## Test Run: [DATE/TIME]

### Environment
- Server: ✅/❌
- Client: ✅/❌
- Redis: ✅/❌
- ngrok: ✅/❌

### API Tests
- Health check: ✅/❌
- Start job: ✅/❌
- Get job: ✅/❌
- Stop job: ✅/❌

### Frontend Tests
- Start button: ✅/❌
- Real-time updates: ✅/❌
- Winner detection: ✅/❌
- Socket.io: ✅/❌

### Call Flow Tests
- Staggered dialing: ✅/❌
- Webhook events: ✅/❌
- LIVE detection: ✅/❌
- Transfer: ✅/❌
- Cleanup: ✅/❌

### Performance
- Call placement: [XX]ms
- Transfer latency: [XX]ms
- Cleanup time: [XX]s

### Notes
[Any issues or observations]
```

## Continuous Testing

Add these tests to CI/CD:

1. **Unit Tests**: Test individual services
2. **Integration Tests**: Test service interactions
3. **API Tests**: Test all endpoints
4. **E2E Tests**: Simulate full job lifecycle
5. **Load Tests**: Test concurrent jobs

## Troubleshooting Failed Tests

### "Connection refused" error
- Check service is running
- Verify port is correct
- Check firewall settings

### "Webhook not received"
- Verify ngrok is running
- Check WEBHOOK_BASE_URL
- Test endpoint manually

### "Transfer failed"
- Check QUEUE_E164 is correct
- Verify queue configuration
- Review RC API response

### "Winner lock race condition"
- Check Redis is running
- Verify atomic SET NX works
- Review logs for timing

### "Frontend not updating"
- Check Socket.io connection
- Verify event handlers
- Check browser console

## Success Criteria

All tests passing indicates:
✅ System is production-ready
✅ Call flow works correctly
✅ Winner selection is atomic
✅ Transfer latency <500ms
✅ Real-time updates working
✅ Error handling robust
✅ No race conditions
✅ Logging comprehensive
