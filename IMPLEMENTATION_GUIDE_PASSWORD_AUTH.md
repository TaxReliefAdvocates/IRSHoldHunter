# Password Flow Authentication - Implementation Guide

## Difficulty: EASY (30 minutes)

### What Changes:

**Current (JWT):**
```typescript
await sdk.login({ jwt: process.env.RC_JWT_TOKEN });
```

**New (Password Flow):**
```typescript
await sdk.login({
  username: process.env.RC_USERNAME,
  extension: process.env.RC_EXTENSION,  // Optional
  password: process.env.RC_PASSWORD
});
```

---

## Step-by-Step Implementation:

### 1. Update `.env` (2 minutes)

**Remove:**
```bash
RC_JWT_TOKEN=eyJ...
```

**Add:**
```bash
# Password Flow Authentication
RC_USERNAME=superadmin@yourcompany.com
RC_EXTENSION=101  # Optional - SuperAdmin extension number
RC_PASSWORD=YourSuperAdminPassword
```

### 2. Update `server/src/config/ringcentral.ts` (5 minutes)

**Find the login section and replace:**

```typescript
// OLD (JWT):
await platform.login({
  jwt: process.env.RC_JWT_TOKEN!
});

// NEW (Password):
await platform.login({
  username: process.env.RC_USERNAME!,
  extension: process.env.RC_EXTENSION,  // Optional
  password: process.env.RC_PASSWORD!
});
```

### 3. Update All Scripts (10 minutes)

Update these files to use password auth:
- `scripts/generate-jwt.ts` (can delete this)
- `scripts/list-extensions.ts`
- `scripts/test-connection.ts`
- `scripts/list-subscriptions.ts`
- `scripts/check-limits.ts`
- `scripts/list-phone-numbers.ts`
- `scripts/enable-extensions-with-numbers.ts`
- `scripts/check-user-role.ts`
- `scripts/check-call-limits.ts`

Replace JWT login with password login in each.

### 4. Test (5 minutes)

```bash
cd server
npm run test-connection
```

Should show:
```
✅ Authentication successful
✅ Auto-refresh enabled
✅ Token will never expire!
```

### 5. Restart Server (1 minute)

```bash
npm run dev
```

Server will authenticate with password and auto-refresh forever!

---

## Benefits:

✅ **Never expires** - tokens auto-refresh every hour
✅ **No manual regeneration** needed
✅ **Production ready** - standard enterprise pattern
✅ **Simple implementation** - just change login method
✅ **No UI changes** - backend only

---

## Important Notes:

### Security:
- Store credentials in `.env` (not in code)
- Add `.env` to `.gitignore`
- Use SuperAdmin credentials for multi-extension calling
- Consider using environment variables in production (not .env file)

### SuperAdmin Credentials:
- Username: SuperAdmin user's email
- Extension: SuperAdmin's extension number (optional)
- Password: SuperAdmin's password
- This gives you account-level permissions! ✅

### Still Works With Your User:
- If you use YOUR credentials (ext 7418)
- You can only call from extension 7418
- But tokens will auto-refresh!

---

## Comparison:

### JWT (Current):
- ❌ Expires every hour
- ❌ Manual regeneration required
- ✅ No password storage needed
- ⚠️  Limited to JWT owner's extension

### Password Flow:
- ✅ Auto-refreshes forever
- ✅ Never manually regenerate
- ⚠️  Stores password in .env
- ⚠️  Still limited to auth user's extension

### Password Flow + SuperAdmin:
- ✅ Auto-refreshes forever
- ✅ Can call from ALL extensions! ✅✅✅
- ✅ Production ready
- ⚠️  Stores SuperAdmin password

---

## The BEST Solution:

**Use Password Flow with SuperAdmin credentials:**

```bash
RC_USERNAME=superadmin@yourcompany.com
RC_EXTENSION=101  # SuperAdmin's extension
RC_PASSWORD=SuperAdminPassword
```

This gives you:
1. ✅ Auto-refreshing tokens (never expire)
2. ✅ SuperAdmin permissions (call from any extension)
3. ✅ Can use all 68 extensions with phone numbers
4. ✅ Scale to 68 concurrent lines
5. ✅ Production ready!

---

## Want me to implement this now?

I can convert your entire app to Password Flow in ~30 minutes.
Just need:
- SuperAdmin username
- SuperAdmin password
- SuperAdmin extension number

This would eliminate BOTH problems:
- No more expiring tokens ✅
- Can call from multiple extensions ✅
