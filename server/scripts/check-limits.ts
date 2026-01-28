import SDK from '@ringcentral/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function checkLimits() {
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  try {
    console.log('🔐 Authenticating...\n');
    await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
    
    // Get account limits
    const response = await sdk.platform().get('/restapi/v1.0/account/~/extension');
    const extensions = await response.json();
    
    const enabledExtensions = extensions.records.filter((e: any) => e.status === 'Enabled');
    const userExtensions = enabledExtensions.filter((e: any) => e.type === 'User');
    
    console.log(`📊 Your RingCentral Account:\n`);
    console.log(`Total Extensions: ${extensions.records.length}`);
    console.log(`Enabled Extensions: ${enabledExtensions.length}`);
    console.log(`Enabled User Extensions: ${userExtensions.length}`);
    
    console.log(`\n💡 Estimated Concurrent Call Capacity:`);
    
    const configuredExtensions = process.env.HOLD_EXTENSION_IDS!.split(',').length;
    console.log(`Current config: ${configuredExtensions} extensions = ~${configuredExtensions * 1}-${configuredExtensions * 3} calls`);
    console.log(`Maximum possible: ${enabledExtensions.length} extensions = ~${enabledExtensions.length * 1}-${enabledExtensions.length * 3} calls`);
    
    console.log(`\n📞 Extension Types Breakdown:`);
    const typeCount: any = {};
    extensions.records.forEach((ext: any) => {
      typeCount[ext.type] = (typeCount[ext.type] || 0) + 1;
    });
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    console.log(`\n⚠️  Notes:`);
    console.log(`   - Each extension can typically handle 1-3 concurrent calls`);
    console.log(`   - This app uses ${configuredExtensions} extensions for hold lines`);
    console.log(`   - Consider your account's concurrent call limits`);
    console.log(`   - Contact RingCentral if you need higher capacity\n`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('jwt') || error.message?.includes('401')) {
      console.log('\n⚠️  JWT token is invalid or expired.');
      console.log('   Run: npm run generate-jwt (for instructions)\n');
    }
  }
}

checkLimits();
