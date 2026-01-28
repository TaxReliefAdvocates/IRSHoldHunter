import SDK from '@ringcentral/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function listSubscriptions() {
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  try {
    console.log('🔐 Authenticating...');
    await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
    
    const response = await sdk.platform().get('/restapi/v1.0/subscription');
    const data = await response.json();
    
    console.log('\n📡 Active Webhook Subscriptions:\n');
    
    if (data.records.length === 0) {
      console.log('No subscriptions found. App will create one on startup.\n');
      return;
    }
    
    data.records.forEach((sub: any, i: number) => {
      console.log(`Subscription ${i + 1}:`);
      console.log(`  ID: ${sub.id}`);
      console.log(`  Status: ${sub.status}`);
      console.log(`  URL: ${sub.deliveryMode.address}`);
      console.log(`  Created: ${new Date(sub.creationTime).toLocaleString()}`);
      console.log(`  Expires: ${new Date(sub.expirationTime).toLocaleString()}`);
      console.log(`  Events: ${sub.eventFilters.join(', ')}`);
      console.log('─'.repeat(80));
    });
    
    console.log('\n💡 Tip: Old subscriptions can be deleted in RingCentral Developer Console\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('jwt') || error.message?.includes('401')) {
      console.log('\n⚠️  JWT token is invalid or expired.');
      console.log('   Run: npm run generate-jwt (for instructions)\n');
    }
  }
}

listSubscriptions();
