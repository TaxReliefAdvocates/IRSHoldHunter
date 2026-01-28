# Guide: Multiple Concurrent Calls with Call-Out API

## Current Architecture Overview

Your system is **already built for concurrent calls**. Here's how it works:

### How Jobs Work
1. **Job Creation**: You create a job with N lines to call
2. **Leg Assignment**: System creates N "legs" (individual call attempts)
3. **Extension Reservation**: Each leg reserves an available extension
4. **Parallel Execution**: All legs execute in parallel with staggered delays (0ms, 2s, 4s, etc.)

### Call Initiation (Current Logic)
Each leg attempts to call using this priority:
1. **Try deviceId first**: Look for an online SoftPhone/HardPhone device
2. **Fallback to phoneNumber**: Use the extension's DirectNumber

## Your Current Resources

### Available Extensions with DirectNumbers
You have **100+ extensions** with DirectNumbers that can make calls simultaneously.

**Examples:**
- Ext 101 (+17146131622)
- Ext 1003 (+19498921688)
- Ext 1004 (+19496201338)
- Ext 7418 (+17147825770, +13022956373) - Your extension
- ... and many more

### Device Status
- Only 1 SoftPhone currently: Extension 7418 (Status: Offline)
- **Recommendation**: Use DirectNumbers instead of devices for scale

## Scaling to Multiple Concurrent Calls

### Option 1: Use DirectNumbers (Recommended)
This is what the system currently does and works best for scale.

**Pros:**
- No need to manage device status
- Can use 100+ extensions simultaneously
- Each extension's DirectNumber acts as the "from" caller ID

**Cons:**
- Caller ID will vary by extension (different phone numbers)

**Configuration:**
```env
# In server/.env
HOLD_EXTENSION_IDS=62378666006,62449168006,62450601006,62503058006,62541822006,62547228006
```

Add more extension IDs to this list to enable more concurrent calls.

### Option 2: Multiple SoftPhone Devices
Set up multiple SoftPhone instances for different extensions.

**Pros:**
- More control over device status
- Can use deviceId approach (preferred by RingCentral)

**Cons:**
- Requires multiple devices to be online
- Limited by number of SoftPhone licenses
- Requires manual setup for each device

**How to set up:**
1. Install RingCentral Phone app on multiple devices/computers
2. Log in with different extensions on each device
3. Ensure devices show as "Online" in the API

### Option 3: Hybrid Approach
Use a mix of online devices and DirectNumbers.

The current code **already does this**:
- First tries to find an online device
- Falls back to DirectNumber if no device is online

## Checking Available Resources

### Check Extensions with DirectNumbers
```bash
TOKEN=$(redis-cli GET "config:rc_access_token") && \
curl -s -H "Authorization: Bearer $TOKEN" \
"https://platform.ringcentral.com/restapi/v1.0/account/~/phone-number?perPage=100" | \
jq '[.records[] | select(.usageType == "DirectNumber" and .extension.extensionNumber != null)] | 
    group_by(.extension.extensionNumber) | 
    map({extension: .[0].extension.extensionNumber, extensionId: .[0].extension.id, phoneNumbers: map(.phoneNumber)})'
```

### Check Online Devices
```bash
TOKEN=$(redis-cli GET "config:rc_access_token") && \
curl -s -H "Authorization: Bearer $TOKEN" \
"https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/device?perPage=100" | \
jq '[.records[] | select(.status == "Online") | {id, name, type, extension: .extension.extensionNumber}]'
```

### Check Specific Extension's Devices
```bash
TOKEN=$(redis-cli GET "config:rc_access_token") && \
curl -s -H "Authorization: Bearer $TOKEN" \
"https://platform.ringcentral.com/restapi/v1.0/account/~/extension/63663897007/device" | \
jq '.records[] | {id, name, type, status}'
```

## How Call Routing Works

### Current Flow
1. **Outbound Call**: Extension calls destination number
2. **Call Answered**: Destination answers the call
3. **Transfer**: Once IRS picks up (detected), extension transfers to your queue
4. **Queue Pickup**: Any team member can pick up from the queue

### Queue Configuration
The queue number is configured in:
```env
# In server/.env
QUEUE_E164=+18885551234  # Your queue's direct number
```

When a live person is detected on the IRS line, the system transfers the call to this queue number.

## Testing Multiple Concurrent Calls

### Test with 5 Lines
1. Go to http://localhost:5173
2. Create a job with **5 lines**
3. System will:
   - Reserve 5 available extensions
   - Create 5 legs with 0ms, 2s, 4s, 6s, 8s delays
   - Call your destination 5 times in parallel
   - Each call uses a different extension's DirectNumber

### Monitor Execution
Watch the server logs:
```bash
tail -f /path/to/server/logs
```

You'll see:
```
🎯 [Queue] Starting Call-Out from extension 62378666006...
🔍 Approach 1: Checking for online devices...
⚠️ No online devices found
🔍 Approach 2: Looking up direct phone number...
✅ Found direct number: +17146131622
✅ Call-Out initiated: sessionId=xyz, partyId=abc
```

## Scaling Recommendations

### For 10+ Concurrent Calls
1. Add more extension IDs to `HOLD_EXTENSION_IDS` in `.env`
2. Sync extensions: Click "Full Sync" in the UI
3. Test with increasing line counts: 5, 10, 20

### For 50+ Concurrent Calls
1. Consider rate limit implications (currently mitigated with delays)
2. Monitor Redis performance
3. Consider deploying to a production environment with better resources

### For 100+ Concurrent Calls
1. May need to upgrade RingCentral API tier
2. Consider batching jobs
3. Monitor system resources (CPU, memory, network)

## Troubleshooting

### "No online device or direct phone number" Error
**Cause**: Extension doesn't have:
- An online SoftPhone/HardPhone device, OR
- A DirectNumber assigned

**Fix**:
1. Check if extension has a DirectNumber:
   ```bash
   TOKEN=$(redis-cli GET "config:rc_access_token") && \
   curl -s -H "Authorization: Bearer $TOKEN" \
   "https://platform.ringcentral.com/restapi/v1.0/account/~/phone-number?perPage=100" | \
   jq '.records[] | select(.extension.extensionNumber == "XXXX")'
   ```
2. If no DirectNumber, assign one via RingCentral Admin Portal
3. Re-sync extensions in the UI

### Rate Limits
Current mitigation:
- 100ms delay between device API calls during sync
- 5-second cooldown on status sync endpoint
- Staggered call initiation (2s delay between legs)

## API Reference

### Call-Out API Documentation
https://developers.ringcentral.com/api-reference/Call-Control/createCallOutCallSession

### Device Management
https://developers.ringcentral.com/api-reference/Devices/listExtensionDevices

### Phone Numbers
https://developers.ringcentral.com/api-reference/Phone-Numbers/listAccountPhoneNumbers
