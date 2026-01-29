import RingCentralSDK from '../src/config/ringcentral.js';

async function listUnassignedNumbers() {
  try {
    const platform = await RingCentralSDK.getPlatform();
    
    console.log('📡 API Call: GET /restapi/v1.0/account/~/phone-number?perPage=1000\n');
    
    const response = await platform.get('/restapi/v1.0/account/~/phone-number', {
      perPage: 1000
    });
    
    const data = await response.json();
    
    console.log('📊 Total Numbers in Account:', data.records.length);
    console.log('');
    
    // Filter for unassigned numbers
    const unassigned = data.records.filter((num: any) => 
      !num.extension || num.usageType === 'Inventory'
    );
    
    console.log('💰 Unassigned/Available Numbers:', unassigned.length);
    console.log('   (These are numbers you\'re paying for but not using!)\n');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 COMPLETE LIST OF UNASSIGNED NUMBERS:\n');
    
    unassigned.forEach((num: any, i: number) => {
      console.log(`${i + 1}. ${num.phoneNumber}`);
      console.log(`   ID: ${num.id}`);
      console.log(`   Type: ${num.type}`);
      console.log(`   Usage: ${num.usageType}`);
      console.log(`   Status: ${num.status}`);
      console.log(`   Payment Type: ${num.paymentType}`);
      if (num.extension) {
        console.log(`   Extension: ${num.extension.extensionNumber} (${num.extension.name})`);
      } else {
        console.log(`   Extension: ❌ UNASSIGNED`);
      }
      console.log('');
    });
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('💡 To assign any of these to Extension 7418:');
    console.log('   1. Use the RingCentral Admin Portal');
    console.log('   2. Or add "EditAccounts" permission to your app');
    console.log('      and use the assign-phone-number.ts script');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

listUnassignedNumbers();
