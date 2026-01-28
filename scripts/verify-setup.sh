#!/bin/bash

# IRS Hold Hunter - Setup Verification Script
# Run this after installation to verify everything is configured correctly

set -e

echo "🔍 IRS Hold Hunter Setup Verification"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUCCESS="${GREEN}✅${NC}"
FAILURE="${RED}❌${NC}"
WARNING="${YELLOW}⚠️${NC}"

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
    echo -e "$SUCCESS Node.js version: $(node -v)"
else
    echo -e "$FAILURE Node.js version $(node -v) is too old. Need v20+"
    exit 1
fi

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    echo -e "$SUCCESS npm version: $(npm -v)"
else
    echo -e "$FAILURE npm not found"
    exit 1
fi

# Check Redis
echo "Checking Redis..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "$SUCCESS Redis is running"
    else
        echo -e "$FAILURE Redis is not running. Start with: brew services start redis"
        exit 1
    fi
else
    echo -e "$FAILURE redis-cli not found. Install with: brew install redis"
    exit 1
fi

# Check server dependencies
echo "Checking server dependencies..."
if [ -d "server/node_modules" ]; then
    echo -e "$SUCCESS Server dependencies installed"
else
    echo -e "$FAILURE Server dependencies not installed. Run: cd server && npm install"
    exit 1
fi

# Check client dependencies
echo "Checking client dependencies..."
if [ -d "client/node_modules" ]; then
    echo -e "$SUCCESS Client dependencies installed"
else
    echo -e "$FAILURE Client dependencies not installed. Run: cd client && npm install"
    exit 1
fi

# Check .env file
echo "Checking environment configuration..."
if [ -f "server/.env" ]; then
    echo -e "$SUCCESS .env file exists"
    
    # Check required variables
    REQUIRED_VARS=("RC_CLIENT_ID" "RC_CLIENT_SECRET" "RC_JWT_TOKEN" "IRS_NUMBER" "QUEUE_E164" "HOLD_EXTENSION_IDS" "WEBHOOK_BASE_URL")
    
    for VAR in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$VAR=" server/.env; then
            VALUE=$(grep "^$VAR=" server/.env | cut -d'=' -f2)
            if [ -n "$VALUE" ] && [ "$VALUE" != "<your-jwt-token>" ] && [ "$VALUE" != "<your-ngrok-url>" ]; then
                echo -e "$SUCCESS $VAR is set"
            else
                echo -e "$FAILURE $VAR is not configured properly"
                exit 1
            fi
        else
            echo -e "$FAILURE $VAR is missing from .env"
            exit 1
        fi
    done
else
    echo -e "$FAILURE .env file not found. Copy from .env.example"
    exit 1
fi

# Check Prisma
echo "Checking database..."
if [ -f "server/prisma/dev.db" ]; then
    echo -e "$SUCCESS Database file exists"
else
    echo -e "$WARNING Database not initialized. Run: cd server && npx prisma migrate dev"
fi

# Check if Prisma client is generated
if [ -d "server/node_modules/.prisma" ]; then
    echo -e "$SUCCESS Prisma client generated"
else
    echo -e "$FAILURE Prisma client not generated. Run: cd server && npx prisma generate"
    exit 1
fi

# Check ngrok
echo "Checking ngrok..."
if command -v ngrok &> /dev/null; then
    echo -e "$SUCCESS ngrok is installed"
    echo -e "$WARNING Make sure ngrok is running: ngrok http 3000"
else
    echo -e "$FAILURE ngrok not found. Install from: https://ngrok.com/download"
    exit 1
fi

# Test server health (if running)
echo "Testing server health..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "$SUCCESS Server is running and responding"
else
    echo -e "$WARNING Server is not running. Start with: cd server && npm run dev"
fi

# Test client (if running)
echo "Testing client..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "$SUCCESS Client is running"
else
    echo -e "$WARNING Client is not running. Start with: cd client && npm run dev"
fi

echo ""
echo "======================================"
echo "✅ Setup verification complete!"
echo ""
echo "Next steps:"
echo "1. Start server: cd server && npm run dev"
echo "2. Start client: cd client && npm run dev"
echo "3. Start ngrok: ngrok http 3000"
echo "4. Update WEBHOOK_BASE_URL in server/.env with ngrok URL"
echo "5. Open http://localhost:5173"
echo ""
echo "For detailed instructions, see QUICKSTART.md"
