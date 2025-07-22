const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
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
} = require('../controller/propertyController');
const verifyAuth = require('../middlewares/authMiddleware');

// Configure multer for single file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file upload
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Configure multer for multiple file uploads
const uploadMultiple = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});
// Simplified for testing - removed validation and upload middleware

// Apply authentication middleware to all routes
router.use(verifyAuth);

// Property CRUD operations
router.post('/', createProperty); // Removed validateProperty middleware temporarily
router.post('/create-with-images', uploadMultiple.array('images', 10), createPropertyWithImages); // New endpoint for property + images
router.get('/', getProperties);
router.get('/:id', getPropertyById);
router.put('/:id', updateProperty); // Removed validatePropertyUpdate middleware temporarily
router.delete('/:id', deleteProperty);

// Property data ingestion
router.post('/scrape', scrapePropertyFromUrl);

// AI content generation
router.post('/:id/generate-content', generatePropertyContent);

// Property image management
router.get('/:id/images', getPropertyImages);
router.post('/:id/images', upload.single('image'), uploadPropertyImage);
router.patch('/images/:imageId', updatePropertyImage);
router.delete('/:id/images/:imageId', deletePropertyImage);
router.delete('/images/:imageId', deletePropertyImage); // Alternative route for frontend compatibility

module.exports = router;