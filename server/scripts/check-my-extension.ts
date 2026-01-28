import RingCentralSDK from '../src/config/ringcentral.js';

async function checkExtension() {
  try {
    const platform = await RingCentralSDK.getPlatform();
    
    console.log('🔍 Checking Extension 7418 (Lindsey Stevens)...\n');
    
    // Get extension details
    const extResponse = await platform.get('/restapi/v1.0/account/~/extension/63663897007');
    const ext = await extResponse.json();
    
    console.log('📋 Basic Info:');
    console.log('  Name:', ext.name);
    console.log('  Extension #:', ext.extensionNumber);
    console.log('  Status:', ext.status);
    console.log('  Type:', ext.type);
    console.log('');
    
    console.log('📞 Phone Numbers Assigned:');
    if (ext.phoneNumbers && ext.phoneNumbers.length > 0) {
      ext.phoneNumbers.forEach((num: any) => {
        console.log('  ✅', num.phoneNumber);
        console.log('     Usage Type:', num.usageType);
        console.log('     Features:', num.features?.join(', ') || 'None');
      });
    } else {
      console.log('  ❌ NO PHONE NUMBERS ASSIGNED');
    }
    
    console.log('');
    console.log('📧 Contact Information:');
    console.log('  Business Phone:', ext.contact?.businessPhone || '❌ None');
    console.log('  Company Phone:', ext.contact?.companyPhone || 'None');
    console.log('  Mobile Phone:', ext.contact?.mobilePhone || 'None');
    
    console.log('');
    console.log('═══════════════════════════════════════════════');
    
    if (ext.phoneNumbers && ext.phoneNumbers.length > 0) {
      const directNumber = ext.phoneNumbers.find((n: any) => n.usageType === 'DirectNumber');
      if (directNumber) {
        console.log('✅ SUCCESS! Your extension HAS a direct phone number:');
        console.log(`   ${directNumber.phoneNumber}`);
        console.log('');
        console.log('🎉 You should now be able to make calls from your extension!');
      } else {
        console.log('⚠️  Phone number(s) found, but none are marked as "DirectNumber"');
        console.log('   You may need to change the usage type.');
      }
    } else {
      console.log('❌ PROBLEM: No phone numbers are assigned to your extension.');
      console.log('');
      console.log('🤔 If IT just assigned a number:');
      console.log('   1. It may take a few minutes to sync');
      console.log('   2. Try refreshing/syncing extensions in the app');
      console.log('   3. Verify in RingCentral Admin Portal that it saved correctly');
    }
    
  } catch (error: any) {
    console.error('❌ Error checking extension:', error.message);
  }
}

checkExtension();
