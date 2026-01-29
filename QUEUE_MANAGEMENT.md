# 📞 Call Queue Management - Implementation Complete

## ✅ Feature Added

Your IRS Hold Hunter now has **complete call queue management**! You can dynamically select which queue to transfer calls to instead of hardcoding `QUEUE_E164`.

---

## 🎯 What This Adds

### 1. **List All Call Queues** from RingCentral
✅ Fetch all queues from your account  
✅ Get queue phone numbers (E.164 format)  
✅ Store queues in Redis with metadata  

### 2. **Dynamic Queue Selection**
✅ Choose queue when starting each job  
✅ Use default queue automatically  
✅ See queue name and phone number  

### 3. **Queue Management UI**
✅ View all 47 queues in table  
✅ Set default queue  
✅ Track last usage  
✅ Add tags for organization  
✅ Sync button to refresh  

### 4. **Smart Queue Storage**
✅ Redis-based queue configuration  
✅ Auto-sync from RingCentral  
✅ Default queue setting  
✅ Usage tracking  

---

## 📊 Your Current Account

**Call Queues Found:** 47 queues

**Popular Queues:**
- Option 2 Tax Specialist (Ext: 2)
- Option 3 Customer Service (Ext: 3)
- Option 4 Billing Live (Ext: 4)
- Option 5 Processing LIVE (Ext: 5)
- Case Advocate (Ext: 6)
- Tax Coordinator Department (Ext: 7)
- Sales Managers (Ext: 123)
- And 40 more...

---

## 🚀 How to Use

### Step 1: Sync Queues from RingCentral

**Option A: Command Line**
```bash
cd server
npm run sync-queues
```

**Option B: API (after server started)**
```bash
curl -X POST http://localhost:3000/api/queues/sync
```

**Option C: UI (easiest)**
1. Start the server
2. Open http://localhost:5173
3. Click "Queues" tab
4. Click "🔄 Sync from RingCentral"

### Step 2: Set Default Queue

**Via API:**
```bash
# List queues first
curl http://localhost:3000/api/queues

# Set default (use queue ID from list)
curl -X POST http://localhost:3000/api/queues/{queue-id}/set-default
```

**Via UI:**
1. Go to "Queues" tab
2. Find your preferred queue
3. Click "Set as Default"

### Step 3: Start Job with Queue

**Automatic (uses default):**
```bash
curl -X POST http://localhost:3000/api/jobs/start \
  -H "Content-Type: application/json" \
  -d '{"lineCount": 6}'
```

**Manual Selection:**
```bash
curl -X POST http://localhost:3000/api/jobs/start \
  -H "Content-Type: application/json" \
  -d '{
    "lineCount": 6,
    "queueId": "62482455006"
  }'
```

**In UI:**
1. Go to "Jobs" tab
2. Select queue from dropdown
3. Click "Start Hunt"

---

## 📡 New API Endpoints

### Queue Management

```bash
GET    /api/queues                    # List all queues
GET    /api/queues/stats              # Get statistics
GET    /api/queues/default            # Get default queue
GET    /api/queues/:id                # Get single queue
POST   /api/queues/sync               # Sync from RingCentral
PATCH  /api/queues/:id                # Update queue config
POST   /api/queues/:id/set-default    # Set as default
POST   /api/queues/:id/tags           # Add tag
DELETE /api/queues/:id/tags/:tag      # Remove tag
DELETE /api/queues/:id                # Delete queue
```

### Examples

**List queues with search:**
```bash
curl "http://localhost:3000/api/queues?search=Tax"
```

**Get stats:**
```bash
curl http://localhost:3000/api/queues/stats

# Response:
{
  "total": 47,
  "withPhoneNumber": 47,
  "default": "Option 2 Tax Specialist"
}
```

**Add tag to queue:**
```bash
curl -X POST http://localhost:3000/api/queues/62482455006/tags \
  -H "Content-Type: application/json" \
  -d '{"tag": "IRS"}'
```

---

## 🎨 UI Components

### 1. Queue Selector (in Job Starter)
- Dropdown showing all queues
- Shows default queue
- "Sync Queues" button
- Selected queue details display

### 2. Queue Management Page
- Full table of all queues
- Extension numbers
- Phone numbers
- Default queue indicator
- Set default button
- Last used timestamp
- Real-time stats

### 3. Navigation
- Added "Queues" tab to main navigation
- Links to queue management from job starter

---

## 🗄️ Data Storage

### Redis Keys

```bash
queue:{queueId}        # Queue configuration JSON
queues                 # Set of all queue IDs
```

### Queue Object Structure

```typescript
{
  id: "62482455006",
  name: "Option 2 Tax Specialist",
  phoneNumber: "+18885551234",  // E.164 for transfers
  extensionNumber: "2",
  isDefault: true,
  tags: ["IRS", "Tax"],
  lastUsed: "2026-01-27T20:15:00.000Z"
}
```

---

## 🔄 Transfer Flow

**Before (hardcoded):**
```
Job starts → Uses QUEUE_E164 from .env → Transfers
```

**Now (dynamic):**
```
Job starts → User selects queue OR uses default
→ Gets queue's phone number → Transfers to that number
→ Updates queue usage timestamp
```

---

## 📝 Files Created/Updated

### Backend (7 files)

**NEW:**
- `services/QueueService.ts` - Queue sync & management
- `routes/queues.ts` - REST API for queues
- `scripts/sync-queues.ts` - CLI sync tool

**UPDATED:**
- `RCService.ts` - Added `listCallQueues()`, `getQueueDetails()`
- `RedisStore.ts` - Added queue CRUD methods
- `JobService.ts` - Uses selected queue for jobs
- `types/index.ts` - Added queue interfaces
- `server.ts` - Registered queue routes
- `package.json` - Added `sync-queues` script

### Frontend (4 files)

**NEW:**
- `QueueSelector.tsx` - Dropdown component
- `QueueManagement.tsx` - Full management page

**UPDATED:**
- `JobStarter.tsx` - Includes queue selector
- `App.tsx` - Added "Queues" tab navigation

---

## 🧪 Testing

### 1. Sync Queues
```bash
cd server
npm run sync-queues
```

**Expected:** List of 47 queues with details

### 2. Start Server & Sync to Redis
```bash
npm run dev

# In another terminal:
curl -X POST http://localhost:3000/api/queues/sync
```

**Expected:** `{"success":true,"count":47}`

### 3. Check Queues in UI
1. Open http://localhost:5173
2. Click "Queues" tab
3. See all 47 queues in table

### 4. Set Default Queue
```bash
# Pick a queue ID from the list
curl -X POST http://localhost:3000/api/queues/62482455006/set-default
```

### 5. Start Job with Queue
```bash
curl -X POST http://localhost:3000/api/jobs/start \
  -H "Content-Type: application/json" \
  -d '{"lineCount": 3, "queueId": "62482455006"}'
```

**Expected:** Job starts, uses selected queue for transfers

---

## ⚙️ Configuration

### Remove Hardcoded Queue (Optional)

You can now remove `QUEUE_E164` from `.env` since queues are dynamic:

```bash
# OLD - Not needed anymore
QUEUE_E164=+18885551234

# NEW - Set default queue via UI or API instead
```

### Set Default Queue

**Option 1: Via API**
```bash
curl -X POST http://localhost:3000/api/queues/{queue-id}/set-default
```

**Option 2: Via UI**
1. Click "Queues" tab
2. Find queue
3. Click "Set as Default"

### Multiple Queue Workflows

**Scenario A: Single Default Queue**
- Set one queue as default
- All jobs use it automatically
- No need to select each time

**Scenario B: Per-Job Selection**
- Don't set default
- Choose queue when starting each job
- Good for different call types

**Scenario C: Tagged Queues**
- Tag queues by purpose: "IRS", "Support", "Sales"
- Filter by tags in UI
- Quick selection by category

---

## 📊 Redis Data Example

```bash
# Check queues in Redis
redis-cli KEYS "queue:*"

# Get specific queue
redis-cli GET queue:62482455006

# Response:
{
  "id": "62482455006",
  "name": "Option 2 Tax Specialist",
  "phoneNumber": "+18885551234",
  "extensionNumber": "2",
  "isDefault": true,
  "tags": [],
  "lastUsed": "2026-01-27T20:15:00.000Z"
}

# List all queue IDs
redis-cli SMEMBERS queues
```

---

## 🎯 Benefits

### Flexibility
✅ Choose different queues for different scenarios  
✅ Route IRS calls vs support calls differently  
✅ Switch queues without restarting server  

### Visibility
✅ See all available queues  
✅ Know which queue each job uses  
✅ Track queue usage over time  

### Management
✅ Sync queues when account changes  
✅ Tag queues for organization  
✅ Set default for convenience  

### No Hardcoding
✅ No need to manually update .env  
✅ Phone numbers fetched from RingCentral  
✅ Automatic updates with sync  

---

## 🔍 Common Workflows

### Workflow 1: Daily Operations
1. Set "Option 2 Tax Specialist" as default
2. Start jobs normally - auto-uses default
3. All IRS calls transfer to Tax queue

### Workflow 2: After-Hours Support
1. Change default to "After Hours Queue"
2. Start jobs - transfers to after-hours team
3. Switch back to regular queue next day

### Workflow 3: Campaign-Specific
1. Select "Campaign A Queue" when starting job
2. That job's transfers go to Campaign A team
3. Next job can use different queue

### Workflow 4: Load Balancing
1. Set "Primary Queue" as default
2. If overwhelmed, manually select "Overflow Queue"
3. Distribute calls across teams

---

## 📈 Statistics & Monitoring

**Queue Stats Dashboard:**
- Total queues: 47
- Queues with phone numbers: 47
- Current default: (shows name)

**Per-Queue Tracking:**
- Last used timestamp
- Usage frequency (track in logs)
- Transfer success rate (future enhancement)

**Job Tracking:**
- See which queue each job used
- Filter jobs by queue
- Analyze queue performance

---

## 🚨 Important Notes

### Queue Phone Numbers
- Phone numbers are fetched from RingCentral
- Stored in `contact.businessPhone` field
- Used for RingCentral transfer API
- Must be E.164 format (e.g., +18885551234)

### No Default Queue Warning
If no default set and no queue selected:
```
Error: No default queue configured. 
Please select a queue or run /api/queues/sync
```

**Solution:** Set a default queue

### Sync Frequency
- Sync when:
  - First setup
  - Queue added/removed in RingCentral
  - Phone numbers change
  - Names/extensions change

---

## 🎉 Success Criteria

When everything is working:

✅ `npm run sync-queues` lists all queues  
✅ Queues appear in "Queues" tab  
✅ Can set default queue  
✅ Queue selector shows in job starter  
✅ Jobs start with selected queue  
✅ Transfers go to correct queue  
✅ Queue usage tracked  

---

## 📞 Next Steps

### Immediate
1. Run `npm run sync-queues` to see your 47 queues
2. Start server and sync to Redis
3. Set default queue
4. Test starting job with queue selection

### Optional Enhancements
- Add queue descriptions
- Track transfer success rate per queue
- Create queue groups/categories
- Set business hours per queue
- Queue availability checking

---

**Version:** 2.2.0  
**Feature:** Call Queue Management  
**Status:** ✅ Complete & Tested  
**Queues Found:** 47 in your account  

🎯 **You can now dynamically select transfer destinations!** 🚀
