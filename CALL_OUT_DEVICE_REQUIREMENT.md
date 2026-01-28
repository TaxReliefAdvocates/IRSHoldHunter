# Call-Out API Device Requirement - Critical Issue

## 🚨 The Problem

**The RingCentral Call-Out API REQUIRES an online `deviceId` in the "from" field.**

You **CANNOT** use:
- ❌ `phoneNumber` in the "from" field
- ❌ `extensionNumber` in the "from" field
- ❌ Any approach without an online device

### API Test Results:
```bash
# ❌ FAILS: Using phoneNumber
{"from": {"phoneNumber": "+17147825770"}, "to": {"phoneNumber": "+15618189087"}}
# Error: CMN-101 - Parameter [phoneNumber] value is invalid

# ❌ FAILS: Using extensionNumber  
{"from": {"extensionNumber": "7418"}, "to": {"phoneNumber": "+15618189087"}}
# Error: CMN-101 - Parameter [extensionNumber] value is invalid

# ✅ WORKS: Using deviceId (only if device is ONLINE)
{"from": {"deviceId": "802858128007"}, "to": {"phoneNumber": "+15618189087"}}
# Success: Call initiated
```

---

## 💡 Solutions

### Option 1: Keep RingCentral Phone App Running (Recommended for Small Scale)

**For Extension 7418 (Your Extension):**

1. Open RingCentral Phone app on your computer
2. Log in with extension 7418
3. Ensure status shows "Available" (not "Offline")
4. Keep the app running

**Check device status:**
```bash
TOKEN=$(redis-cli GET "config:rc_access_token") && \
curl -s -H "Authorization: Bearer $TOKEN" \
"https://platform.ringcentral.com/restapi/v1.0/account/~/extension/63663897007/device" | \
jq '.records[] | {id, name, type, status}'
```

Expected output when online:
```json
{
  "id": "802858128007",
  "name": "RingCentral Phone app",
  "type": "SoftPhone",
  "status": "Online"  ← Must be "Online"
}
```

---

### Option 2: Multiple Devices for Concurrent Calls (Recommended for Scale)

**For 10+ concurrent calls**, you need 10+ online devices.

#### Setup:
1. **Physical Machines**: Install RC Phone on multiple computers
   - Each machine logs in with a different extension
   - Keep all machines running 24/7

2. **Virtual Machines**: Use VMs to run multiple RC Phone instances
   - AWS/Azure/DigitalOcean instances
   - Each VM runs RC Phone logged in as different extension

3. **Docker** (if RC provides headless client):
   - Container per extension
   - Managed orchestration

#### Configuration:
Add extension IDs to `.env`:
```env
HOLD_EXTENSION_IDS=ext1,ext2,ext3,ext4,ext5,ext6,ext7,ext8,ext9,ext10
```

---

### Option 3: Web Phone SDK / WebRTC (Advanced)

Use RingCentral's Web Phone SDK to programmatically create devices.

**Pros:**
- No physical devices needed
- Fully programmatic control
- Can scale to 100+ concurrent calls

**Cons:**
- Requires significant development work
- WebRTC complexity
- Audio handling for hold detection

**Resources:**
- https://developers.ringcentral.com/guide/voice/webrtc
- https://github.com/ringcentral/ringcentral-web-phone

---

### Option 4: RingOut API (NOT Recommended for Automation)

RingOut API works differently:
1. Calls the "from" extension first (someone must answer)
2. Then calls the "to" number
3. Connects both parties when both answer

**Why it doesn't work for your use case:**
- ❌ Requires manual answering on extension side
- ❌ Cannot detect hold automatically (needs human on the line)
- ❌ Not suitable for automated IRS hold hunting

---

## 🎯 Recommended Next Steps

### For Immediate Testing (1 call at a time):
1. **Open RingCentral Phone app on your Mac**
2. Log in as extension 7418
3. Ensure status is "Available"
4. Try a test call from the web UI

### For Production (Multiple concurrent calls):
1. **Determine scale**: How many concurrent calls do you need?
   - 5 calls? 5 devices needed
   - 20 calls? 20 devices needed
   - 100 calls? Web Phone SDK approach

2. **Choose infrastructure**:
   - **1-10 calls**: Physical machines or VMs
   - **10-50 calls**: VMs with orchestration
   - **50+ calls**: Web Phone SDK (custom development)

3. **Implementation**:
   - Set up devices/VMs
   - Install & log in RC Phone on each
   - Configure `.env` with extension IDs
   - Sync extensions in UI
   - Test with increasing line counts

---

## 📊 Current Status

### Your Account:
- **Total extensions with DirectNumbers**: 100+
- **Currently configured**: 6 extensions
- **Online devices**: 0 (❌ This is the blocker!)

### Test Results:
- ✅ API authentication working
- ✅ Extension sync working
- ✅ DirectNumbers found
- ❌ **Call-Out API failing: No online devices**

---

## 🔧 Quick Test Command

**After opening RC Phone app, check device status:**

```bash
cd /Users/lindseystevens/IRSAgent/server
npx tsx -e "
import rcService from './src/services/RCService.js';

async function check() {
  const platform = rcService.getPlatform();
  const response = await platform.get('/restapi/v1.0/account/~/extension/63663897007/device');
  const data = await response.json();
  
  console.log('\\nDevices for Extension 7418:');
  data.records.forEach(d => {
    console.log(\`  \${d.name} (\${d.type}): \${d.status}\`);
    if (d.status === 'Online') {
      console.log(\`  ✅ Device ID: \${d.id} - READY FOR CALLS!\`);
    } else {
      console.log(\`  ❌ Device is \${d.status} - Cannot make calls\`);
    }
  });
}

check().catch(console.error);
"
```

---

## 📚 API Documentation

- **Call-Out API**: https://developers.ringcentral.com/api-reference/Call-Control/createCallOutCallSession
- **Device Management**: https://developers.ringcentral.com/api-reference/Devices/listExtensionDevices
- **Web Phone SDK**: https://developers.ringcentral.com/guide/voice/webrtc
