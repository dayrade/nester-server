// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProperties() {
  try {
    console.log('🔍 Checking properties in database...');
    
    // Get all properties
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching properties:', error);
      return;
    }

    console.log(`📊 Found ${properties.length} properties:`);
    
    if (properties.length === 0) {
      console.log('📝 No properties found in database');
    } else {
      properties.forEach((property, index) => {
        console.log(`\n${index + 1}. Property ID: ${property.id}`);
        console.log(`   Address: ${property.address}`);
        console.log(`   Price: $${property.price ? property.price.toLocaleString() : 'N/A'}`);
        console.log(`   Agent ID: ${property.agent_id}`);
        console.log(`   Created: ${new Date(property.created_at).toLocaleString()}`);
        console.log(`   Status: ${property.listing_status}`);
      });
    }

    // Also check property images
    const { data: images, error: imageError } = await supabase
      .from('property_images')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!imageError && images.length > 0) {
      console.log(`\n🖼️  Found ${images.length} property images:`);
      images.forEach((image, index) => {
        console.log(`   ${index + 1}. Property: ${image.property_id}, Path: ${image.storage_path}`);
      });
    }

  } catch (err) {
    console.error('💥 Unexpected error:', err);
  }
}

// Run the check
checkProperties().then(() => {
  console.log('\n✅ Property check completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});