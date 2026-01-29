# Quick Start Guide

Get IRS Hold Hunter running in 5 minutes.

## Prerequisites Check

```bash
node --version  # Should be 20+
redis-cli ping  # Should return "PONG"
```

If Redis is not running:
```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

## Installation

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Setup environment (server)
cd server
cp .env.example .env
nano .env  # Edit RC credentials and config

# 3. Setup database
npx prisma migrate dev --name init
npm run prisma:seed

# 4. Start ngrok (separate terminal)
ngrok http 3000
# Copy HTTPS URL and update WEBHOOK_BASE_URL in server/.env

# 5. Start server (terminal 1)
cd server
npm run dev

# 6. Start client (terminal 2)
cd client
npm run dev
```

## Open Application

Navigate to http://localhost:5173 and click "Start IRS Hunt"

## Verify It's Working

### Check Server Logs

You should see:
- ✅ Redis connected
- ✅ Database connected
- ✅ RingCentral SDK authenticated successfully
- ✅ Webhook subscription created: {id}
- 🚀 Server running on port 3000

### Check Webhook

```bash
curl https://your-ngrok-url.ngrok.io/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Monitor Calls

Once you start a job:
1. Frontend shows 6 call legs
2. Each leg status updates in real-time
3. First leg to go HOLDING → LIVE wins
4. Winner gets transferred, others hang up

## Common Issues

### "RC_JWT_TOKEN environment variable is required"

Edit `server/.env` and add your JWT token from RingCentral.

### "Failed to create webhook subscription"

- Verify `WEBHOOK_BASE_URL` uses HTTPS (ngrok URL)
- Check RingCentral credentials are correct
- Ensure JWT token is not expired

### Calls not dialing

- Verify `HOLD_EXTENSION_IDS` match your RingCentral extensions
- Check extensions are not in use
- Review server logs for errors

### Frontend not updating

- Check Socket.io connection indicator (green dot in header)
- Verify both server and client are running
- Check browser console for errors

## Next Steps

- Review [README.md](README.md) for detailed documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Explore Prisma Studio: `npx prisma studio`

## Support

If you're stuck, check the logs:

```bash
# Server logs
cd server
tail -f combined.log

# Redis status
redis-cli ping

# Database
cd server
npx prisma studio
```
