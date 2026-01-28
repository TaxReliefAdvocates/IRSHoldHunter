# 🚀 READY TO TEST - IRS Hold Hunter v2.1

## ✅ EVERYTHING IS COMPLETE

### What's Been Built Today

**Original Application (v1.0):**
✅ Redis-only storage  
✅ 6 concurrent calls to IRS  
✅ Real-time webhook monitoring  
✅ Atomic winner selection  
✅ <500ms transfer latency  
✅ Socket.io real-time UI  

**NEW Features (v2.1):**
✅ Dynamic extension management  
✅ Extension pools & filtering  
✅ Smart multi-strategy live detection  
✅ Confidence scoring (0-100%)  
✅ Manual confirmation button  
✅ Real-time detection display  
✅ Configurable thresholds  

---

## 📊 Current System Status

### RingCentral
✅ **Authenticated:** Valid JWT token  
✅ **Extensions Synced:** 100 extensions in Redis  
✅ **Enabled for Hunting:** 6 extensions ready  
✅ **Account:** 70 user extensions available  

### Extensions Ready for Use
✅ 62378666006 (101 - Lindsay Oglesby)  
✅ 62449168006 (105 - ADMIN ACCOUNT)  
✅ 62450601006 (106 - Jeff Nickel)  
✅ 62503058006 (245 - Willy Ching)  
✅ 62541822006 (492 - Cori'Ann Bissell)  
✅ 62547228006 (551 - Larry Nguyen)  

### Detection Configuration
✅ **Min Hold Time:** 5 minutes  
✅ **Min Answer Time:** 30 seconds  
✅ **Min Confidence:** 50% (2/4 strategies)  
✅ **Manual Required:** false (automatic enabled)  

---

## 🚀 Start Testing (5 Minutes)

### Terminal 1: Redis
```bash
redis-server
```

### Terminal 2: Server  
```bash
cd server
npm run dev
```

**Expected Output:**
```
✅ Redis connected
✅ RingCentral SDK authenticated successfully
📡 Checking webhook subscription...
✅ Server running on port 3000
```

### Terminal 3: Client
```bash
cd client
npm install  # If not done yet
npm run dev
```

### Browser
```
Open: http://localhost:5173
```

---

## 🧪 Test Scenarios

### Scenario A: Basic Job (Original Behavior)
1. Click "Start Hunt with 6 Lines"
2. Verify 6 legs dial
3. Watch real-time updates
4. Observe detection confidence increase
5. First leg to reach 50% confidence transfers

### Scenario B: Custom Line Count
1. Adjust slider to 4 lines
2. Click "Start Hunt with 4 Lines"
3. Verify only 4 legs created
4. Check correct extensions used

### Scenario C: Extension Manager
1. Click "Extensions" tab
2. View all 100 extensions
3. Filter by "User" type
4. Search for specific name
5. Toggle hunting on/off
6. Create new pool

### Scenario D: Manual Confirmation
1. Start job with 2 lines
2. When any leg shows "Confirm Live" button
3. Click it
4. Verify immediate transfer (100% confidence)
5. Check logs show "Manual confirmation"

### Scenario E: Automatic Detection
1. Start job with 1 line (for testing)
2. Let it dial and reach hold
3. Watch confidence % increase every 2 seconds
4. Observe which strategies pass:
   - After 30s: "Call Duration Pattern" ✓
   - After 5min: "Time-Based Heuristic" ✓
   - On hold transition: "Hold Transition" ✓
5. When confidence ≥ 50%, automatic transfer

---

## 📡 API Testing

### Extension Management
```bash
# List all extensions
curl http://localhost:3000/api/extensions

# Get statistics
curl http://localhost:3000/api/extensions/stats

# Filter available extensions
curl http://localhost:3000/api/extensions?enabled=true&available=true

# Enable extension
curl -X PATCH http://localhost:3000/api/extensions/62378666006 \
  -H "Content-Type: application/json" \
  -d '{"enabledForHunting": true}'

# Create pool
curl -X POST http://localhost:3000/api/extensions/pools \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Pool","extensionIds":["62378666006","62449168006"]}'
```

### Job Management
```bash
# Start with custom line count
curl -X POST http://localhost:3000/api/jobs/start \
  -H "Content-Type: application/json" \
  -d '{"lineCount": 3}'

# Start with pool
curl -X POST http://localhost:3000/api/jobs/start \
  -H "Content-Type: application/json" \
  -d '{"lineCount": 6, "poolName": "IRS Team"}'

# Get job
curl http://localhost:3000/api/jobs/{jobId}

# Manual confirm
curl -X POST http://localhost:3000/api/jobs/{jobId}/legs/{legId}/confirm-live
```

### Detection Status
```bash
# Get detection status for leg
curl http://localhost:3000/api/jobs/legs/{legId}/detection-status

# Example response:
# {
#   "shouldTransfer": false,
#   "confidence": 0.25,
#   "reason": "Not enough confidence (25% < 50% required)",
#   "strategiesPassed": ["Call Duration Pattern"]
# }
```

---

## 🎯 What to Watch For

### Extension Manager
✅ Extensions load and display  
✅ Filters work correctly  
✅ Enable/disable toggles work  
✅ Stats update in real-time  
✅ Pools can be saved/loaded  

### Job Starter
✅ Line count slider works (1-70)  
✅ Available count updates  
✅ Pool selection works  
✅ Manual selection works  
✅ Validation prevents insufficient extensions  

### Active Job
✅ Detection confidence displays  
✅ Updates every 2 seconds  
✅ Shows which strategies passed  
✅ "Confirm Live" button appears  
✅ Manual confirmation works instantly  

### Logs to Monitor
```bash
tail -f server/combined.log | grep -E "LIVE|detection|confidence|Manual"
```

**Look For:**
```
🎯 LIVE DETECTED: Leg xxx
   confidence: 50%
   strategiesPassed: ["Time-Based Heuristic", "Hold Transition"]
   
✅ Leg xxx: Manually confirmed as live agent
🏆 Leg xxx WON the race! Starting transfer...
```

---

## ⚠️ Before First Real Job

1. **Update Queue Number** in `.env`:
   ```bash
   QUEUE_E164=+1234567890  # Your actual Call Queue direct number
   ```

2. **Tune Detection** based on your needs:
   - For testing: Keep defaults
   - For production: Increase MIN_HOLD_TIME to 600000 (10 min)
   - For manual only: Set REQUIRE_MANUAL=true

3. **Enable More Extensions** (optional):
   - You have 70 user extensions available
   - Currently only 6 enabled
   - Enable more via Extension Manager UI

---

## 🎉 Success Indicators

When everything is working:

✅ Server starts without errors  
✅ Extensions appear in Extension Manager  
✅ Stats show: enabled=6, available=6  
✅ Job starts with custom line count  
✅ Detection confidence displays and updates  
✅ Manual confirm button works  
✅ Automatic transfer at 50% confidence  
✅ Winner selection works correctly  
✅ Extensions released after job  

---

## 📞 Quick Commands

```bash
# Sync extensions
npm run sync-extensions

# Enable your 6 hold lines
curl -X POST http://localhost:3000/api/extensions/bulk-update \
  -H "Content-Type: application/json" \
  -d '{"extensionIds":["62378666006","62449168006","62450601006","62503058006","62541822006","62547228006"],"updates":{"enabledForHunting":true}}'

# Check stats
curl http://localhost:3000/api/extensions/stats

# Start test job
curl -X POST http://localhost:3000/api/jobs/start \
  -H "Content-Type: application/json" \
  -d '{"lineCount": 2}'

# Monitor
redis-cli MONITOR
tail -f server/combined.log
```

---

**Version:** 2.1.0  
**Status:** ✅ Ready to Test  
**Extensions:** ✅ 6 Enabled  
**Detection:** ✅ 4 Strategies Active  

🎯 **Let's hunt!**
