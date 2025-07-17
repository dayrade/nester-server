# Supabase Scripts

This folder contains all Supabase-related scripts for the Nester application, organized within the server's Node.js environment.

## Quick Start

```bash
# Install dependencies
npm install

# Quick setup (generates SQL and opens Supabase dashboard)
npm run setup

# Verify setup completion
npm run verify

# Test authentication
npm run test
```

## Scripts Overview

### Setup Scripts
- **`quick-setup.js`** - One-click setup that generates SQL and opens Supabase dashboard
- **`setup-database.js`** - Validates schema and generates migration SQL
- **`complete-setup.js`** - Comprehensive setup with automatic verification

### Verification Scripts
- **`verify-100-percent.js`** - Complete verification of Supabase authentication
- **`test-supabase-auth.js`** - Tests authentication endpoints and flow
- **`test-login-debug.js`** - Debug script for login issues

### Migration Scripts
- **`apply-migrations.js`** - Apply migrations via Supabase API
- **`apply-migrations-direct.js`** - Direct database migration approach
- **`apply-migrations-rest.js`** - REST API migration approach

### SQL Files
- **`complete-schema.sql`** - Complete database schema
- **`nester-setup.sql`** - Generated setup SQL

## Usage Instructions

1. **First Time Setup:**
   ```bash
   npm run setup
   ```
   This will generate the SQL and open your Supabase dashboard. Copy and paste the SQL into the SQL Editor.

2. **Verify Setup:**
   ```bash
   npm run verify
   ```
   This will check if your Supabase authentication is 100% functional.

3. **Test Authentication:**
   ```bash
   npm run test
   ```
   This will run comprehensive authentication tests.

## Environment Variables

All scripts automatically load environment variables from `../../../.env` (project root).

Required variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Database Schema

The complete schema includes:
- **Tables:** users, agent_brands, properties, property_images, social_posts, social_stats, chat_sessions
- **Functions:** check_user_exists, get_user_role, create_user_profile
- **Triggers:** Automatic user profile creation
- **Security:** Row Level Security (RLS) policies

## Troubleshooting

If you encounter issues:
1. Ensure all environment variables are set
2. Check that your Supabase project is active
3. Verify the SQL was applied correctly in Supabase dashboard
4. Run `npm run verify` to identify specific issues

For detailed setup instructions, see `../../SETUP-COMPLETE.md`.