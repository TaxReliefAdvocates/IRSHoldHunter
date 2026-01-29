import SDK from '@ringcentral/sdk';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🧪 Testing IRS Hold Hunter Setup...\n');
  
  let allPassed = true;
  
  // Test 1: Redis Connection
  console.log('Test 1: Redis Connection');
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const pong = await redis.ping();
    if (pong === 'PONG') {
      console.log('✅ Redis connected\n');
    } else {
      throw new Error('Unexpected response from Redis');
    }
    await redis.quit();
  } catch (error: any) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('   Start Redis: redis-server\n');
    allPassed = false;
  }
  
  // Test 2: RingCentral Authentication
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  try {
    console.log('Test 2: RingCentral Authentication');
    await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
    console.log('✅ RingCentral authenticated\n');
    
    console.log('Test 3: Account Info');
    const accountResponse = await sdk.platform().get('/restapi/v1.0/account/~');
    const accountData = await accountResponse.json();
    console.log(`✅ Account: ${accountData.name} (ID: ${accountData.id})\n`);
    
    console.log('Test 4: Token Info');
    const tokenData = await sdk.platform().auth().data();
    const expiresInMinutes = Math.floor(tokenData.expires_in / 60);
    console.log(`✅ Token expires in: ${expiresInMinutes} minutes`);
    console.log(`✅ Refresh token available: ${!!tokenData.refresh_token}\n`);
    
    console.log('Test 5: Extension Count');
    const extResponse = await sdk.platform().get('/restapi/v1.0/account/~/extension');
    const extData = await extResponse.json();
    const userExts = extData.records.filter((ext: any) => ext.type === 'User' && ext.status === 'Enabled');
    console.log(`✅ Total extensions: ${extData.records.length}`);
    console.log(`✅ Enabled user extensions: ${userExts.length}\n`);
    
    if (userExts.length < 6) {
      console.log('⚠️  Warning: Need at least 6 enabled user extensions for hold lines');
      console.log(`   Currently have: ${userExts.length}\n`);
    }
    
    console.log('Test 6: Webhook Subscriptions');
    const subsResponse = await sdk.platform().get('/restapi/v1.0/subscription');
    const subsData = await subsResponse.json();
    console.log(`✅ Active subscriptions: ${subsData.records.length}\n`);
    
    console.log('🎉 All tests passed! System is ready.\n');
    console.log('📋 Next steps:');
    console.log('1. Run: npm run list-extensions (to get extension IDs)');
    console.log('2. Update HOLD_EXTENSION_IDS in .env');
    console.log('3. Run: npm run dev\n');
    
  } catch (error: any) {
    console.error('❌ RingCentral test failed:', error.message);
    if (error.response) {
      try {
        const data = await error.response.json();
        console.error('Response:', data);
      } catch {}
    }
    if (error.message?.includes('jwt') || error.message?.includes('401')) {
      console.log('\n⚠️  JWT token is invalid or expired.');
      console.log('   Run: npm run generate-jwt (for instructions)\n');
    }
    allPassed = false;
  }
  
  if (!allPassed) {
    process.exit(1);
  }
}

testConnection();
