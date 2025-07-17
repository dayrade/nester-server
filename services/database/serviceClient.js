require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Service-role client that bypasses RLS for administrative operations
const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // NEVER expose to client-side
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = supabaseService;