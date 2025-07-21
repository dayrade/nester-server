const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const propertyService = require('../services/property/propertyService');
const logger = require('../utils/logger');

const getProfile = async (req, res) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Fetch user profile from Supabase
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!profile) {
      // Create default profile if doesn't exist
      const defaultProfile = {
        id: agentId,
        email: req.user.email,
        full_name: '',
        role: 'agent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('users')
        .upsert(defaultProfile)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return res.json({
        success: true,
        data: newProfile
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const updateData = {
      ...req.body,
      id: agentId,
      updated_at: new Date().toISOString()
    };

    // Remove email from update data as it shouldn't be changed
    delete updateData.email;

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('users')
      .upsert(updateData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    // Mock avatar upload response
    const avatarUrl = process.env.DEFAULT_AVATAR_URL || 'https://example.com/avatar.jpg';

    res.json({
      success: true,
      data: {
        avatar_url: avatarUrl
      },
      message: 'Avatar uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload avatar'
    });
  }
};

const getProfileStats = async (req, res) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get property statistics from property service
    const propertyStats = await propertyService.getPropertyStatistics(agentId);
    
    // Get social posts count
    const { data: socialPosts, error: socialError } = await supabaseAdmin
      .from('social_posts')
      .select('id')
      .eq('user_id', agentId);
    
    if (socialError) {
      logger.warn('Error fetching social posts:', socialError);
    }

    // Calculate additional stats
    const stats = {
      total_properties: propertyStats.total,
      active_listings: propertyStats.byStatus?.active || propertyStats.byStatus?.for_sale || 0,
      total_value: propertyStats.totalValue,
      average_price: propertyStats.averagePrice,
      recent_listings: propertyStats.recentListings,
      social_posts: socialPosts?.length || 0,
      property_types: propertyStats.byType,
      listing_statuses: propertyStats.byStatus,
      // Mock data for features not yet implemented
      profile_views: Math.floor(Math.random() * 500) + 100,
      leads_generated: Math.floor(Math.random() * 50) + 10,
      conversion_rate: Math.random() * 5 + 1
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching profile stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile stats'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  getProfileStats
};