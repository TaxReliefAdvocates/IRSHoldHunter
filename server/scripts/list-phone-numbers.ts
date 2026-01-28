import SDK from '@ringcentral/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function listPhoneNumbers() {
  const sdk = new (SDK as any).SDK({
    server: process.env.RC_SERVER_URL!,
    clientId: process.env.RC_CLIENT_ID!,
    clientSecret: process.env.RC_CLIENT_SECRET!
  });

  await sdk.login({ jwt: process.env.RC_JWT_TOKEN! });
  
  console.log('\n📞 RingCentral Phone Numbers (Digital Lines)\n');
  console.log('='.repeat(80));
  
  // 1. Get company main number
  console.log('\n🏢 COMPANY MAIN NUMBER:');
  const accountResponse = await sdk.platform().get('/restapi/v1.0/account/~');
  const account = await accountResponse.json();
  
  const mainCompanyNumber = account.mainNumber;
  console.log(`   ${mainCompanyNumber || 'Not found'}`);
  
  // 2. Get all phone numbers in account
  console.log('\n📋 ALL PHONE NUMBERS IN ACCOUNT:\n');
  
  let allPhoneNumbers: any[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await sdk.platform().get(
      `/restapi/v1.0/account/~/phone-number?perPage=100&page=${page}`
    );
    const data = await response.json();
    
    allPhoneNumbers = allPhoneNumbers.concat(data.records);
    
    hasMore = data.navigation?.nextPage != null;
    page++;
  }
  
  console.log(`Found ${allPhoneNumbers.length} total phone numbers\n`);
  
  // 3. Categorize phone numbers
  const mainNumbers = allPhoneNumbers.filter(p => p.usageType === 'MainCompanyNumber');
  const directNumbers = allPhoneNumbers.filter(p => p.usageType === 'DirectNumber');
  const faxNumbers = allPhoneNumbers.filter(p => p.usageType === 'Fax');
  const otherNumbers = allPhoneNumbers.filter(p => 
    !['MainCompanyNumber', 'DirectNumber', 'Fax'].includes(p.usageType)
  );
  
  // Display Main Numbers
  if (mainNumbers.length > 0) {
    console.log('🏢 MAIN COMPANY NUMBERS:');
    mainNumbers.forEach(phone => {
      const ext = phone.extension?.extensionNumber || '-';
      console.log(`   ${phone.phoneNumber} (Ext: ${ext})`);
    });
    console.log('');
  }
  
  // Display Direct Numbers with extensions
  if (directNumbers.length > 0) {
    console.log('📞 DIRECT NUMBERS (Available for Call-Out):');
    console.log('   (These can be used as "from" numbers for outbound calls)\n');
    
    // Group by extension
    const byExtension = new Map();
    
    for (const phone of directNumbers) {
      if (phone.extension) {
        const extNum = phone.extension.extensionNumber;
        if (!byExtension.has(extNum)) {
          byExtension.set(extNum, {
            name: phone.extension.name || 'Unknown',
            numbers: []
          });
        }
        byExtension.get(extNum).numbers.push(phone.phoneNumber);
      } else {
        console.log(`   ${phone.phoneNumber} - Unassigned`);
      }
    }
    
    // Sort by extension number
    const sortedExtensions = Array.from(byExtension.entries()).sort((a, b) => {
      return parseInt(a[0]) - parseInt(b[0]);
    });
    
    sortedExtensions.forEach(([extNum, info]) => {
      console.log(`   Ext ${extNum}: ${info.name}`);
      info.numbers.forEach((num: string) => {
        console.log(`      └─ ${num}`);
      });
    });
    console.log('');
  }
  
  // Display Fax Numbers
  if (faxNumbers.length > 0) {
    console.log('📠 FAX NUMBERS:');
    faxNumbers.forEach(phone => {
      const ext = phone.extension?.extensionNumber || '-';
      console.log(`   ${phone.phoneNumber} (Ext: ${ext})`);
    });
    console.log('');
  }
  
  // Display Other Numbers
  if (otherNumbers.length > 0) {
    console.log('📱 OTHER NUMBERS:');
    otherNumbers.forEach(phone => {
      const ext = phone.extension?.extensionNumber || '-';
      const usage = phone.usageType || 'Unknown';
      console.log(`   ${phone.phoneNumber} (Ext: ${ext}, Type: ${usage})`);
    });
    console.log('');
  }
  
  // 4. Show which numbers can be used for Call-Out
  console.log('='.repeat(80));
  console.log('\n✅ NUMBERS YOU CAN USE FOR CALL-OUT:\n');
  
  const usableNumbers = allPhoneNumbers.filter(p => 
    p.usageType === 'DirectNumber' && p.extension
  );
  
  if (usableNumbers.length > 0) {
    console.log(`You have ${usableNumbers.length} direct number(s) that can make outbound calls:\n`);
    
    usableNumbers.forEach(phone => {
      const ext = phone.extension.extensionNumber;
      const name = phone.extension.name || 'Unknown';
      console.log(`   ${phone.phoneNumber} → Ext ${ext} (${name})`);
    });
    
    console.log('\n💡 To use these for IRS Hold Hunter:');
    console.log('   1. Go to Extensions tab');
    console.log('   2. Enable these extension numbers for hunting');
    console.log('   3. Start a job!\n');
  } else {
    console.log('❌ No direct numbers found!\n');
    console.log('   You need to assign phone numbers to extensions.');
    console.log('   Go to: RingCentral Admin Portal → Users & Extensions\n');
  }
  
  // 5. Show company main number usage
  if (mainCompanyNumber) {
    console.log('='.repeat(80));
    console.log('\n🏢 COMPANY MAIN NUMBER OPTIONS:\n');
    console.log(`Main Number: ${mainCompanyNumber}\n`);
    console.log('⚠️  Note about using company main number:');
    console.log('   - Main number typically cannot be used directly for Call-Out API');
    console.log('   - It routes to IVR/auto-attendant');
    console.log('   - You need direct numbers (assigned to extensions) for outbound calling');
    console.log('   - OR you need to set up "shared line appearances"\n');
    
    console.log('💡 Alternatives:');
    console.log('   1. Assign direct numbers to extensions (recommended)');
    console.log('   2. Use Twilio with your own numbers (no restrictions)');
    console.log('   3. Get SuperAdmin JWT + use any extension\n');
  }
  
  console.log('='.repeat(80) + '\n');
}

listPhoneNumbers().catch(console.error);
