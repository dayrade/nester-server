const express = require('express');
const router = express.Router();
const {
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
} = require('../controller/propertyController');
const verifyAuth = require('../middlewares/authMiddleware');
// Simplified for testing - removed validation and upload middleware

// All property routes require authentication
router.use(verifyAuth);

// Property CRUD operations
router.post('/', validateProperty, createProperty);
router.get('/', getProperties);
router.get('/:id', getPropertyById);
router.put('/:id', validatePropertyUpdate, updateProperty);
router.delete('/:id', deleteProperty);

// Property data ingestion
router.post('/scrape', scrapePropertyFromUrl);

// AI content generation
router.post('/:id/generate-content', generatePropertyContent);

// Property image management
router.get('/:id/images', getPropertyImages);
router.post('/:id/images', upload.array('images', 10), uploadPropertyImage);
router.delete('/:id/images/:imageId', deletePropertyImage);

module.exports = router;