import SDK from '@ringcentral/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function checkUserRole() {
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
  
  console.log('\n🔐 Current JWT User Analysis\n');
  console.log('='.repeat(80));
  
  try {
    // Get current extension (the JWT owner)
    const extResponse = await sdk.platform().get('/restapi/v1.0/account/~/extension/~');
    const extension = await extResponse.json();
    
    console.log('\n👤 JWT Owner Information:');
    console.log(`   Name: ${extension.name || 'N/A'}`);
    console.log(`   Extension: ${extension.extensionNumber}`);
    console.log(`   Extension ID: ${extension.id}`);
    console.log(`   Type: ${extension.type}`);
    console.log(`   Status: ${extension.status}`);
    
    // Get permissions/roles
    if (extension.permissions) {
      console.log('\n🔑 Permissions:');
      console.log(`   Admin: ${extension.permissions.admin ? '✅ YES' : '❌ NO'}`);
      console.log(`   International Calling: ${extension.permissions.internationalCalling ? '✅ YES' : '❌ NO'}`);
    }
    
    // Check if user has admin roles
    const accountResponse = await sdk.platform().get('/restapi/v1.0/account/~');
    const account = await accountResponse.json();
    
    console.log('\n🏢 Account Information:');
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Status: ${account.status}`);
    
    // Try to get admin info (will fail if not admin)
    try {
      const adminResponse = await sdk.platform().get(`/restapi/v1.0/account/~/extension/${extension.id}`);
      const adminInfo = await adminResponse.json();
      
      if (adminInfo.permissions?.admin) {
        console.log('\n🎯 Admin Status:');
        console.log('   Role: ✅ ADMINISTRATOR');
        
        if (adminInfo.permissions.admin.enabled) {
          console.log('   Level: ACCOUNT ADMIN');
        }
      } else {
        console.log('\n🎯 Admin Status:');
        console.log('   Role: ❌ REGULAR USER');
      }
    } catch (error) {
      console.log('\n🎯 Admin Status:');
      console.log('   Role: ❌ REGULAR USER (Limited Permissions)');
    }
    
    // Check what this JWT can do
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 WHAT THIS JWT CAN DO:\n');
    
    const isAdmin = extension.permissions?.admin?.enabled;
    
    if (isAdmin) {
      console.log('   ✅ This JWT has ADMIN permissions');
      console.log('   ✅ Can make calls from ANY extension (with SuperAdmin)');
      console.log('   ✅ Can manage all users and settings');
      console.log('   ✅ Full account-level access');
    } else {
      console.log('   ❌ This JWT is for a REGULAR USER');
      console.log(`   ❌ Can only make calls from extension ${extension.extensionNumber} (${extension.id})`);
      console.log('   ❌ Cannot make calls from other extensions');
      console.log('   ❌ Limited to user-level permissions');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n💡 WHAT YOU NEED:\n');
    
    if (!isAdmin) {
      console.log('   To make calls from multiple extensions, you need:');
      console.log('   1. ✅ SuperAdmin JWT (from a SuperAdmin account)');
      console.log('   2. ✅ OR assign phone number to YOUR extension (7418)');
      console.log('      and only use YOUR extension for testing\n');
      
      console.log('   Current Situation:');
      console.log(`   • Your JWT is tied to extension ${extension.extensionNumber}`);
      console.log(`   • You can ONLY make calls from extension ${extension.extensionNumber}`);
      console.log('   • Other extensions (101, 105, 106) will fail with 400 error\n');
      
      console.log('   To Get SuperAdmin JWT:');
      console.log('   1. Find who has SuperAdmin role in your org');
      console.log('   2. Have them login to https://developers.ringcentral.com');
      console.log('   3. Generate JWT for your app (AtpXtqyJ3bufjb8OL9CwbG)');
      console.log('   4. Copy JWT and update RC_JWT_TOKEN in .env');
      console.log('   5. Restart server');
      console.log('   6. Multi-extension calling should work! ✅\n');
    } else {
      console.log('   ✅ You already have admin permissions!');
      console.log('   ✅ Multi-extension calling should work');
      console.log('   ✅ If still getting 400 errors, check app permissions\n');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error checking user info:', error.message);
  }
}

checkUserRole().catch(console.error);
