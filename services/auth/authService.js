const { supabase, supabaseAdmin } = require('../../config/supabaseClient');

const signUp = async (email, password) => {
  try {
    // Check if user already exists using admin listUsers
    const { data: usersList, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (checkError) {
      console.error('Error checking existing users:', checkError);
      return { data: null, error: checkError };
    }
    
    // Check if any user has the same email
    const existingUser = usersList.users?.find(user => user.email === email);
    
    if (existingUser) {
      return { 
        data: null, 
        error: { 
          message: 'USER_ALREADY_EXISTS',
          details: 'An account with this email already exists'
        }
      };
    }

    // If user doesn't exist, proceed with signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    return { data, error };
  } catch (err) {
    console.error('Signup error:', err);
    return { data: null, error: err };
  }
};

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function getUser(token) {
  return await supabase.auth.getUser(token);
}

async function resetPassword(email) {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`,
    });
    return { data, error };
  } catch (err) {
    console.error('Reset password error:', err);
    return { data: null, error: err };
  }
}

module.exports = {
  signUp,
  signIn,
  getUser,
  resetPassword,
};