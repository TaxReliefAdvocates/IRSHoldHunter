import SDK from '@ringcentral/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function listExtensions() {
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  try {
    console.log('🔐 Authenticating...');
    await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
    
    console.log('📞 Fetching extensions...\n');
    const response = await sdk.platform().get('/restapi/v1.0/account/~/extension');
    const data = await response.json();
    
    console.log('ID\t\tExt #\t\tName\t\t\t\tType\t\tStatus');
    console.log('─'.repeat(120));
    
    data.records.forEach((ext: any) => {
      const name = (ext.name || '').padEnd(30);
      console.log(`${ext.id}\t${ext.extensionNumber}\t\t${name}\t${ext.type}\t${ext.status}`);
    });
    
    console.log('\n💡 Next Steps:');
    console.log('1. Pick 6 extension IDs to use as "hold lines"');
    console.log('2. Update HOLD_EXTENSION_IDS in .env');
    console.log('   Format: HOLD_EXTENSION_IDS=id1,id2,id3,id4,id5,id6\n');
    console.log('📋 Example (using first 6 User extensions):');
    
    const userExts = data.records
      .filter((ext: any) => ext.type === 'User' && ext.status === 'Enabled')
      .slice(0, 6);
    
    if (userExts.length >= 6) {
      const ids = userExts.map((ext: any) => ext.id).join(',');
      console.log(`   HOLD_EXTENSION_IDS=${ids}\n`);
    } else {
      console.log(`   ⚠️  Only found ${userExts.length} enabled User extensions. Need 6 total.\n`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('jwt') || error.message?.includes('401')) {
      console.log('\n⚠️  JWT token is invalid or expired.');
      console.log('   Run: npm run generate-jwt (for instructions)\n');
    }
  }
}

listExtensions();
