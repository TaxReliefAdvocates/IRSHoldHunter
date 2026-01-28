import rcService from '../src/services/RCService.js';

async function check() {
  const platform = rcService.getPlatform();
  
  // Get all phone numbers
  const response = await platform.get('/restapi/v1.0/account/~/phone-number?perPage=100');
  const data: any = await response.json();
  
  // Filter for extension 63663897007
  const myNumbers = data.records.filter((p: any) => p.extension?.id === '63663897007');
  
  console.log('\n=== Phone Numbers for Extension 63663897007 ===');
  console.log('Total found:', myNumbers.length);
  myNumbers.forEach((num: any) => {
    console.log('\nPhone:', num.phoneNumber);
    console.log('Usage Type:', num.usageType);
    console.log('Type:', num.type);
    console.log('Features:', num.features);
  });
  
  process.exit(0);
}

check().catch(console.error);
