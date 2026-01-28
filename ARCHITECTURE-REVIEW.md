# IRS Hold Hunter - Architecture Review

## Current Status

### ✅ What's Working
- OAuth authentication flow
- Extension syncing
- Job management and queueing
- Real-time status updates via Socket.IO
- Permission-based extension filtering

### ❌ What's Blocking
- **Extensions without direct phone numbers cannot make calls**
- Token refresh issues (being investigated)

---

## RingCentral API Options Analysis

### Option 1: Call-Out API with Device ID ❌ **NOT VIABLE**

**Endpoint:** `POST /telephony/call-out`

```json
{
  "from": { "deviceId": "12345" },
  "to": { "phoneNumber": "+15618189087" }
}
```

**Problems:**
- Requires a **physical device** to be online (desk phone, mobile app, softphone)
- Desktop/mobile/browser apps use **dynamic device IDs** that change
- Not suitable for **automated server-side** calling
- Requires scanning call logs to find current device IDs

**Verdict:** ❌ **Not suitable for IRS Hold Hunter**

---

### Option 2: Call-Out API with Phone Number ✅ **CURRENT APPROACH**

**Endpoint:** `POST /telephony/call-out`

```json
{
  "from": { "phoneNumber": "+19494868526" },
  "to": { "phoneNumber": "+18008291040" }
}
```

**Requirements:**
- Extension **MUST have a direct phone number** assigned
- Phone number must be in E.164 format
- Works from server-side (no browser/device needed)

**Pros:**
- ✅ Server-side automation
- ✅ No device management needed
- ✅ Reliable and documented
- ✅ Works with SuperAdmin JWT

**Cons:**
- ❌ Requires purchasing direct numbers for each extension (~$2-5/month each)
- ❌ Extensions without numbers cannot be used

**Verdict:** ✅ **Best option for IRS Hold Hunter**

---

### Option 3: RingOut API ❌ **NOT VIABLE**

**Endpoint:** `POST /extension/~/ring-out`

```json
{
  "from": { "phoneNumber": "+19494868526*7418" },
  "to": { "phoneNumber": "+18008291040" }
}
```

**How it works:**
1. System calls the "from" number
2. **User must manually answer**
3. System then calls the "to" number
4. Connects both parties when answered

**Problems:**
- Requires **manual answering** of first leg
- Not suitable for **automated** calling
- Designed for click-to-dial, not automation

**Verdict:** ❌ **Not suitable for IRS Hold Hunter**

---

### Option 4: WebRTC SDK ⚠️ **POSSIBLE BUT COMPLEX**

**Requires:**
- Browser-based implementation
- WebRTC permissions
- Continuous browser session
- WebRTC SDK integration

**Problems:**
- Major architecture change (browser-based vs server-based)
- Requires keeping browser tabs open
- More complex deployment
- Higher resource usage

**Verdict:** ⚠️ **Possible future enhancement, not recommended now**

---

## Recommended Architecture

### Core Approach
**Use Call-Out API with Direct Phone Numbers**

### Requirements for Extensions
Each extension used for calling **MUST have:**
1. ✅ A direct phone number assigned (DID)
2. ✅ Phone number in E.164 format (e.g., +19494868526)
3. ✅ Status: Enabled
4. ✅ Type: User or IVR

### User Permissions
- **Regular Users:** Can only call from their own extension (if it has a number)
- **SuperAdmin (JWT):** Can call from ANY extension that has a number

### Current Implementation Status

**Working:**
```typescript
// 1. Fetch extension details
const extResponse = await platform.get(`/restapi/v1.0/account/~/extension/${extensionId}`);
const extData = await extResponse.json();

// 2. Get direct phone number
const fromPhoneNumber = extData.contact?.businessPhone || 
                       extData.phoneNumbers?.find(p => p.usageType === 'DirectNumber')?.phoneNumber;

// 3. Make call
if (fromPhoneNumber) {
  await platform.post('/restapi/v1.0/account/~/telephony/call-out', {
    from: { phoneNumber: fromPhoneNumber },
    to: { phoneNumber: toPhoneNumber }
  });
} else {
  throw new Error('Extension does not have a direct phone number');
}
```

---

## Device ID vs Extension ID

### Extension ID
- **What:** Unique identifier for a RingCentral extension (user, queue, IVR, etc.)
- **Example:** `63663897007`
- **Format:** Numeric string
- **Usage:** Identifying extensions, checking status, getting extension details
- **API:** `/account/~/extension/{extensionId}`

### Device ID
- **What:** Unique identifier for a physical/virtual device (desk phone, mobile app, softphone)
- **Example:** `121824455007`
- **Format:** Numeric string
- **Usage:** Making calls from specific devices (Call-Out API)
- **Problem:** Dynamic for softphones, changes frequently

### Phone Number
- **What:** Actual telephone number in E.164 format
- **Example:** `+19494868526`
- **Usage:** Making/receiving calls, caller ID
- **Note:** NOT all extensions have phone numbers!

---

## Render Deployment

### ✅ Blueprint is Ready

The `render.yaml` file will deploy:
1. **Redis** - For session storage and job queues
2. **Web Service** - Node.js backend + React frontend

### Required Environment Variables

**Before deploying to Render, you need:**

```bash
# RingCentral Credentials
RC_CLIENT_ID=<from developer portal>
RC_CLIENT_SECRET=<from developer portal>
RC_JWT_TOKEN=<SuperAdmin JWT for full access>

# Your Render URL (after first deploy)
WEBHOOK_BASE_URL=https://your-app-name.onrender.com
```

### OAuth Redirect Setup

After deploying, add this to RingCentral Developer Portal:
```
https://your-app-name.onrender.com/oauth/callback
```

---

## Current Issues to Fix

### 1. ❌ Token Refresh Not Working
**Problem:** Refresh tokens not persisting in Redis  
**Status:** Added debug logging to investigate  
**Next Step:** Re-login and check logs

### 2. ❌ Extensions Without Phone Numbers
**Problem:** Many extensions don't have direct numbers assigned  
**Solution:**
- Option A: Assign numbers via Admin Portal
- Option B: Use the 29 unassigned numbers you're already paying for
- Option C: Purchase new DIDs (~$2-5/month each)

### 3. ❌ Sync Failing
**Problem:** Related to token refresh issue  
**Fix:** Will be resolved when token refresh is fixed

---

## Are We Doing This Right? ✅ YES

### Our Approach is Correct Because:

1. ✅ **Call-Out API with Phone Numbers** is the documented approach for server-side automation
2. ✅ **SuperAdmin JWT** allows calling from any extension (critical for multi-line hunting)
3. ✅ **Permission-based filtering** ensures regular users can only use their own extension
4. ✅ **Direct phone number requirement** is by design - not a limitation

### What's NOT Wrong:

- ❌ We're not "missing" a feature
- ❌ We're not using the wrong API
- ❌ The architecture is sound

### What IS the Constraint:

- ✅ **RingCentral requires extensions to have phone numbers to make calls**
- ✅ This is a business decision (costs money per number)
- ✅ Extensions without numbers can still receive transferred calls

---

## Deployment Readiness

### Ready to Deploy ✅
- Render blueprint configured
- Frontend builds correctly
- Backend serves static files in production
- Environment variables documented

### Before Deploying - Fix:
1. ❌ Token refresh mechanism
2. ⚠️ Assign phone numbers to extensions you want to use

### After Deploying - Test:
1. Login with SuperAdmin account
2. Sync extensions
3. Select extensions **with phone numbers**
4. Start a test job
5. Verify calls are initiated

---

## Cost Analysis

### Phone Number Costs
- **Toll-Free (800/888):** ~$3-5/month per number
- **Local (949/310):** ~$1-2/month per number
- **You currently have:** 29 unassigned numbers costing ~$80-130/month

### Recommendation
**Use your existing unassigned numbers!** You're already paying for them.

---

## Next Steps

### Immediate (Before Deploy):
1. ✅ Re-login to fix token refresh
2. ✅ Assign phone numbers to test extensions
3. ✅ Test sync functionality

### Deploy to Render:
1. Push code to GitHub
2. Create Render Blueprint
3. Set environment variables
4. Update OAuth redirect URI
5. Test with SuperAdmin

### Post-Deploy:
1. Monitor logs
2. Test calling functionality
3. Verify token refresh works in production
4. Document which extensions have numbers

---

## Summary

**Q: Are we doing this right?**  
**A: YES** ✅ - Our implementation follows RingCentral's documented best practices for server-side automation.

**Q: Why can't my extension make calls?**  
**A:** Your extension (7418) doesn't have a direct phone number assigned. This is required by RingCentral's API.

**Q: Can I deploy to Render?**  
**A: YES** ✅ - Blueprint is ready, just need to fix token refresh first.

**Q: What's the difference between device ID and extension ID?**  
**A:** Device ID = physical device, Extension ID = user/queue identifier, Phone Number = actual callable number

**Key Takeaway:** The IRS Hold Hunter is architecturally sound. The blocking issue is simply that extensions need direct phone numbers assigned to make outbound calls - this is a RingCentral requirement, not a flaw in our design.
