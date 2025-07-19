const express = require('express');
const router = express.Router();
const propertyService = require('../services/property/propertyService');

// Simple test route without authentication
router.post('/test', async (req, res) => {
  try {
    console.log('Test property creation request received:', req.body);
    
    const { supabaseAdmin } = require('../config/supabaseClient');
      
      // Check if there are any existing users we can use
      const { data: existingUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .limit(1);
      
      if (usersError) {
        console.log('Error checking existing users:', usersError);
        throw new Error(`Failed to check existing users: ${usersError.message}`);
      }
      
      let agentId;
      
      if (existingUsers && existingUsers.length > 0) {
        // Use existing user
        agentId = existingUsers[0].id;
        console.log('Using existing user:', existingUsers[0]);
      } else {
        // Create a test user in auth.users first, then in users table
        console.log('No existing users found. Database needs to be set up with proper schema.');
        
        // For now, let's test without foreign key constraints by temporarily disabling them
        // This is just for testing the basic insertion functionality
        const testUserId = require('crypto').randomUUID();
        
        // Try to insert property without user validation (this will likely fail but shows the issue)
        const propertyData = {
          id: require('crypto').randomUUID(),
          agent_id: testUserId,
          address: req.body.title || req.body.address || 'Test Property Address'
        };
        
        console.log('Attempting property insertion without valid user (will likely fail):', propertyData);
        
        const { data, error } = await supabaseAdmin
          .from('properties')
          .insert([propertyData])
          .select('*')
          .single();
        
        if (error) {
          console.log('Expected error - foreign key constraint:', error.message);
          throw new Error(`Property insertion failed as expected due to missing user: ${error.message}`);
        }
        
        console.log('Property created successfully:', data);
        return res.status(200).json({
          success: true,
          message: 'Property created successfully',
          data: data
        });
      }
      
      // Create property with existing user
      const propertyData = {
        id: require('crypto').randomUUID(),
        agent_id: agentId,
        address: req.body.title || req.body.address || 'Test Property Address'
      };
      
      console.log('Attempting to insert property data with existing user:', propertyData);
      
      const { data, error } = await supabaseAdmin
        .from('properties')
        .insert([propertyData])
        .select('*')
        .single();
      
      if (error) {
        console.log('Property insertion error details:', error);
        throw new Error(`Property insertion failed: ${error.message}`);
      }
    
    console.log('Property created successfully:', data);
    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: data
    });
  } catch (error) {
    console.error('Error creating test property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create property',
      error: error.message
    });
  }
});

module.exports = router;