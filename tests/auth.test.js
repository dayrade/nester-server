const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const authController = require('../controller/authController');
const { supabase } = require('../config/supabaseClient');
const logger = require('../utils/logger');

// Mock Supabase for testing
jest.mock('../config/supabaseClient');
jest.mock('../utils/logger');

describe('Authentication System Tests', () => {
    let app;
    let testEmail;
    let testPassword;
    
    beforeAll(() => {
        // Setup test app
        app = express();
        app.use(express.json());
        app.use(cookieParser());
        
        // Setup routes
        app.post('/api/auth/signup', authController.signUpApi);
        app.post('/api/auth/signin', authController.signInApi);
        app.post('/api/auth/logout', authController.logout);
        app.post('/api/auth/verify-email', authController.verifyEmail);
        app.post('/api/auth/resend-verification', authController.resendVerification);
        app.get('/api/auth/verification-status', authController.checkVerificationStatus);
        
        // Test credentials
        testEmail = 'test@example.com';
        testPassword = 'TestPassword123!';
        
        // Mock logger
        logger.child = jest.fn().mockReturnValue({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        });
        logger.info = jest.fn();
        logger.warn = jest.fn();
        logger.error = jest.fn();
        logger.debug = jest.fn();
    });
    
    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });
    
    describe('User Signup', () => {
        test('should successfully create a new user with valid data', async () => {
            // Mock successful Supabase response
            supabase.auth.signUp.mockResolvedValue({
                data: {
                    user: {
                        id: 'test-user-id',
                        email: testEmail,
                        email_confirmed_at: null
                    },
                    session: null
                },
                error: null
            });
            
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: testEmail,
                    password: testPassword
                })
                .expect(201);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('verification email');
        });
        
        test('should reject signup with invalid email format', async () => {
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: 'invalid-email',
                    password: testPassword
                })
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
            expect(response.body.code).toBe('VALIDATION_EMAIL_INVALID');
        });
        
        test('should reject signup with weak password', async () => {
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: testEmail,
                    password: '123' // Too weak
                })
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
            expect(response.body.code).toBe('VALIDATION_PASSWORD_WEAK');
        });
        
        test('should handle existing user error', async () => {
            // Mock Supabase error for existing user
            supabase.auth.signUp.mockResolvedValue({
                data: { user: null, session: null },
                error: {
                    message: 'User already registered',
                    error: 'user_already_registered'
                }
            });
            
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: testEmail,
                    password: testPassword
                })
                .expect(409);
            
            expect(response.body.code).toBe('AUTH_USER_EXISTS');
        });
        
        test('should handle database connection failure', async () => {
            // Mock database connection failure
            supabase.auth.signUp.mockRejectedValue(new Error('Connection failed'));
            
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: testEmail,
                    password: testPassword
                })
                .expect(503);
            
            expect(response.body.code).toBe('DATABASE_CONNECTION_FAILED');
        });
    });
    
    describe('User Signin', () => {
        test('should successfully sign in with valid credentials', async () => {
            // Mock successful Supabase response
            supabase.auth.signInWithPassword.mockResolvedValue({
                data: {
                    user: {
                        id: 'test-user-id',
                        email: testEmail,
                        email_confirmed_at: new Date().toISOString()
                    },
                    session: {
                        access_token: 'test-access-token',
                        refresh_token: 'test-refresh-token',
                        expires_at: Date.now() + 3600000
                    }
                },
                error: null
            });
            
            const response = await request(app)
                .post('/api/auth/signin')
                .send({
                    email: testEmail,
                    password: testPassword
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe(testEmail);
            
            // Check if session cookie is set
            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies.some(cookie => cookie.includes('session_token'))).toBe(true);
        });
        
        test('should reject signin with invalid credentials', async () => {
            // Mock Supabase error for invalid credentials
            supabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: null, session: null },
                error: {
                    message: 'Invalid login credentials',
                    error: 'invalid_credentials'
                }
            });
            
            const response = await request(app)
                .post('/api/auth/signin')
                .send({
                    email: testEmail,
                    password: 'wrongpassword'
                })
                .expect(401);
            
            expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
        });
        
        test('should reject signin with unconfirmed email', async () => {
            // Mock Supabase response for unconfirmed email
            supabase.auth.signInWithPassword.mockResolvedValue({
                data: {
                    user: {
                        id: 'test-user-id',
                        email: testEmail,
                        email_confirmed_at: null
                    },
                    session: null
                },
                error: {
                    message: 'Email not confirmed',
                    error: 'email_not_confirmed'
                }
            });
            
            const response = await request(app)
                .post('/api/auth/signin')
                .send({
                    email: testEmail,
                    password: testPassword
                })
                .expect(401);
            
            expect(response.body.code).toBe('AUTH_EMAIL_NOT_CONFIRMED');
        });
    });
    
    describe('User Logout', () => {
        test('should successfully logout user', async () => {
            // Mock successful Supabase signout
            supabase.auth.signOut.mockResolvedValue({
                error: null
            });
            
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Cookie', ['session_token=test-token'])
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('Logged out successfully');
            
            // Check if session cookie is cleared
            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies.some(cookie => 
                cookie.includes('session_token=') && cookie.includes('Expires=')
            )).toBe(true);
        });
        
        test('should handle logout without session token', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
        });
    });
    
    describe('Email Verification', () => {
        test('should successfully verify email with valid token', async () => {
            // Mock successful email verification
            supabase.auth.verifyOtp.mockResolvedValue({
                data: {
                    user: {
                        id: 'test-user-id',
                        email: testEmail,
                        email_confirmed_at: new Date().toISOString()
                    },
                    session: {
                        access_token: 'test-access-token'
                    }
                },
                error: null
            });
            
            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({
                    token: 'valid-verification-token',
                    email: testEmail
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('verified successfully');
        });
        
        test('should reject invalid verification token', async () => {
            // Mock invalid token error
            supabase.auth.verifyOtp.mockResolvedValue({
                data: { user: null, session: null },
                error: {
                    message: 'Invalid token',
                    error: 'invalid_token'
                }
            });
            
            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({
                    token: 'invalid-token',
                    email: testEmail
                })
                .expect(401);
            
            expect(response.body.code).toBe('AUTH_TOKEN_INVALID');
        });
    });
    
    describe('Resend Verification', () => {
        test('should successfully resend verification email', async () => {
            // Mock successful resend
            supabase.auth.resend.mockResolvedValue({
                data: {},
                error: null
            });
            
            const response = await request(app)
                .post('/api/auth/resend-verification')
                .send({
                    email: testEmail
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.message).toContain('Verification email sent');
        });
        
        test('should handle user not found for resend', async () => {
            // Mock user not found error
            supabase.auth.resend.mockResolvedValue({
                data: {},
                error: {
                    message: 'User not found',
                    error: 'user_not_found'
                }
            });
            
            const response = await request(app)
                .post('/api/auth/resend-verification')
                .send({
                    email: 'nonexistent@example.com'
                })
                .expect(404);
            
            expect(response.body.code).toBe('AUTH_USER_NOT_FOUND');
        });
    });
    
    describe('Rate Limiting', () => {
        test('should enforce rate limiting on signup attempts', async () => {
            // Mock rate limit exceeded
            const requests = [];
            
            // Make multiple rapid requests
            for (let i = 0; i < 10; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/signup')
                        .send({
                            email: `test${i}@example.com`,
                            password: testPassword
                        })
                );
            }
            
            const responses = await Promise.all(requests);
            
            // At least one should be rate limited
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });
    
    describe('Input Validation and Sanitization', () => {
        test('should sanitize malicious input', async () => {
            const maliciousEmail = '<script>alert("xss")</script>@example.com';
            
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: maliciousEmail,
                    password: testPassword
                })
                .expect(400);
            
            expect(response.body.code).toBe('VALIDATION_EMAIL_INVALID');
        });
        
        test('should reject oversized input', async () => {
            const oversizedEmail = 'a'.repeat(1000) + '@example.com';
            
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: oversizedEmail,
                    password: testPassword
                })
                .expect(400);
            
            expect(response.body.code).toBe('VALIDATION_FAILED');
        });
    });
    
    describe('Error Handling', () => {
        test('should handle missing request body', async () => {
            const response = await request(app)
                .post('/api/auth/signup')
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
            expect(response.body.code).toBe('VALIDATION_FAILED');
        });
        
        test('should include correlation ID in error responses', async () => {
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: 'invalid-email',
                    password: testPassword
                })
                .expect(400);
            
            expect(response.body).toHaveProperty('correlationId');
            expect(typeof response.body.correlationId).toBe('string');
        });
        
        test('should not expose sensitive information in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            // Mock internal error
            supabase.auth.signUp.mockRejectedValue(new Error('Internal database error with sensitive info'));
            
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: testEmail,
                    password: testPassword
                })
                .expect(500);
            
            expect(response.body).not.toHaveProperty('details');
            expect(response.body.error).toBe('Internal server error');
            
            process.env.NODE_ENV = originalEnv;
        });
    });
});

// Integration tests with real Supabase (optional, requires test database)
describe('Integration Tests (Optional)', () => {
    // These tests would run against a real test Supabase instance
    // Uncomment and configure when you have a test database setup
    
    /*
    const testSupabaseUrl = process.env.TEST_SUPABASE_URL;
    const testSupabaseKey = process.env.TEST_SUPABASE_ANON_KEY;
    
    if (testSupabaseUrl && testSupabaseKey) {
        test('should perform full signup flow with real database', async () => {
            // Real integration test implementation
        });
    }
    */
});