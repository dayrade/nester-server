const { createClient } = require('@supabase/supabase-js');

// Regular client for standard operations
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY);

// Admin client for admin operations (like checking if user exists)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

module.exports = {
  supabase,
  supabaseAdmin
};