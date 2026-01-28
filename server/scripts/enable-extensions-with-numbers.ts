import SDK from '@ringcentral/sdk';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

async function enableExtensionsWithNumbers() {
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
  
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  console.log('\n🔍 Finding extensions with direct numbers...\n');
  
  // Get all extensions
  const extResponse = await sdk.platform().get('/restapi/v1.0/account/~/extension?perPage=100');
  const extData = await extResponse.json();
  const allExtensions = extData.records.filter((ext: any) => ext.type === 'User' && ext.status === 'Enabled');
  
  console.log(`Found ${allExtensions.length} enabled user extensions\n`);
  
  // Get phone numbers (with rate limit handling)
  console.log('Fetching phone numbers (this may take a moment)...\n');
  
  let allPhoneNumbers: any[] = [];
  try {
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 10) { // Limit to 10 pages to avoid rate limit
      const response = await sdk.platform().get(
        `/restapi/v1.0/account/~/phone-number?perPage=100&page=${page}`
      );
      const data = await response.json();
      
      allPhoneNumbers = allPhoneNumbers.concat(data.records);
      
      hasMore = data.navigation?.nextPage != null;
      page++;
      
      // Small delay to avoid rate limit
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Found ${allPhoneNumbers.length} phone numbers\n`);
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log('⚠️  Rate limit hit - using partial data\n');
    } else {
      throw error;
    }
  }
  
  // Find direct numbers
  const directNumbers = allPhoneNumbers.filter(p => p.usageType === 'DirectNumber' && p.extension);
  
  // Map extension IDs to their phone numbers
  const extensionPhoneMap = new Map();
  
  for (const phone of directNumbers) {
    if (phone.extension) {
      const extId = phone.extension.id;
      if (!extensionPhoneMap.has(extId)) {
        extensionPhoneMap.set(extId, {
          extensionNumber: phone.extension.extensionNumber,
          name: phone.extension.name,
          phoneNumbers: []
        });
      }
      extensionPhoneMap.get(extId).phoneNumbers.push(phone.phoneNumber);
    }
  }
  
  console.log('📞 EXTENSIONS WITH DIRECT NUMBERS:\n');
  console.log('=' .repeat(80));
  
  const extensionsWithNumbers: any[] = [];
  
  for (const ext of allExtensions) {
    if (extensionPhoneMap.has(ext.id)) {
      const info = extensionPhoneMap.get(ext.id);
      extensionsWithNumbers.push({
        id: ext.id,
        extensionNumber: ext.extensionNumber,
        name: ext.name,
        phoneNumbers: info.phoneNumbers
      });
      
      console.log(`\n✅ Ext ${ext.extensionNumber}: ${ext.name || 'Unknown'}`);
      info.phoneNumbers.forEach((num: string) => {
        console.log(`   └─ ${num}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\nTotal: ${extensionsWithNumbers.length} extensions with direct numbers\n`);
  
  // Ask to enable them
  console.log('💾 ENABLING THESE EXTENSIONS IN REDIS...\n');
  
  let enabledCount = 0;
  
  for (const ext of extensionsWithNumbers) {
    // Check if extension exists in Redis
    const key = `extension:${ext.id}`;
    let existingData = await redis.get(key);
    let extension: any = {};
    
    if (existingData) {
      extension = JSON.parse(existingData);
    }
    
    // Update with new data
    extension = {
      ...extension,
      id: ext.id,
      extensionNumber: ext.extensionNumber,
      name: ext.name,
      type: 'User',
      status: 'Enabled',
      enabledForHunting: true, // Enable it!
      tags: extension.tags || [],
      phoneNumbers: ext.phoneNumbers, // Store the phone numbers
      hasDirectNumber: true
    };
    
    await redis.set(key, JSON.stringify(extension));
    enabledCount++;
  }
  
  console.log(`✅ Enabled ${enabledCount} extensions for hunting!\n`);
  
  console.log('=' .repeat(80));
  console.log('\n🎉 SUCCESS!\n');
  console.log('These extensions are now ready to use for Call-Out API.');
  console.log('They have direct phone numbers, so Call-Out will work!\n');
  console.log('Next steps:');
  console.log('  1. Go to http://localhost:5173');
  console.log('  2. Click "Start Hunt"');
  console.log('  3. System will use extensions with phone numbers');
  console.log('  4. Call-Out API should work! 🚀\n');
  
  await redis.quit();
}

enableExtensionsWithNumbers().catch(console.error);
