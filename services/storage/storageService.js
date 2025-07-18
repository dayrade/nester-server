const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const config = require('../../config/config');
const logger = require('../../utils/logger');
const { ValidationService } = require('../validation/validationService');

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

class StorageService {
  constructor() {
    this.supabase = supabase;
    this.validationService = new ValidationService();
    
    // Structured bucket organization
    this.buckets = {
      PROPERTY_IMAGES: 'property-images',
      BRAND_ASSETS: 'brand-assets',
      GENERATED_CONTENT: 'generated-content',
      SOCIAL_MEDIA: 'social-media',
      DOCUMENTS: 'documents',
      TEMP: 'temp'
    };

    // File type configurations
    this.fileTypes = {
      images: {
        extensions: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
        maxSize: 10 * 1024 * 1024, // 10MB
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
      },
      documents: {
        extensions: ['.pdf', '.doc', '.docx'],
        maxSize: 50 * 1024 * 1024, // 50MB
        mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      },
      videos: {
        extensions: ['.mp4', '.mov', '.avi'],
        maxSize: 100 * 1024 * 1024, // 100MB
        mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo']
      }
    };

    // Image processing configurations
    this.imageConfigs = {
      thumbnail: { width: 300, height: 200, quality: 80 },
      medium: { width: 800, height: 600, quality: 85 },
      large: { width: 1920, height: 1080, quality: 90 },
      social: {
        square: { width: 1080, height: 1080, quality: 85 },
        story: { width: 1080, height: 1920, quality: 85 },
        landscape: { width: 1920, height: 1080, quality: 85 }
      }
    };
  }

  /**
   * Initialize storage buckets
   */
  async initializeBuckets() {
    try {
      logger.info('Initializing storage buckets');
      
      for (const [name, bucketId] of Object.entries(this.buckets)) {
        const { data, error } = await supabase.storage.getBucket(bucketId);
        
        if (error && error.message.includes('not found')) {
          // Create bucket if it doesn't exist
          const { error: createError } = await supabase.storage.createBucket(bucketId, {
            public: true,
            allowedMimeTypes: this.getAllowedMimeTypes(),
            fileSizeLimit: 100 * 1024 * 1024 // 100MB
          });
          
          if (createError) {
            logger.error('Failed to create bucket', {
              bucketId,
              error: createError.message
            });
          } else {
            logger.info('Created storage bucket', { bucketId });
          }
        }
      }
      
      logger.info('Storage buckets initialization completed');
    } catch (error) {
      logger.error('Error initializing buckets', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all allowed MIME types
   */
  getAllowedMimeTypes() {
    const allMimeTypes = [];
    Object.values(this.fileTypes).forEach(type => {
      allMimeTypes.push(...type.mimeTypes);
    });
    return allMimeTypes;
  }

  /**
   * Upload property image with automatic processing
   */
  async uploadPropertyImage(propertyId, agentId, imageFile, options = {}) {
    try {
      logger.info('Uploading property image', {
        propertyId,
        agentId,
        fileName: imageFile.originalname,
        fileSize: imageFile.size
      });
      
      // Validate file using validation service
      await this.validationService.validateFile(imageFile);
      this.validateFile(imageFile, 'images');

      const timestamp = Date.now();
      const fileExt = path.extname(imageFile.originalname).toLowerCase();
      const baseName = `${propertyId}-${timestamp}`;
      const folderPath = `properties/${agentId}/${propertyId}`;

      // Process and upload multiple sizes
      const uploadPromises = [];
      const imageVariants = {};

      // Original image
      const originalPath = `${folderPath}/original/${baseName}${fileExt}`;
      uploadPromises.push(
        this.uploadToStorage(this.buckets.PROPERTY_IMAGES, originalPath, imageFile.buffer, imageFile.mimetype)
      );
      imageVariants.original = originalPath;

      // Generate different sizes if it's a processable image
      if (this.isProcessableImage(imageFile.mimetype)) {
        // Thumbnail
        const thumbnailBuffer = await this.resizeImage(imageFile.buffer, this.imageConfigs.thumbnail);
        const thumbnailPath = `${folderPath}/thumbnails/${baseName}-thumb.webp`;
        uploadPromises.push(
          this.uploadToStorage(this.buckets.PROPERTY_IMAGES, thumbnailPath, thumbnailBuffer, 'image/webp')
        );
        imageVariants.thumbnail = thumbnailPath;

        // Medium size
        const mediumBuffer = await this.resizeImage(imageFile.buffer, this.imageConfigs.medium);
        const mediumPath = `${folderPath}/medium/${baseName}-medium.webp`;
        uploadPromises.push(
          this.uploadToStorage(this.buckets.PROPERTY_IMAGES, mediumPath, mediumBuffer, 'image/webp')
        );
        imageVariants.medium = mediumPath;

        // Large size
        const largeBuffer = await this.resizeImage(imageFile.buffer, this.imageConfigs.large);
        const largePath = `${folderPath}/large/${baseName}-large.webp`;
        uploadPromises.push(
          this.uploadToStorage(this.buckets.PROPERTY_IMAGES, largePath, largeBuffer, 'image/webp')
        );
        imageVariants.large = largePath;
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Store image record in database
      const imageRecord = {
        property_id: propertyId,
        agent_id: agentId,
        original_filename: imageFile.originalname,
        storage_path: imageVariants.original,
        thumbnail_path: imageVariants.thumbnail,
        medium_path: imageVariants.medium,
        large_path: imageVariants.large,
        file_size: imageFile.size,
        mime_type: imageFile.mimetype,
        is_primary: options.isPrimary || false,
        alt_text: options.altText || '',
        display_order: options.displayOrder || 0
      };

      const { data, error } = await supabase
        .from('property_images')
        .insert([imageRecord])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to save image record: ${error.message}`);
      }

      logger.info('Property image uploaded successfully', {
        propertyId,
        agentId,
        imageId: data.id,
        variants: Object.keys(imageVariants)
      });
      
      return {
        id: data.id,
        ...imageVariants,
        metadata: data
      };

    } catch (error) {
      logger.error('Error uploading property image', {
        propertyId,
        agentId,
        fileName: imageFile?.originalname,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upload brand logo
   */
  async uploadBrandLogo(agentId, logoFile) {
    try {
      logger.info('Uploading brand logo', {
        agentId,
        fileName: logoFile.originalname,
        fileSize: logoFile.size
      });
      
      await this.validationService.validateFile(logoFile);
      this.validateFile(logoFile, 'images');

      const timestamp = Date.now();
      const fileExt = path.extname(logoFile.originalname).toLowerCase();
      const fileName = `logos/${agentId}/logo-${timestamp}${fileExt}`;

      const { data, error } = await this.uploadToStorage(
        this.buckets.BRAND_ASSETS,
        fileName,
        logoFile.buffer,
        logoFile.mimetype
      );

      if (error) {
        throw error;
      }

      logger.info('Brand logo uploaded successfully', {
        agentId,
        path: data.path
      });
      
      return {
        path: data.path,
        publicUrl: this.getPublicUrl(this.buckets.BRAND_ASSETS, data.path)
      };

    } catch (error) {
      logger.error('Error uploading brand logo', {
        agentId,
        fileName: logoFile?.originalname,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upload generated content (PDFs, social media images, etc.)
   */
  async uploadGeneratedContent(agentId, propertyId, contentType, buffer, fileName, mimeType) {
    try {
      logger.info('Uploading generated content', {
        agentId,
        propertyId,
        contentType,
        fileName,
        mimeType,
        bufferSize: buffer.length
      });
      
      const folderPath = `${agentId}/${propertyId}/${contentType}`;
      const filePath = `${folderPath}/${fileName}`;

      const { data, error } = await this.uploadToStorage(
        this.buckets.GENERATED_CONTENT,
        filePath,
        buffer,
        mimeType
      );

      if (error) {
        throw error;
      }

      logger.info('Generated content uploaded successfully', {
        agentId,
        propertyId,
        contentType,
        path: data.path
      });
      
      return {
        path: data.path,
        publicUrl: this.getPublicUrl(this.buckets.GENERATED_CONTENT, data.path)
      };

    } catch (error) {
      logger.error('Error uploading generated content', {
        agentId,
        propertyId,
        contentType,
        fileName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upload social media content
   */
  async uploadSocialMediaContent(agentId, propertyId, platform, contentBuffer, fileName) {
    try {
      logger.info('Uploading social media content', {
        agentId,
        propertyId,
        platform,
        fileName,
        bufferSize: contentBuffer.length
      });
      
      const folderPath = `${agentId}/${propertyId}/${platform}`;
      const filePath = `${folderPath}/${fileName}`;

      const { data, error } = await this.uploadToStorage(
        this.buckets.SOCIAL_MEDIA,
        filePath,
        contentBuffer,
        'image/png'
      );

      if (error) {
        throw error;
      }

      logger.info('Social media content uploaded successfully', {
        agentId,
        propertyId,
        platform,
        path: data.path
      });
      
      return {
        path: data.path,
        publicUrl: this.getPublicUrl(this.buckets.SOCIAL_MEDIA, data.path)
      };

    } catch (error) {
      logger.error('Error uploading social media content', {
        agentId,
        propertyId,
        platform,
        fileName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Core upload function
   */
  async uploadToStorage(bucket, filePath, buffer, mimeType) {
    try {
      logger.debug('Uploading to storage', {
        bucket,
        filePath,
        mimeType,
        bufferSize: buffer.length
      });
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      logger.debug('Storage upload completed', {
        bucket,
        filePath,
        uploadPath: data.path
      });
      
      return data;

    } catch (error) {
      logger.error('Error in uploadToStorage', {
        bucket,
        filePath,
        mimeType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(bucket, filePath) {
    try {
      logger.info('Deleting file from storage', {
        bucket,
        filePath
      });
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        throw new Error(`Failed to delete file: ${error.message}`);
      }

      logger.info('File deleted successfully', {
        bucket,
        filePath
      });
      
      return true;

    } catch (error) {
      logger.error('Error deleting file', {
        bucket,
        filePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete property image and all variants
   */
  async deletePropertyImage(imageId) {
    try {
      logger.info('Deleting property image', { imageId });
      
      // Get image record
      const { data: image, error: fetchError } = await supabase
        .from('property_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch image record: ${fetchError.message}`);
      }

      // Delete all variants from storage
      const deletePromises = [];
      const pathsToDelete = [];
      
      if (image.storage_path) {
        deletePromises.push(this.deleteFile(this.buckets.PROPERTY_IMAGES, image.storage_path));
        pathsToDelete.push(image.storage_path);
      }
      if (image.thumbnail_path) {
        deletePromises.push(this.deleteFile(this.buckets.PROPERTY_IMAGES, image.thumbnail_path));
        pathsToDelete.push(image.thumbnail_path);
      }
      if (image.medium_path) {
        deletePromises.push(this.deleteFile(this.buckets.PROPERTY_IMAGES, image.medium_path));
        pathsToDelete.push(image.medium_path);
      }
      if (image.large_path) {
        deletePromises.push(this.deleteFile(this.buckets.PROPERTY_IMAGES, image.large_path));
        pathsToDelete.push(image.large_path);
      }

      await Promise.all(deletePromises);

      // Delete database record
      const { error: deleteError } = await supabase
        .from('property_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) {
        throw new Error(`Failed to delete image record: ${deleteError.message}`);
      }

      logger.info('Property image deleted successfully', {
        imageId,
        deletedPaths: pathsToDelete
      });
      
      return true;

    } catch (error) {
      logger.error('Error deleting property image', {
        imageId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(bucket, filePath) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Generate signed URL for private access
   */
  async getSignedUrl(bucket, filePath, expiresIn = 3600) {
    try {
      logger.debug('Generating signed URL', {
        bucket,
        filePath,
        expiresIn
      });
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw new Error(`Failed to generate signed URL: ${error.message}`);
      }

      logger.debug('Signed URL generated successfully', {
        bucket,
        filePath
      });
      
      return data.signedUrl;

    } catch (error) {
      logger.error('Error generating signed URL', {
        bucket,
        filePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resize image using Sharp
   */
  async resizeImage(buffer, config) {
    try {
      logger.debug('Resizing image', {
        width: config.width,
        height: config.height,
        quality: config.quality,
        inputSize: buffer.length
      });
      
      const resizedBuffer = await sharp(buffer)
        .resize(config.width, config.height, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: config.quality })
        .toBuffer();
        
      logger.debug('Image resized successfully', {
        originalSize: buffer.length,
        resizedSize: resizedBuffer.length,
        compressionRatio: (buffer.length / resizedBuffer.length).toFixed(2)
      });
      
      return resizedBuffer;

    } catch (error) {
      logger.error('Error resizing image', {
        width: config.width,
        height: config.height,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate social media image variants
   */
  async generateSocialVariants(imageBuffer, baseName, agentId, propertyId) {
    try {
      logger.info('Generating social media variants', {
        baseName,
        agentId,
        propertyId,
        formats: Object.keys(this.imageConfigs.social)
      });
      
      const variants = {};
      const uploadPromises = [];

      for (const [format, config] of Object.entries(this.imageConfigs.social)) {
        const resizedBuffer = await this.resizeImage(imageBuffer, config);
        const fileName = `${baseName}-${format}.webp`;
        const filePath = `${agentId}/${propertyId}/social/${fileName}`;

        uploadPromises.push(
          this.uploadToStorage(this.buckets.SOCIAL_MEDIA, filePath, resizedBuffer, 'image/webp')
            .then(data => {
              variants[format] = {
                path: data.path,
                publicUrl: this.getPublicUrl(this.buckets.SOCIAL_MEDIA, data.path)
              };
            })
        );
      }

      await Promise.all(uploadPromises);
      
      logger.info('Social media variants generated successfully', {
        baseName,
        agentId,
        propertyId,
        variantCount: Object.keys(variants).length
      });
      
      return variants;

    } catch (error) {
      logger.error('Error generating social variants', {
        baseName,
        agentId,
        propertyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file, type) {
    const config = this.fileTypes[type];
    if (!config) {
      throw new Error(`Invalid file type: ${type}`);
    }

    // Check file size
    if (file.size > config.maxSize) {
      throw new Error(`File size exceeds limit of ${config.maxSize / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!config.mimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid MIME type: ${file.mimetype}`);
    }

    // Check file extension
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (!config.extensions.includes(fileExt)) {
      throw new Error(`Invalid file extension: ${fileExt}`);
    }

    return true;
  }

  /**
   * Check if image can be processed
   */
  isProcessableImage(mimeType) {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(olderThanHours = 24) {
    try {
      logger.info('Starting temp files cleanup', {
        olderThanHours
      });
      
      const { data: files, error } = await supabase.storage
        .from(this.buckets.TEMP)
        .list();

      if (error) {
        throw new Error(`Failed to list temp files: ${error.message}`);
      }

      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
      const filesToDelete = files.filter(file => 
        new Date(file.created_at) < cutoffTime
      ).map(file => file.name);

      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(this.buckets.TEMP)
          .remove(filesToDelete);

        if (deleteError) {
          throw new Error(`Failed to delete temp files: ${deleteError.message}`);
        }

        logger.info('Temp files cleanup completed', {
          deletedCount: filesToDelete.length,
          olderThanHours
        });
      } else {
        logger.info('No temp files to clean up', { olderThanHours });
      }

      return {
        deletedCount: filesToDelete.length,
        deletedFiles: filesToDelete
      };

    } catch (error) {
      logger.error('Error cleaning up temp files', {
        olderThanHours,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(agentId) {
    try {
      logger.info('Getting storage statistics', { agentId });
      
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byBucket: {}
      };

      for (const [name, bucketId] of Object.entries(this.buckets)) {
        const { data: files, error } = await supabase.storage
          .from(bucketId)
          .list(`${agentId}/`, {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' }
          });

        if (!error && files) {
          const bucketStats = {
            fileCount: files.length,
            totalSize: files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)
          };

          stats.byBucket[name] = bucketStats;
          stats.totalFiles += bucketStats.fileCount;
          stats.totalSize += bucketStats.totalSize;
        } else if (error) {
          logger.warn('Failed to get stats for bucket', {
            bucketId,
            agentId,
            error: error.message
          });
        }
      }

      logger.info('Storage statistics retrieved', {
        agentId,
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize
      });
      
      return stats;

    } catch (error) {
      logger.error('Error getting storage stats', {
        agentId,
        error: error.message
      });
      throw error;
    }
  }
  /**
   * Upload multiple files with progress tracking
   * @param {Array} files - Array of file objects
   * @param {string} bucket - Storage bucket
   * @param {Object} options - Upload options
   * @returns {Object} Upload results
   */
  async uploadMultipleFiles(files, bucket = 'TEMP', options = {}) {
    try {
      logger.info('Uploading multiple files', {
        fileCount: files.length,
        bucket
      });
      
      const results = {
        successful: [],
        failed: [],
        total: files.length
      };
      
      const uploadPromises = files.map(async (file, index) => {
        try {
          const fileName = this.generateUniqueFileName(file.originalname);
          const filePath = options.folder ? `${options.folder}/${fileName}` : fileName;
          
          const uploadResult = await this.uploadToStorage(
            this.buckets[bucket] || bucket,
            filePath,
            file.buffer,
            file.mimetype
          );
          
          results.successful.push({
            index,
            originalName: file.originalname,
            fileName,
            path: uploadResult.path,
            publicUrl: this.getPublicUrl(this.buckets[bucket] || bucket, uploadResult.path)
          });
        } catch (error) {
          results.failed.push({
            index,
            originalName: file.originalname,
            error: error.message
          });
        }
      });
      
      await Promise.allSettled(uploadPromises);
      
      logger.info('Multiple file upload completed', {
        successful: results.successful.length,
        failed: results.failed.length,
        total: results.total
      });
      
      return results;
      
    } catch (error) {
      logger.error('Error uploading multiple files', {
        fileCount: files?.length,
        bucket,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Generate unique filename with timestamp and random string
   * @param {string} originalName - Original filename
   * @returns {string} Unique filename
   */
  generateUniqueFileName(originalName) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    
    return `${baseName}_${timestamp}_${random}${extension}`;
  }
  
  /**
   * List files in a bucket with pagination
   * @param {string} bucket - Bucket name
   * @param {string} folder - Folder path
   * @param {Object} options - List options
   * @returns {Array} File list
   */
  async listFiles(bucket, folder = '', options = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        sortBy = { column: 'created_at', order: 'desc' }
      } = options;
      
      logger.debug('Listing files', {
        bucket,
        folder,
        limit,
        offset
      });
      
      const { data: files, error } = await supabase.storage
        .from(bucket)
        .list(folder, {
          limit,
          offset,
          sortBy
        });
        
      if (error) {
        throw new Error(`Failed to list files: ${error.message}`);
      }
      
      // Add public URLs
      const filesWithUrls = files.map(file => {
        const filePath = folder ? `${folder}/${file.name}` : file.name;
        return {
          ...file,
          publicUrl: this.getPublicUrl(bucket, filePath),
          path: filePath
        };
      });
      
      logger.debug('Files listed successfully', {
        bucket,
        folder,
        fileCount: filesWithUrls.length
      });
      
      return filesWithUrls;
      
    } catch (error) {
      logger.error('Error listing files', {
        bucket,
        folder,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Health check for storage service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      // Test storage connection by listing files in temp bucket
      await this.listFiles(this.buckets.TEMP, '', { limit: 1 });
      
      return {
        status: 'healthy',
        storage: 'connected',
        buckets: Object.values(this.buckets),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Storage service health check failed', {
        error: error.message
      });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new StorageService();