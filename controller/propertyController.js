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
 * Delete property image
 */
const deletePropertyImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const agentId = req.user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const property = await propertyService.getPropertyById(id, agentId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
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