const path = require('path');
const { signIn, signUp, getUser, resetPassword } = require('../services/auth/authService');

const userauth = {
    signUpApi: async (req, res) => {
        try {
            const { email, password } = req.body;
            const { data, error } = await signUp(email, password);

            if (error) {
                // Handle duplicate user case with specific status code
                if (error.code === 'USER_ALREADY_EXISTS') {
                    return res.status(409).json({
                        error: error.message,
                        code: error.code
                    });
                }
                
                return res.status(400).json({
                    error: error.message,
                    code: error.code || 'SIGNUP_FAILED'
                });
            }

            res.status(201).json({
                message: 'Signup successful! Please check your email for verification.',
                user: {
                    id: data.user?.id,
                    email: data.user?.email,
                    emailConfirmed: !!data.user?.email_confirmed_at
                }
            });
        } catch (error) {
            console.log('Signup error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    },

    signInApi: async (req, res) => {
        try {
            const { email, password } = req.body;
            const { data, error } = await signIn(email, password);

            if (error) {
                return res.status(400).json({
                    error: error.message,
                    code: error.code || 'SIGNIN_FAILED'
                });
            }

            res.cookie('access_token', data.session.access_token, { httpOnly: true });
            res.status(200).json({
                message: 'Signin successful',
                user: {
                    id: data.user?.id,
                    email: data.user?.email
                },
                session: {
                    access_token: data.session.access_token,
                    expires_at: data.session.expires_at
                }
            });
        } catch (error) {
            console.log('Signin error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    },

    logout: async (req, res) => {
        res.clearCookie('access_token');
        res.status(200).json({ message: 'Logged out successfully' });
    },

    resetPasswordApi: async (req, res) => {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({
                    error: 'Email is required',
                    code: 'MISSING_EMAIL'
                });
            }

            const { data, error } = await resetPassword(email);

            if (error) {
                return res.status(400).json({
                    error: error.message,
                    code: error.code || 'RESET_PASSWORD_FAILED'
                });
            }

            res.status(200).json({
                message: 'Password reset email sent successfully! Please check your inbox.',
                data
            });
        } catch (error) {
            console.log('Reset password error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
};

module.exports = userauth;