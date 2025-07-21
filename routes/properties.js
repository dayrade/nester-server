const express = require('express');
const multer = require('multer');
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

// Configure multer for file uploads
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
// Simplified for testing - removed validation and upload middleware

// All property routes require authentication
router.use(verifyAuth);

// Property CRUD operations
router.post('/', createProperty); // Removed validateProperty middleware temporarily
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
router.delete('/:id/images/:imageId', deletePropertyImage);

module.exports = router;