import RingCentralSDK from '../src/config/ringcentral.js';
import logger from '../src/config/logger.js';

async function assignPhoneNumber() {
  try {
    const platform = await RingCentralSDK.getPlatform();
    const extensionId = '63663897007'; // Extension 7418
    
    console.log('🔍 Looking for available phone numbers...');
    
    // Get all phone numbers in the account
    const allNumbersResponse = await platform.get('/restapi/v1.0/account/~/phone-number', {
      perPage: 1000
    });
    const allNumbers = await allNumbersResponse.json();
    
    console.log(`📊 Total phone numbers in account: ${allNumbers.records.length}`);
    
    // Find unassigned numbers
    const unassignedNumbers = allNumbers.records.filter((num: any) => 
      !num.extension || num.usageType === 'Inventory'
    );
    
    console.log(`📋 Unassigned numbers found: ${unassignedNumbers.length}`);
    
    if (unassignedNumbers.length === 0) {
      console.log('❌ No unassigned numbers available in your account.');
      console.log('📞 You may need to purchase/provision a new number first.');
      console.log('');
      console.log('Options:');
      console.log('1. Purchase a new number in RingCentral Admin Portal');
      console.log('2. Unassign a number from another extension');
      console.log('3. Use the RingCentral Admin Portal to assign manually');
      return;
    }
    
    // Show available numbers
    console.log('\n📱 Available numbers:');
    unassignedNumbers.slice(0, 5).forEach((num: any, i: number) => {
      console.log(`  ${i + 1}. ${num.phoneNumber} (ID: ${num.id}, Type: ${num.type})`);
    });
    
    // Assign the first available number
    const numberToAssign = unassignedNumbers[0];
    console.log(`\n✨ Assigning ${numberToAssign.phoneNumber} to Extension 7418...`);
    
    // Update the phone number to assign it to the extension
    const assignResponse = await platform.put(
      `/restapi/v1.0/account/~/phone-number/${numberToAssign.id}`,
      {
        extension: {
          id: extensionId
        },
        usageType: 'DirectNumber'
      }
    );
    
    const result = await assignResponse.json();
    
    console.log('✅ SUCCESS! Phone number assigned.');
    console.log(`📞 Extension 7418 now has: ${result.phoneNumber}`);
    console.log('');
    console.log('🎉 You can now make calls from your extension!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.response) {
      const errorData = await error.response.json().catch(() => null);
      if (errorData) {
        console.error('Details:', JSON.stringify(errorData, null, 2));
      }
    }
    
    console.log('');
    console.log('💡 If this fails, you may need to:');
    console.log('1. Check if you have admin permissions');
    console.log('2. Purchase a new phone number');
    console.log('3. Use the RingCentral Admin Portal instead');
  }
}

assignPhoneNumber();
