const propertyService = require('../services/property/propertyService');
const storageService = require('../services/storage/storageService');
const logger = require('../utils/logger');
const errorHelper = require('../../error-helper');

/**
 * Create a new property
 */
const createProperty = async (req, res) => {
  try {
    // Log API hit for debugging
    logger.info('Add property API hit - createProperty called', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      body: req.body
    });
    
    // Temporarily disable auth requirement for testing
    // Create or use a test user ID that exists in the database
    let agentId = req.user?.id;
    if (!agentId) {
      // Try to create a test user if it doesn't exist
      const testUserId = '11111111-1111-1111-1111-111111111111';
      try {
        const { supabaseAdmin } = require('../config/supabaseClient');
        
        logger.info('Attempting to create/find test user', { testUserId });
        
        // Check if test user exists in auth.users
        const { data: authUser, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(testUserId);
        
        if (authCheckError && authCheckError.message !== 'User not found') {
          logger.error('Error checking auth user:', authCheckError);
          throw authCheckError;
        }
        
        if (!authUser.user) {
          logger.info('Test user not found in auth, creating new one');
          // Create user in auth.users first
          const { data: newAuthUser, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
            user_id: testUserId,
            email: 'test@example.com',
            password: 'test123456',
            email_confirm: true
          });
          
          if (authCreateError) {
            // If user already exists with this email, try to find them
            if (authCreateError.message.includes('already been registered')) {
              logger.info('User with email already exists, trying to find existing user');
              const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
              if (listError) {
                logger.error('Error listing users:', listError);
                throw listError;
              }
              
              const existingUser = existingUsers.users.find(u => u.email === 'test@example.com');
               if (existingUser) {
                  logger.info('Found existing user with test email', { userId: existingUser.id });
                  // Use the actual existing user ID, not the hardcoded test ID
                  agentId = existingUser.id;
                 
                 // Ensure the public.users record exists
                 const { data: publicUser, error: publicCheckError } = await supabaseAdmin
                   .from('users')
                   .select('id')
                   .eq('id', existingUser.id)
                   .single();
                 
                 if (publicCheckError && publicCheckError.code === 'PGRST116') {
                   logger.info('Public user record not found, creating it');
                   const { error: publicInsertError } = await supabaseAdmin
                     .from('users')
                     .insert({
                       id: existingUser.id,
                       email: existingUser.email,
                       role: 'agent'
                     });
                   
                   if (publicInsertError) {
                     logger.error('Error creating public user record:', publicInsertError);
                     throw publicInsertError;
                   }
                   
                   logger.info('Public user record created successfully');
                 } else if (publicCheckError) {
                   logger.error('Error checking public user:', publicCheckError);
                   throw publicCheckError;
                 } else {
                   logger.info('Public user record already exists');
                 }
               } else {
                 throw new Error('Could not find existing user with test email');
               }
            } else {
              logger.error('Error creating auth user:', authCreateError);
              throw authCreateError;
            }
          } else {
            logger.info('Test auth user created successfully', { userId: newAuthUser.user.id });
            
            // The trigger should automatically create the public.users record
            // Wait a moment for the trigger to execute
            await new Promise(resolve => setTimeout(resolve, 1000));
            agentId = testUserId;
          }
        } else {
          logger.info('Test user already exists in auth');
          agentId = testUserId;
        }
      } catch (error) {
        logger.error('Failed to create/find test user:', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: `Failed to create test user: ${error.message}` });
      }
    }
    
    const propertyData = req.body;
    if (!propertyData.address && !propertyData.title) {
      return res.status(400).json({ error: 'Property address or title is required' });
    }

    // Use title as address if address is not provided
    if (!propertyData.address && propertyData.title) {
      propertyData.address = propertyData.title;
    }

    const property = await propertyService.createProperty(propertyData, agentId);
    
    res.status(201).json({
      success: true,
      data: property,
      message: 'Property created successfully'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: '/api/properties',
      operation: 'create_property',
      agentId: req.user?.id || 'test-agent-123'
    });
    logger.error(`Error creating property [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

/**
 * Get all properties for the authenticated agent
 */
const getProperties = async (req, res) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { page = 1, limit = 10, sortBy, sortOrder, includeImages, includeSocialPosts } = req.query;
    
    const filters = {};
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: sortBy || 'created_at',
      sortOrder: sortOrder || 'desc',
      includeImages: includeImages !== 'false',
      includeSocialPosts: includeSocialPosts === 'true'
    };

    const result = await propertyService.getProperties(filters, options, agentId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: '/api/properties',
      operation: 'get_properties',
      agentId: req.user?.id || 'test-agent-123'
    });
    logger.error(`Error fetching properties [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

/**
 * Get a specific property by ID
 */
const getPropertyById = async (req, res) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { includeImages, includeSocialPosts, includeAnalytics } = req.query;
    
    const options = {
      includeImages: includeImages !== 'false',
      includeSocialPosts: includeSocialPosts !== 'false',
      includeAnalytics: includeAnalytics === 'true'
    };

    const property = await propertyService.getPropertyById(id, agentId, options);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/${req.params.id}`,
      operation: 'get_property_by_id',
      propertyId: req.params.id,
      agentId: req.user?.id || 'test-agent-123'
    });
    logger.error(`Error fetching property [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

/**
 * Update a property
 */
const updateProperty = async (req, res) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const updateData = req.body;
    
    const updatedProperty = await propertyService.updateProperty(id, updateData, agentId);
    
    if (!updatedProperty) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    res.json({
      success: true,
      data: updatedProperty,
      message: 'Property updated successfully'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/${req.params.id}`,
      operation: 'update_property',
      propertyId: req.params.id,
      agentId: req.user?.id
    });
    logger.error(`Error updating property [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

/**
 * Delete a property
 */
const deleteProperty = async (req, res) => {
  try {
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    
    const deleted = await propertyService.deleteProperty(id, agentId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/${req.params.id}`,
      operation: 'delete_property',
      propertyId: req.params.id,
      agentId: req.user?.id
    });
    logger.error(`Error deleting property [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

/**
 * Scrape property data from URL
 */
const scrapePropertyFromUrl = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL is required'
      });
    }
    
    res.json({
      success: true,
      data: {
        jobId: 'mock-job-123',
        status: 'processing',
        message: 'Property scraping started (mock)'
      }
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: '/api/properties/scrape',
      operation: 'scrape_property_from_url',
      url: req.body.url
    });
    console.error(`Error starting property scraping [${errorId}]:`, error);
    res.status(500).json({ 
      error: 'Internal server error',
      errorId
    });
  }
};

/**
 * Generate AI content for property
 */
const generatePropertyContent = async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({
      success: true,
      data: {
        propertyId: id,
        generatedContent: {
          description: 'Beautiful property with modern amenities...',
          marketingCopy: 'Don\'t miss this opportunity...',
          socialMediaPosts: [
            'Check out this amazing property! #RealEstate',
            'New listing alert! Beautiful home available now.'
          ]
        },
        status: 'completed'
      },
      message: 'Content generated successfully (mock)'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/${req.params.id}/generate-content`,
      operation: 'generate_property_content',
      propertyId: req.params.id
    });
    console.error(`Error generating property content [${errorId}]:`, error);
    res.status(500).json({ 
      error: 'Internal server error',
      errorId
    });
  }
};

/**
 * Get property images
 */
const getPropertyImages = async (req, res) => {
  try {
    const { id } = req.params;
    // Temporarily bypass authentication for testing
    const agentId = req.user?.id || 'test-agent-123';
    
    // Temporarily disabled for testing
    // if (!agentId) {
    //   return res.status(401).json({ error: 'Authentication required' });
    // }
    
    const images = await storageService.getPropertyImages(id, agentId);
    
    res.json({
      success: true,
      data: images
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/${req.params.id}/images`,
      operation: 'get_property_images',
      propertyId: req.params.id,
      agentId: req.user?.id || 'test-agent-123'
    });
    logger.error(`Error fetching property images [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

/**
 * Upload property image
 */
const uploadPropertyImage = async (req, res) => {
  try {
    const { id } = req.params;
    // Temporarily bypass authentication for testing
    const agentId = req.user?.id || 'test-agent-123';
    
    // Temporarily disabled for testing
    // if (!agentId) {
    //   return res.status(401).json({ error: 'Authentication required' });
    // }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Temporarily bypass property verification for testing
    // const property = await propertyService.getPropertyById(id, agentId);
    // if (!property) {
    //   return res.status(404).json({ error: 'Property not found' });
    // }
    
    const options = {
      isPrimary: req.body.isPrimary === 'true',
      altText: req.body.altText || '',
      displayOrder: parseInt(req.body.displayOrder) || 0
    };
    
    const uploadResult = await storageService.uploadPropertyImage(id, agentId, req.file, options);
    
    res.json({
      success: true,
      data: uploadResult,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/${req.params.id}/images`,
      operation: 'upload_property_image',
      propertyId: req.params.id,
      agentId: req.user?.id || 'test-agent-123',
      fileName: req.file?.originalname,
      fileSize: req.file?.size
    });
    logger.error(`Error uploading property image [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

/**
 * Delete property image
 */
const deletePropertyImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    // Temporarily bypass authentication for testing
    const agentId = req.user?.id || 'test-agent-123';
    
    // Temporarily disabled for testing
    // if (!agentId) {
    //   return res.status(401).json({ error: 'Authentication required' });
    // }
    
    // Temporarily bypass property verification for testing
    // const property = await propertyService.getPropertyById(id, agentId);
    // if (!property) {
    //   return res.status(404).json({ error: 'Property not found' });
    // }
    
    const deleted = await storageService.deletePropertyImage(imageId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/${req.params.id}/images/${req.params.imageId}`,
      operation: 'delete_property_image',
      propertyId: req.params.id,
      imageId: req.params.imageId,
      agentId: req.user?.id || 'test-agent-123'
    });
    logger.error(`Error deleting property image [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

module.exports = {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  scrapePropertyFromUrl,
  generatePropertyContent,
  getPropertyImages,
  uploadPropertyImage,
  deletePropertyImage
};