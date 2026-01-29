# 🎉 Feature Update: Dynamic Extensions + Smart Live Detection

## ✨ New Features Added

### 1. Dynamic Extension Management

**Extension Manager UI** (`/extensions` route)
- View all RingCentral extensions in a table
- Filter by search, type, status, enabled/available
- Toggle individual extensions on/off for hunting
- Bulk enable/disable multiple extensions
- Create and save extension pools
- Real-time statistics dashboard
- Sync extensions from RingCentral

**Extension Pools**
- Save groups of extensions as named pools
- Quickly select a pool when starting a job
- Useful for different scenarios (day shift, night shift, IRS team, etc.)

**Job Starter Enhancements**
- Choose number of lines (1-70)
- Select from saved extension pools
- OR manually select specific extensions
- Shows available extension count
- Validates sufficient extensions before starting

### 2. Smart Live Agent Detection

**Multiple Detection Strategies:**

1. **Time-Based Heuristic** (Most Reliable)
   - Requires 5+ minutes on hold before LIVE detection
   - Prevents false positives from IVR systems
   - Configurable via `LIVE_DETECTION_MIN_HOLD_TIME`

2. **Hold Transition Detection**
   - Detects HOLDING → ANSWERED transitions
   - Original detection method, now one of many

3. **Call Duration Pattern**
   - Requires 30+ seconds in ANSWERED state
   - IVRs typically answer immediately
   - Configurable via `LIVE_DETECTION_MIN_ANSWER_TIME`

4. **Multiple Hold Cycles**
   - Detects 2+ hold/answer cycles
   - Often indicates agent transfer process

**Confidence Scoring**
- Each strategy votes yes/no
- Confidence = strategies passed / total strategies
- Configurable threshold (default: 50%)
- Requires minimum confidence before transferring

**Manual Confirmation**
- "Confirm Live" button on each call leg
- Operator can manually trigger transfer
- 100% confidence = instant transfer
- Can set `LIVE_DETECTION_REQUIRE_MANUAL=true` to force manual only

**Real-Time Detection Status**
- Shows confidence percentage on each leg
- Lists which strategies passed
- Updates every 2 seconds while call is active
- Helps operators make informed decisions

---

## 🔧 Configuration Options

### New Environment Variables

```bash
# Live Detection Settings
LIVE_DETECTION_MIN_HOLD_TIME=300000        # 5 minutes in ms
LIVE_DETECTION_MIN_ANSWER_TIME=30000       # 30 seconds in ms
LIVE_DETECTION_MIN_CONFIDENCE=0.5          # Require 50% of strategies (2/4)
LIVE_DETECTION_REQUIRE_MANUAL=false        # Set true for manual only
```

### Tuning Recommendations

**For More Automatic Detection:**
```bash
LIVE_DETECTION_MIN_HOLD_TIME=180000        # 3 minutes
LIVE_DETECTION_MIN_CONFIDENCE=0.25         # Require 1/4 strategies
LIVE_DETECTION_REQUIRE_MANUAL=false
```

**For Maximum Safety (Manual Only):**
```bash
LIVE_DETECTION_REQUIRE_MANUAL=true
```

**For Balanced Approach (Recommended):**
```bash
LIVE_DETECTION_MIN_HOLD_TIME=300000        # 5 minutes
LIVE_DETECTION_MIN_CONFIDENCE=0.5          # Require 2/4 strategies
LIVE_DETECTION_REQUIRE_MANUAL=false
```

---

## 📊 New API Endpoints

### Extension Management

```bash
GET    /api/extensions                    # List all extensions (with filters)
GET    /api/extensions/stats              # Get statistics
GET    /api/extensions/:id                # Get single extension
PATCH  /api/extensions/:id                # Update extension settings
POST   /api/extensions/bulk-update        # Bulk update extensions
POST   /api/extensions/:id/tags           # Add tag
DELETE /api/extensions/:id/tags/:tag      # Remove tag
POST   /api/extensions/sync               # Sync from RingCentral

GET    /api/extensions/pools              # List pools
GET    /api/extensions/pools/:name        # Get pool extensions
POST   /api/extensions/pools              # Save pool
DELETE /api/extensions/pools/:name        # Delete pool
```

### Live Detection

```bash
POST   /api/jobs/:jobId/legs/:legId/confirm-live   # Manual confirmation
GET    /api/jobs/legs/:legId/detection-status      # Get detection status
```

### Updated Job Start

```bash
POST   /api/jobs/start
Body: {
  irsNumber?: string,
  queueNumber?: string,
  lineCount?: number,                    # NEW: Number of lines (default: 6)
  poolName?: string,                     # NEW: Use saved pool
  specificExtensionIds?: string[]        # NEW: Manual selection
}
```

---

## 🚀 How to Use

### 1. Setup Extensions (First Time)

```bash
# 1. Sync extensions from RingCentral
POST /api/extensions/sync

# 2. Enable extensions for hunting (via UI or API)
PATCH /api/extensions/:id
Body: { enabledForHunting: true }

# 3. Create extension pools (optional)
POST /api/extensions/pools
Body: { 
  name: "IRS Team",
  extensionIds: ["63663897001", "63663897002", ...]
}
```

### 2. Start a Job with Dynamic Selection

**Option A: Auto-select available extensions**
```bash
POST /api/jobs/start
Body: { lineCount: 10 }
```

**Option B: Use saved pool**
```bash
POST /api/jobs/start
Body: { lineCount: 6, poolName: "IRS Team" }
```

**Option C: Manual selection**
```bash
POST /api/jobs/start
Body: { 
  lineCount: 6,
  specificExtensionIds: ["id1", "id2", "id3", "id4", "id5", "id6"]
}
```

### 3. Monitor & Manually Confirm

1. Watch detection confidence on each leg
2. When a leg shows "Confirm Live" button, click it if you hear a human
3. System transfers immediately on manual confirmation

---

## 📈 Benefits

### Extension Management
✅ **Flexibility** - Use any number of lines (1-70)
✅ **Reusability** - Save pools for different scenarios
✅ **Visibility** - See which extensions are in use
✅ **Control** - Enable/disable extensions individually
✅ **Organization** - Tag and filter extensions

### Smart Live Detection
✅ **Accuracy** - Multiple strategies reduce false positives
✅ **Transparency** - See exactly why system made a decision
✅ **Safety** - Manual override for 100% accuracy
✅ **Configurability** - Tune thresholds for your needs
✅ **Reliability** - Time-based heuristic works well with IRS

---

## 🧪 Testing Scenarios

### Test 1: Auto-Selection
1. Enable 10 extensions for hunting
2. Start job with `lineCount: 6`
3. Verify system auto-selects 6 available extensions
4. Check extensions marked as "In Use"

### Test 2: Extension Pool
1. Create pool "Day Shift" with 6 extensions
2. Start job with `poolName: "Day Shift"`
3. Verify correct extensions used

### Test 3: Manual Selection
1. Manually select 4 specific extensions
2. Start job
3. Verify exactly those 4 used

### Test 4: Live Detection
1. Start job with multiple lines
2. Let one call stay on hold 5+ minutes
3. Verify confidence increases over time
4. Check which strategies pass
5. Verify automatic transfer when threshold met

### Test 5: Manual Confirmation
1. Start job
2. When any leg answers, click "Confirm Live"
3. Verify immediate transfer
4. Check logs show "Manual confirmation"

---

## 📝 Migration Notes

### Backward Compatibility
✅ Existing code still works with default 6 extensions
✅ Old job start format still supported (auto-selects available)
✅ Original hold transition detection still active

### Breaking Changes
❌ None - all changes are additive

### Recommended Updates
1. Run `/api/extensions/sync` after deploying
2. Enable desired extensions for hunting
3. Create extension pools for common scenarios
4. Update job start calls to use new features
5. Train operators on manual confirmation button

---

## 🔍 Troubleshooting

### Extensions not appearing
**Solution:** Run `POST /api/extensions/sync`

### "Not enough extensions available"
**Causes:**
- Extensions not enabled for hunting
- Extensions already in use by another job
- Extensions don't exist in RingCentral

**Solution:** 
1. Check `/api/extensions/stats`
2. Enable more extensions via Extension Manager UI
3. Wait for active jobs to complete

### Detection confidence too low
**Tuning:**
- Decrease `LIVE_DETECTION_MIN_CONFIDENCE`
- Decrease `LIVE_DETECTION_MIN_HOLD_TIME`
- Use manual confirmation instead

### False positives (IVR detected as live)
**Tuning:**
- Increase `LIVE_DETECTION_MIN_HOLD_TIME` to 10+ minutes
- Increase `LIVE_DETECTION_MIN_CONFIDENCE` to 0.75
- Set `LIVE_DETECTION_REQUIRE_MANUAL=true`

---

## 📊 Monitoring

### Key Metrics to Watch

**Extension Usage:**
```bash
GET /api/extensions/stats
→ Monitor available vs in-use ratio
```

**Detection Performance:**
- Track confidence levels when transfers occur
- Monitor false positive/negative rates
- Adjust thresholds based on data

**Job Success:**
- Measure time from start to successful transfer
- Track which extensions perform best
- Identify problematic extensions

---

## 🎯 Best Practices

1. **Start Small:** Begin with 6 lines, increase gradually
2. **Create Pools:** Save time by pre-defining common groups
3. **Monitor Confidence:** Watch detection scores to tune thresholds
4. **Use Manual Override:** When in doubt, click "Confirm Live"
5. **Tag Extensions:** Organize by team, shift, purpose
6. **Sync Regularly:** Keep extension list up-to-date
7. **Test Settings:** Try different confidence thresholds

---

**Version:** 2.1.0  
**Released:** January 27, 2025  
**Backward Compatible:** ✅ Yes
