import dotenv from 'dotenv';
dotenv.config();

console.log('\n🔑 JWT Token Generation Instructions:\n');
console.log('1. Go to: https://developers.ringcentral.com/my-account.html#/applications');
console.log('2. Find your app with Client ID: ' + process.env.RC_CLIENT_ID);
console.log('3. Click on the app name');
console.log('4. Go to "Credentials" tab');
console.log('5. Click "Create JWT" or "Generate JWT Token"');
console.log('6. Copy the token (starts with eyJ...)');
console.log('7. Update RC_JWT_TOKEN in server/.env\n');
console.log('⚠️  The JWT token expires, so you may need to regenerate it periodically.\n');
console.log('📝 Your current credentials:');
console.log('   RC_CLIENT_ID: ' + process.env.RC_CLIENT_ID);
console.log('   RC_CLIENT_SECRET: ' + (process.env.RC_CLIENT_SECRET?.substring(0, 10) || 'NOT SET') + '...');
console.log('   RC_JWT_TOKEN: ' + (process.env.RC_JWT_TOKEN === '<PASTE_JWT_HERE_AFTER_GENERATING>' ? '❌ NOT SET' : '✅ Set') + '\n');
