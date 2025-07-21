const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test data for property creation
const testProperty = {
  address: '123 Test Street, Test City, TC 12345',
  price: 450000,
  bedrooms: 3,
  bathrooms: 2,
  description: 'Beautiful test property for automated content generation testing'
};

async function testPropertyCreation() {
  try {
    console.log('Testing property creation with automatic content generation...');
    console.log('Property data:', testProperty);
    
    // Create property
    const response = await axios.post(`${BASE_URL}/api/properties`, testProperty, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n=== Property Creation Response ===');
    console.log('Status:', response.status);
    console.log('Property ID:', response.data.id);
    console.log('Content Generation Status:', response.data.content_generation_status);
    console.log('Content Generation Job ID:', response.data.content_generation_job_id);
    
    if (response.data.content_generation_status === 'pending' && response.data.content_generation_job_id) {
      console.log('\n✅ SUCCESS: Content generation started automatically!');
    } else {
      console.log('\n❌ ISSUE: Content generation did not start automatically');
    }
    
    return response.data;
    
  } catch (error) {
    console.error('\n❌ Error creating property:', error.response?.data || error.message);
    throw error;
  }
}

// Run the test
testPropertyCreation()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });