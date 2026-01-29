import SDK from '@ringcentral/sdk';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

async function syncExtensions() {
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    console.log('🔐 Authenticating...');
    await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
    
    console.log('📞 Fetching extensions from RingCentral...\n');
    const response = await sdk.platform().get('/restapi/v1.0/account/~/extension');
    const data = await response.json();
    
    console.log(`Found ${data.records.length} extensions. Syncing to Redis...\n`);
    
    let syncedCount = 0;
    
    for (const ext of data.records) {
      const key = `extension:${ext.id}`;
      
      // Check if extension already exists in Redis
      const existingData = await redis.get(key);
      const existing = existingData ? JSON.parse(existingData) : null;
      
      const extension = {
        id: ext.id,
        extensionNumber: ext.extensionNumber,
        name: ext.name || 'Unknown',
        department: ext.department || '',
        type: ext.type,
        status: ext.status,
        enabledForHunting: existing?.enabledForHunting || false,
        tags: existing?.tags || [],
        currentJobId: existing?.currentJobId,
        lastUsed: existing?.lastUsed
      };
      
      await redis.set(key, JSON.stringify(extension));
      syncedCount++;
      
      if (syncedCount % 10 === 0) {
        process.stdout.write(`\rSynced ${syncedCount}/${data.records.length} extensions...`);
      }
    }
    
    console.log(`\n✅ Successfully synced ${syncedCount} extensions to Redis\n`);
    
    // Show breakdown
    const userExts = data.records.filter((ext: any) => ext.type === 'User' && ext.status === 'Enabled');
    console.log('📊 Extension Breakdown:');
    console.log(`   Total: ${data.records.length}`);
    console.log(`   Enabled Users: ${userExts.length}`);
    console.log(`   Types: ${[...new Set(data.records.map((e: any) => e.type))].join(', ')}`);
    
    console.log('\n💡 Next Steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Open Extension Manager in UI');
    console.log('3. Enable extensions for hunting');
    console.log('4. Create extension pools');
    console.log('5. Start your first job!\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await redis.quit();
  }
}

syncExtensions();
