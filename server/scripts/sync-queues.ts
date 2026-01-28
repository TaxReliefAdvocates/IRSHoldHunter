import SDK from '@ringcentral/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function syncQueues() {
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  try {
    console.log('🔐 Authenticating...');
    await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
    
    console.log('📞 Fetching call queues from RingCentral...\n');
    
    const response = await sdk.platform().get('/restapi/v1.0/account/~/call-queues');
    const data = await response.json();
    
    if (!data.records || data.records.length === 0) {
      console.log('⚠️  No call queues found in your RingCentral account.\n');
      return;
    }
    
    console.log(`Found ${data.records.length} call queues:\n`);
    console.log('ID\t\t\tExt\tName\t\t\t\tPhone Number');
    console.log('─'.repeat(100));
    
    for (const queue of data.records) {
      // Get details including phone number
      const detailsResponse = await sdk.platform().get(
        `/restapi/v1.0/account/~/extension/${queue.id}`
      );
      const details = await detailsResponse.json();
      
      const phone = details.contact?.businessPhone || 'N/A';
      const name = queue.name.padEnd(25);
      
      console.log(`${queue.id}\t${queue.extensionNumber}\t${name}\t${phone}`);
    }
    
    console.log('\n💡 Next Steps:');
    console.log('1. Start the server: cd server && npm run dev');
    console.log('2. Sync to Redis: curl -X POST http://localhost:3000/api/queues/sync');
    console.log('3. Set default: curl -X POST http://localhost:3000/api/queues/{queue-id}/set-default');
    console.log('4. Or use the Queue Management UI\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('jwt') || error.message?.includes('401')) {
      console.log('\n⚠️  JWT token is invalid or expired.');
      console.log('   Run: npm run generate-jwt (for instructions)\n');
    }
  }
}

syncQueues();
