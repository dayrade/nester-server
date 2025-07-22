const propertyService = require('../services/property/propertyService');
const storageService = require('../services/storage/storageService');
const logger = require('../utils/logger');
const errorHelper = require('../../error-helper');

/**
 * Create a new property with images in a single transaction
 */
const createPropertyWithImages = async (req, res) => {
  try {
    // Log API hit for debugging
    logger.info('Create property with images API hit', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      filesCount: req.files ? req.files.length : 0
    });
    
    let agentId = req.user?.id;
    console.log('agentId', agentId);
    
    // For testing purposes, allow manual agent_id or create a test user
    if (!agentId) {
      if (req.body.test_mode || process.env.NODE_ENV === 'development') {
        const { v4: uuidv4 } = require('uuid');
        agentId = uuidv4();
        logger.info('Created test agent_id for development', { agentId });
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }
    }
    
    // Parse property data from form data
    const propertyData = {
      title: req.body.title,
      address: req.body.address,
      price: req.body.price ? parseFloat(req.body.price) : null,
      bedrooms: req.body.bedrooms ? parseInt(req.body.bedrooms) : null,
      bathrooms: req.body.bathrooms ? parseFloat(req.body.bathrooms) : null,
      square_feet: req.body.square_feet ? parseInt(req.body.square_feet) : null,
      property_type: req.body.property_type,
      listing_type: req.body.listing_type,
      description: req.body.description,
      features: req.body.features ? JSON.parse(req.body.features) : [],
      location: req.body.location ? JSON.parse(req.body.location) : null,
      contact_info: req.body.contact_info ? JSON.parse(req.body.contact_info) : null
    };
    
    if (!propertyData.address && !propertyData.title) {
      return res.status(400).json({ error: 'Property address or title is required' });
    }

    // Use title as address if address is not provided
    if (!propertyData.address && propertyData.title) {
      propertyData.address = propertyData.title;
    }

    // Step 1: Insert property details
    const property = await propertyService.createProperty(propertyData, agentId);
    logger.info('Property created successfully', { propertyId: property.id });
    
    // Step 2: Upload images to Supabase and insert into property_images table
    const uploadedImages = [];
    
    if (req.files && req.files.length > 0) {
      logger.info(`Processing ${req.files.length} images for property ${property.id}`);
      
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        try {
          // Parse image options from form data
          const imageOptions = {
            isPrimary: i === 0, // First image is primary by default
            altText: req.body[`image_${i}_alt`] || `${property.title} - Image ${i + 1}`,
            displayOrder: i,
            roomType: req.body[`image_${i}_room_type`] || null
          };
          
          // Upload image to Supabase storage and insert metadata
          const uploadResult = await storageService.uploadPropertyImage(
            property.id, 
            agentId, 
            file, 
            imageOptions
          );
          
          uploadedImages.push(uploadResult);
          logger.info(`Image ${i + 1} uploaded successfully`, { 
            propertyId: property.id,
            imageId: uploadResult.id,
            storagePath: uploadResult.storage_path
          });
        } catch (imageError) {
          logger.error(`Failed to upload image ${i + 1} for property ${property.id}:`, imageError);
          // Continue with other images even if one fails
        }
      }
    }
    
    // Step 3: Get complete property data with uploaded images
    const completeProperty = await propertyService.getPropertyById(property.id, agentId, {
      includeImages: true,
      includeSocialPosts: false
    });
    
    // Step 4: Automatically trigger content generation
    try {
      const aiService = require('../services/ai/aiService');
      const contentTypes = ['description', 'social_posts'];
      
      if (completeProperty) {
        aiService.generatePropertyContent(completeProperty, contentTypes)
          .then(contentJob => {
            logger.info('Content generation started for new property', {
              propertyId: property.id,
              jobId: contentJob.id,
              contentTypes
            });
          })
          .catch(error => {
            logger.warn('Failed to start content generation', {
              propertyId: property.id,
              error: error.message
            });
          });
      }
    } catch (error) {
      logger.warn('Content generation setup failed', {
        propertyId: property.id,
        error: error.message
      });
    }
    
    // Step 5: Send response with property and images
    res.status(201).json({
      success: true,
      data: {
        property: completeProperty,
        uploadedImages: uploadedImages,
        imageCount: uploadedImages.length
      },
      message: `Property created successfully with ${uploadedImages.length} images uploaded.`
    });
    
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: '/api/properties/create-with-images',
      operation: 'create_property_with_images',
      agentId: req.user?.id || 'test-agent-123'
    });
    logger.error(`Error creating property with images [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      errorId
    });
  }
};

/**
 * Create a new property (original endpoint for backward compatibility)
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
    
    let agentId = req.user?.id;
    console.log('agentId',agentId)
    
    // For testing purposes, allow manual agent_id or create a test user
    if (!agentId) {
      // Check if this is a test request
      if (req.body.test_mode || process.env.NODE_ENV === 'development') {
        // Generate a valid UUID for testing
        const { v4: uuidv4 } = require('uuid');
        agentId = uuidv4();
        logger.info('Created test agent_id for development', { agentId });
      } else {
        return res.status(401).json({ error: 'Authentication required' });
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
    
    // Automatically trigger content generation for new properties
    try {
      const aiService = require('../services/ai/aiService');
      const contentTypes = ['description', 'social_posts'];
      
      // Get the full property data with images for content generation
      const fullProperty = await propertyService.getPropertyById(property.id, agentId, {
        includeImages: true,
        includeSocialPosts: false
      });
      
      if (fullProperty) {
        // Start content generation asynchronously (don't wait for completion)
        aiService.generatePropertyContent(fullProperty, contentTypes)
          .then(contentJob => {
            logger.info('Content generation started for new property', {
              propertyId: property.id,
              jobId: contentJob.id,
              contentTypes
            });
          })
          .catch(error => {
            logger.warn('Failed to start content generation for new property', {
              propertyId: property.id,
              error: error.message
            });
          });
      }
    } catch (error) {
      // Don't fail property creation if content generation fails
      logger.warn('Content generation setup failed for new property', {
        propertyId: property.id,
        error: error.message
      });
    }
    
    res.status(201).json({
      success: true,
      data: property,
      message: 'Property created successfully. Content generation started automatically.'
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
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { contentTypes = ['description', 'images', 'social_posts'] } = req.body;
    
    // Get property data
    const property = await propertyService.getPropertyById(id, agentId, {
      includeImages: true,
      includeSocialPosts: false
    });
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Import AI service
    const aiService = require('../services/ai/aiService');
    
    // Generate content using AI service
    const contentJob = await aiService.generatePropertyContent(property, contentTypes);
    
    res.json({
      success: true,
      data: {
        propertyId: id,
        jobId: contentJob.id,
        status: contentJob.status,
        contentTypes: contentJob.contentTypes
      },
      message: 'Content generation started successfully'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/${req.params.id}/generate-content`,
      operation: 'generate_property_content',
      propertyId: req.params.id,
      agentId: req.user?.id
    });
    logger.error(`Error generating property content [${errorId}]:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
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
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
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
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const property = await propertyService.getPropertyById(id, agentId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    const options = {
      isPrimary: req.body.isPrimary === 'true',
      altText: req.body.altText || '',
      displayOrder: parseInt(req.body.displayOrder) || 0,
      roomType: req.body.roomType || null
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
 * Update property image metadata
 */
const updatePropertyImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { altText, isPrimary, displayOrder, roomType } = req.body;
    
    const updated = await propertyService.updatePropertyImage(imageId, {
      altText,
      isPrimary,
      displayOrder,
      roomType
    });
    
    if (!updated) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({
      success: true,
      data: updated,
      message: 'Image metadata updated successfully'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: `/api/properties/images/${req.params.imageId}`,
      operation: 'update_property_image',
      imageId: req.params.imageId,
      agentId: req.user?.id || 'test-agent-123'
    });
    logger.error(`Error updating property image [${errorId}]:`, error);
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
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Handle both routes: /properties/:id/images/:imageId and /properties/images/:imageId
    const actualImageId = imageId || id; // If only one param, it's the imageId
    
    // If we have both id and imageId, verify property ownership
    if (id && imageId) {
      const property = await propertyService.getPropertyById(id, agentId);
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
    }
    
    const deleted = await propertyService.deletePropertyImage(actualImageId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    const errorId = errorHelper.trackRequest(error, req, {
      endpoint: req.originalUrl,
      operation: 'delete_property_image',
      propertyId: req.params.id,
      imageId: req.params.imageId || req.params.id,
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
  createPropertyWithImages,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  scrapePropertyFromUrl,
  generatePropertyContent,
  getPropertyImages,
  uploadPropertyImage,
  updatePropertyImage,
  deletePropertyImage
};