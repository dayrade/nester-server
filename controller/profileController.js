const express = require('express');

// Simple profile controller without Supabase dependency for testing
const getProfile = async (req, res) => {
  try {
    // Mock profile data for testing
    const mockProfile = {
      id: 'test-user-id',
      email: 'test@example.com',
      full_name: 'Test User',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: mockProfile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { full_name, avatar_url } = req.body;

    // Mock update response
    const updatedProfile = {
      id: 'test-user-id',
      email: 'test@example.com',
      full_name: full_name || 'Test User',
      avatar_url: avatar_url || null,
      updated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    // Mock avatar upload response
    const avatarUrl = 'https://example.com/avatar.jpg';

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
    // Mock stats data
    const stats = {
      total_properties: 5,
      active_campaigns: 3,
      total_views: 1250,
      total_leads: 45,
      conversion_rate: 3.6
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching profile stats:', error);
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