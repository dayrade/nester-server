const { supabaseAdmin } = require('../../config/supabaseClient');
const logger = require('../../utils/logger');
// Temporarily commented out to fix server startup
// const integrationService = require('../integration/integrationService');
const storageService = require('../storage/storageService');
const workflowService = require('../workflow/workflowService');

class PropertyService {
    constructor() {
        this.supabase = supabaseAdmin;
        // Temporarily commented out to fix server startup
        // this.integrationService = integrationService;
        this.storageService = storageService;
        this.workflowService = workflowService;
    }
    /**
     * Create a new property with enrichment
     * @param {Object} propertyData - Property data
     * @param {string} agentId - Agent ID
     * @param {Object} options - Creation options
     * @returns {Object} Created property
     */
    async createProperty(propertyData, agentId, options = {}) {
        try {
            logger.info('Creating new property', {
                agentId,
                address: propertyData.address,
                propertyType: propertyData.propertyType
            });

            // Prepare property data with minimal fields to avoid schema cache issues
            const enrichedData = {
                agent_id: agentId,
                address: propertyData.address,
                price: propertyData.price || null,
                bedrooms: propertyData.bedrooms || null,
                bathrooms: propertyData.bathrooms || null,
                description: propertyData.description || null
            };

            // Enrich with external data if enabled
            if (options.enrichWithExternalData !== false) {
                try {
                    const enrichmentData = await this.enrichPropertyData(enrichedData);
                    Object.assign(enrichedData, enrichmentData);
                } catch (error) {
                    logger.warn('Property enrichment failed, proceeding without external data', {
                        propertyId: enrichedData.id,
                        error: error.message
                    });
                }
            }

            // Insert property
            const { data, error } = await this.supabase
                .from('properties')
                .insert([enrichedData])
                .select('*')
                .single();

            if (error) {
                throw new Error(`Failed to create property: ${error.message}`);
            }

            // Trigger workflows if enabled
            if (options.triggerWorkflows !== false) {
                await this.triggerPropertyWorkflows(data.id, 'created');
            }

            logger.info('Property created successfully', {
                propertyId: data.id,
                agentId
            });

            return data;

        } catch (error) {
            logger.error('Failed to create property', {
                agentId,
                error: error.message,
                propertyData: this.sanitizePropertyData(propertyData)
            });
            throw error;
        }
    }
  
    /**
     * Get properties with advanced filtering, search, and pagination
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Query options
     * @param {string} agentId - Agent ID for access control
     * @returns {Object} Properties with pagination
     */
    async getProperties(filters = {}, options = {}, agentId = null) {
        try {
            const {
                page = 1,
                limit = 20,
                sortBy = 'created_at',
                sortOrder = 'desc',
                includeImages = true,
                includeSocialPosts = false,
                includeAnalytics = false
            } = options;

            const offset = (page - 1) * limit;

            // Build select clause
            let selectClause = '*';
            if (includeImages) {
                selectClause += `, property_images(
                    id,
                    storage_path,
                    alt_text,
                    display_order,
                    is_primary
                )`;
            }
            if (includeSocialPosts) {
                selectClause += `, social_posts(
                    id,
                    platform,
                    content,
                    status,
                    scheduled_for,
                    published_at
                )`;
            }

            let query = this.supabase
                .from('properties')
                .select(selectClause, { count: 'exact' });

            // Apply agent filter if provided
            if (agentId) {
                query = query.eq('agent_id', agentId);
            }

            // Apply filters
            query = this.applyPropertyFilters(query, filters);

            // Apply sorting
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });

            // Apply pagination
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) {
                throw new Error(`Failed to fetch properties: ${error.message}`);
            }

            // Add analytics if requested
            if (includeAnalytics && data) {
                for (const property of data) {
                    property.analytics = await this.getPropertyAnalytics(property.id);
                }
            }

            return {
                data,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit),
                    hasNext: offset + limit < count,
                    hasPrev: page > 1
                },
                filters: filters,
                sort: { sortBy, sortOrder }
            };

        } catch (error) {
            logger.error('Failed to fetch properties', {
                filters,
                options,
                agentId,
                error: error.message
            });
            throw error;
        }
    }
  
    /**
     * Get a property by ID with comprehensive data
     * @param {string} id - Property ID
     * @param {string} agentId - Agent ID for access control
     * @param {Object} options - Fetch options
     * @returns {Object} Property data
     */
    async getPropertyById(id, agentId = null, options = {}) {
        try {
            const {
                includeImages = true,
                includeSocialPosts = true,
                includeAnalytics = false,
                includeChatSessions = false,
                includeLeads = false
            } = options;

            // Build select clause
            let selectClause = '*';
            if (includeImages) {
                selectClause += `, property_images(
                    id,
                    storage_path,
                    alt_text,
                    display_order,
                    is_primary,
                    created_at
                )`;
            }
            if (includeSocialPosts) {
                selectClause += `, social_posts(
                    id,
                    platform,
                    content,
                    status,
                    scheduled_for,
                    published_at,
                    engagement_metrics
                )`;
            }
            if (includeChatSessions) {
                selectClause += `, chat_sessions(
                    id,
                    visitor_name,
                    visitor_email,
                    created_at,
                    status
                )`;
            }
            if (includeLeads) {
                selectClause += `, leads(
                    id,
                    name,
                    email,
                    phone,
                    message,
                    source,
                    status,
                    created_at
                )`;
            }

            let query = this.supabase
                .from('properties')
                .select(selectClause)
                .eq('id', id);

            // Apply agent filter if provided
            if (agentId) {
                query = query.eq('agent_id', agentId);
            }

            const { data, error } = await query.single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Property not found
                }
                throw new Error(`Failed to fetch property: ${error.message}`);
            }

            // Add analytics if requested
            if (includeAnalytics) {
                data.analytics = await this.getPropertyAnalytics(id);
            }

            // Add neighborhood data if available
            if (data.address) {
                try {
                    data.neighborhood = await this.getNeighborhoodData(data.address);
                } catch (error) {
                    logger.warn('Failed to fetch neighborhood data', {
                        propertyId: id,
                        error: error.message
                    });
                }
            }

            return data;

        } catch (error) {
            logger.error('Failed to fetch property by ID', {
                propertyId: id,
                agentId,
                error: error.message
            });
            throw error;
        }
    }
  
    /**
     * Update a property with validation and workflow triggers
     * @param {string} id - Property ID
     * @param {Object} updateData - Update data
     * @param {string} agentId - Agent ID for access control
     * @param {Object} options - Update options
     * @returns {Object} Updated property
     */
    async updateProperty(id, updateData, agentId, options = {}) {
        try {
            logger.info('Updating property', {
                propertyId: id,
                agentId,
                updateFields: Object.keys(updateData)
            });

            // Prepare update data
            const enrichedUpdateData = {
                ...updateData,
                updated_at: new Date().toISOString()
            };

            // Re-enrich if address changed
            if (updateData.address && options.enrichWithExternalData !== false) {
                try {
                    const enrichmentData = await this.enrichPropertyData({
                        ...updateData,
                        id
                    });
                    Object.assign(enrichedUpdateData, enrichmentData);
                } catch (error) {
                    logger.warn('Property enrichment failed during update', {
                        propertyId: id,
                        error: error.message
                    });
                }
            }

            const { data, error } = await this.supabase
                .from('properties')
                .update(enrichedUpdateData)
                .eq('id', id)
                .eq('agent_id', agentId)
                .select('*')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Property not found
                }
                throw new Error(`Failed to update property: ${error.message}`);
            }

            // Trigger workflows if enabled
            if (options.triggerWorkflows !== false) {
                await this.triggerPropertyWorkflows(id, 'updated', updateData);
            }

            logger.info('Property updated successfully', {
                propertyId: id,
                agentId
            });

            return data;

        } catch (error) {
            logger.error('Failed to update property', {
                propertyId: id,
                agentId,
                error: error.message,
                updateData: this.sanitizePropertyData(updateData)
            });
            throw error;
        }
    }
  
    /**
     * Delete a property and all associated data
     * @param {string} id - Property ID
     * @param {string} agentId - Agent ID for access control
     * @param {Object} options - Deletion options
     * @returns {Object} Deletion result
     */
    async deleteProperty(id, agentId, options = {}) {
        try {
            logger.info('Deleting property', {
                propertyId: id,
                agentId
            });

            // Get property data before deletion for cleanup
            const property = await this.getPropertyById(id, agentId, {
                includeImages: true,
                includeSocialPosts: true
            });

            if (!property) {
                return null; // Property not found
            }

            // Delete images from storage
            if (property.property_images && property.property_images.length > 0) {
                const imagePaths = property.property_images.map(img => img.storage_path);
                try {
                    await this.supabase.storage
                        .from('property-images')
                        .remove(imagePaths);
                } catch (error) {
                    logger.warn('Failed to delete some property images from storage', {
                        propertyId: id,
                        error: error.message
                    });
                }
            }

            // Cancel any scheduled social posts
            if (property.social_posts && property.social_posts.length > 0) {
                for (const post of property.social_posts) {
                    if (post.status === 'scheduled') {
                        try {
                            await this.workflowService.cancelWorkflow(post.workflow_id);
                        } catch (error) {
                            logger.warn('Failed to cancel scheduled social post', {
                                postId: post.id,
                                error: error.message
                            });
                        }
                    }
                }
            }

            // Delete the property (cascade deletes related records)
            const { error } = await this.supabase
                .from('properties')
                .delete()
                .eq('id', id)
                .eq('agent_id', agentId);

            if (error) {
                throw new Error(`Failed to delete property: ${error.message}`);
            }

            // Trigger cleanup workflows if enabled
            if (options.triggerWorkflows !== false) {
                await this.triggerPropertyWorkflows(id, 'deleted', property);
            }

            logger.info('Property deleted successfully', {
                propertyId: id,
                agentId
            });

            return { success: true, deletedProperty: property };

        } catch (error) {
            logger.error('Failed to delete property', {
                propertyId: id,
                agentId,
                error: error.message
            });
            throw error;
        }
    }
  
  /**
   * Get property images
   */
  async getPropertyImages(propertyId, agentId) {
    // First verify the property belongs to the agent
    const property = await this.getPropertyById(propertyId, agentId);
    if (!property) {
      throw new Error('Property not found or access denied');
    }
    
    const { data, error } = await supabase
      .from('property_images')
      .select('*')
      .eq('property_id', propertyId)
      .order('display_order', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch property images: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Add property image
   */
  async addPropertyImage(propertyId, imageData) {
    const { data, error } = await supabase
      .from('property_images')
      .insert([{ property_id: propertyId, ...imageData }])
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to add property image: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Delete property image
   */
  async deletePropertyImage(propertyId, imageId, agentId) {
    // First verify the property belongs to the agent
    const property = await this.getPropertyById(propertyId, agentId);
    if (!property) {
      throw new Error('Property not found or access denied');
    }
    
    // Get image details for storage cleanup
    const { data: image } = await supabase
      .from('property_images')
      .select('storage_path')
      .eq('id', imageId)
      .eq('property_id', propertyId)
      .single();
    
    if (image && image.storage_path) {
      // Delete from storage
      await supabase.storage
        .from('property-images')
        .remove([image.storage_path]);
    }
    
    const { data, error } = await supabase
      .from('property_images')
      .delete()
      .eq('id', imageId)
      .eq('property_id', propertyId)
      .select('*')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Image not found
      }
      throw new Error(`Failed to delete property image: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Update property scraping status
   */
  async updateScrapingStatus(propertyId, status, error = null) {
    const updateData = {
      scraping_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (error) {
      updateData.scraping_error = error;
    }
    
    const { data, error: updateError } = await this.supabase
      .from('properties')
      .update(updateData)
      .eq('id', propertyId)
      .select('*')
      .single();
    
    if (updateError) {
      throw new Error(`Failed to update scraping status: ${updateError.message}`);
    }
    
    return data;
  }
  
  /**
   * Update content generation status
   */
  async updateContentGenerationStatus(propertyId, status, jobId = null) {
    const updateData = {
      content_generation_status: status,
      updated_at: new Date().toISOString()
    };
    
    if (jobId) {
      updateData.content_generation_job_id = jobId;
    }
    
    if (status === 'started') {
      updateData.content_generation_started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updateData.content_generation_completed_at = new Date().toISOString();
    }
    
    const { data, error } = await this.supabase
      .from('properties')
      .update(updateData)
      .eq('id', propertyId)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to update content generation status: ${error.message}`);
    }
    
    return data;
  }
  
    /**
     * Get properties by status with enhanced filtering
     * @param {string} status - Property status
     * @param {string} agentId - Agent ID
     * @param {Object} options - Query options
     * @returns {Object} Properties with pagination
     */
    async getPropertiesByStatus(status, agentId, options = {}) {
        const filters = { listing_status: status };
        return this.getProperties(filters, options, agentId);
    }

    /**
     * Search properties with full-text search
     * @param {string} searchTerm - Search term
     * @param {Object} filters - Additional filters
     * @param {Object} options - Query options
     * @param {string} agentId - Agent ID
     * @returns {Object} Search results
     */
    async searchProperties(searchTerm, filters = {}, options = {}, agentId = null) {
        try {
            const {
                page = 1,
                limit = 20,
                sortBy = 'created_at',
                sortOrder = 'desc'
            } = options;

            const offset = (page - 1) * limit;

            let query = this.supabase
                .from('properties')
                .select('*, property_images(id, storage_path, is_primary)', { count: 'exact' });

            // Apply agent filter
            if (agentId) {
                query = query.eq('agent_id', agentId);
            }

            // Apply text search
            if (searchTerm) {
                query = query.or(`address.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%`);
            }

            // Apply additional filters
            query = this.applyPropertyFilters(query, filters);

            // Apply sorting and pagination
            query = query
                .order(sortBy, { ascending: sortOrder === 'asc' })
                .range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) {
                throw new Error(`Search failed: ${error.message}`);
            }

            return {
                data,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit),
                    hasNext: offset + limit < count,
                    hasPrev: page > 1
                },
                searchTerm,
                filters
            };

        } catch (error) {
            logger.error('Property search failed', {
                searchTerm,
                filters,
                agentId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Apply property filters to query
     * @param {Object} query - Supabase query
     * @param {Object} filters - Filter criteria
     * @returns {Object} Modified query
     */
    applyPropertyFilters(query, filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                switch (key) {
                    case 'priceMin':
                        query = query.gte('price', value);
                        break;
                    case 'priceMax':
                        query = query.lte('price', value);
                        break;
                    case 'bedroomsMin':
                        query = query.gte('bedrooms', value);
                        break;
                    case 'bathroomsMin':
                        query = query.gte('bathrooms', value);
                        break;
                    case 'propertyTypes':
                        if (Array.isArray(value) && value.length > 0) {
                            query = query.in('property_type', value);
                        }
                        break;
                    case 'listingStatuses':
                        if (Array.isArray(value) && value.length > 0) {
                            query = query.in('listing_status', value);
                        }
                        break;
                    case 'city':
                        query = query.ilike('city', `%${value}%`);
                        break;
                    case 'state':
                        query = query.eq('state', value);
                        break;
                    case 'zipCode':
                        query = query.eq('zip_code', value);
                        break;
                    case 'hasImages':
                        if (value) {
                            query = query.not('property_images', 'is', null);
                        }
                        break;
                    case 'createdAfter':
                        query = query.gte('created_at', value);
                        break;
                    case 'createdBefore':
                        query = query.lte('created_at', value);
                        break;
                    default:
                        // Direct field match
                        query = query.eq(key, value);
                }
            }
        });
        return query;
    }

    /**
     * Enrich property data with external APIs
     * @param {Object} propertyData - Property data
     * @returns {Object} Enrichment data
     */
    async enrichPropertyData(propertyData) {
        const enrichmentData = {};

        if (!propertyData.address) {
            return enrichmentData;
        }

        try {
            // Get Google Places data
            const placesData = await this.integrationService.getGooglePlacesData(propertyData.address);
            if (placesData) {
                enrichmentData.google_place_id = placesData.place_id;
                enrichmentData.formatted_address = placesData.formatted_address;
                enrichmentData.latitude = placesData.geometry?.location?.lat;
                enrichmentData.longitude = placesData.geometry?.location?.lng;
            }

            // Get Walk Score
            if (enrichmentData.latitude && enrichmentData.longitude) {
                const walkScore = await this.integrationService.getWalkScore(
                    enrichmentData.latitude,
                    enrichmentData.longitude,
                    propertyData.address
                );
                if (walkScore) {
                    enrichmentData.walk_score = walkScore.walkscore;
                    enrichmentData.walk_description = walkScore.description;
                }
            }

            // Get school data
            if (enrichmentData.latitude && enrichmentData.longitude) {
                const schoolData = await this.integrationService.getSchoolData(
                    enrichmentData.latitude,
                    enrichmentData.longitude
                );
                if (schoolData && schoolData.length > 0) {
                    enrichmentData.nearby_schools = schoolData;
                }
            }

            // Calculate mortgage estimates
            if (propertyData.price) {
                const mortgageData = await this.integrationService.calculateMortgagePayment(
                    propertyData.price
                );
                if (mortgageData) {
                    enrichmentData.estimated_monthly_payment = mortgageData.monthlyPayment;
                    enrichmentData.mortgage_rate = mortgageData.interestRate;
                }
            }

        } catch (error) {
            logger.warn('Property enrichment partially failed', {
                propertyId: propertyData.id,
                address: propertyData.address,
                error: error.message
            });
        }

        return enrichmentData;
    }

    /**
     * Get neighborhood data for a property
     * @param {string} address - Property address
     * @returns {Object} Neighborhood data
     */
    async getNeighborhoodData(address) {
        try {
            return await this.integrationService.getNeighborhoodData(address);
        } catch (error) {
            logger.warn('Failed to fetch neighborhood data', {
                address,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Get property analytics
     * @param {string} propertyId - Property ID
     * @returns {Object} Analytics data
     */
    async getPropertyAnalytics(propertyId) {
        try {
            // Get view counts, lead counts, social engagement, etc.
            const [viewsData, leadsData, socialData] = await Promise.all([
                this.getPropertyViews(propertyId),
                this.getPropertyLeads(propertyId),
                this.getPropertySocialEngagement(propertyId)
            ]);

            return {
                views: viewsData,
                leads: leadsData,
                social: socialData,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            logger.warn('Failed to fetch property analytics', {
                propertyId,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Get property view analytics
     * @param {string} propertyId - Property ID
     * @returns {Object} View analytics
     */
    async getPropertyViews(propertyId) {
        try {
            const { data, error } = await this.supabase
                .from('property_views')
                .select('*')
                .eq('property_id', propertyId);

            if (error) throw error;

            const totalViews = data.length;
            const uniqueViews = new Set(data.map(v => v.visitor_id)).size;
            const last30Days = data.filter(v => 
                new Date(v.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            ).length;

            return {
                total: totalViews,
                unique: uniqueViews,
                last30Days
            };
        } catch (error) {
            logger.warn('Failed to fetch property views', {
                propertyId,
                error: error.message
            });
            return { total: 0, unique: 0, last30Days: 0 };
        }
    }

    /**
     * Get property lead analytics
     * @param {string} propertyId - Property ID
     * @returns {Object} Lead analytics
     */
    async getPropertyLeads(propertyId) {
        try {
            const { data, error } = await this.supabase
                .from('leads')
                .select('*')
                .eq('property_id', propertyId);

            if (error) throw error;

            const totalLeads = data.length;
            const qualifiedLeads = data.filter(l => l.status === 'qualified').length;
            const last30Days = data.filter(l => 
                new Date(l.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            ).length;

            return {
                total: totalLeads,
                qualified: qualifiedLeads,
                last30Days,
                conversionRate: totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0
            };
        } catch (error) {
            logger.warn('Failed to fetch property leads', {
                propertyId,
                error: error.message
            });
            return { total: 0, qualified: 0, last30Days: 0, conversionRate: 0 };
        }
    }

    /**
     * Get property social engagement analytics
     * @param {string} propertyId - Property ID
     * @returns {Object} Social engagement analytics
     */
    async getPropertySocialEngagement(propertyId) {
        try {
            const { data, error } = await this.supabase
                .from('social_posts')
                .select('*')
                .eq('property_id', propertyId);

            if (error) throw error;

            const totalPosts = data.length;
            const publishedPosts = data.filter(p => p.status === 'published').length;
            const totalEngagement = data.reduce((sum, post) => {
                const metrics = post.engagement_metrics || {};
                return sum + (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0);
            }, 0);

            return {
                totalPosts,
                publishedPosts,
                totalEngagement,
                averageEngagement: publishedPosts > 0 ? totalEngagement / publishedPosts : 0
            };
        } catch (error) {
            logger.warn('Failed to fetch property social engagement', {
                propertyId,
                error: error.message
            });
            return { totalPosts: 0, publishedPosts: 0, totalEngagement: 0, averageEngagement: 0 };
        }
    }

    /**
     * Trigger property-related workflows
     * @param {string} propertyId - Property ID
     * @param {string} event - Event type
     * @param {Object} data - Event data
     */
    async triggerPropertyWorkflows(propertyId, event, data = {}) {
        try {
            // Get property data to extract agentId
            const { data: property, error: propertyError } = await this.supabase
                .from('properties')
                .select('agent_id')
                .eq('id', propertyId)
                .single();

            if (propertyError) {
                logger.warn('Failed to fetch property for workflow trigger', {
                    propertyId,
                    error: propertyError.message
                });
                return;
            }

            const workflows = {
                created: ['property-ingestion', 'content-generation'],
                updated: ['content-regeneration'],
                deleted: ['cleanup-workflows']
            };

            const workflowsToTrigger = workflows[event] || [];

            for (const workflowType of workflowsToTrigger) {
                try {
                    await this.workflowService.triggerWorkflow(workflowType, {
                        propertyId,
                        agentId: property.agent_id,
                        event,
                        ...data
                    });
                } catch (error) {
                    logger.warn(`Failed to trigger ${workflowType} workflow`, {
                        propertyId,
                        agentId: property.agent_id,
                        event,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to trigger property workflows', {
                propertyId,
                event,
                error: error.message
            });
        }
    }

    /**
     * Sanitize property data for logging
     * @param {Object} propertyData - Property data
     * @returns {Object} Sanitized data
     */
    sanitizePropertyData(propertyData) {
        const sanitized = { ...propertyData };
        // Remove sensitive fields if any
        delete sanitized.internal_notes;
        delete sanitized.private_remarks;
        return sanitized;
    }

    /**
     * Get property statistics for an agent
     * @param {string} agentId - Agent ID
     * @returns {Object} Property statistics
     */
    async getPropertyStatistics(agentId) {
        try {
            const { data, error } = await this.supabase
                .from('properties')
                .select('listing_status, property_type, price, created_at')
                .eq('agent_id', agentId);

            if (error) throw error;

            const stats = {
                total: data.length,
                byStatus: {},
                byType: {},
                averagePrice: 0,
                totalValue: 0,
                recentListings: 0
            };

            // Calculate statistics
            data.forEach(property => {
                // By status
                stats.byStatus[property.listing_status] = 
                    (stats.byStatus[property.listing_status] || 0) + 1;

                // By type
                stats.byType[property.property_type] = 
                    (stats.byType[property.property_type] || 0) + 1;

                // Price calculations
                if (property.price) {
                    stats.totalValue += property.price;
                }

                // Recent listings (last 30 days)
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                if (new Date(property.created_at) > thirtyDaysAgo) {
                    stats.recentListings++;
                }
            });

            stats.averagePrice = data.length > 0 ? stats.totalValue / data.length : 0;

            return stats;
        } catch (error) {
            logger.error('Failed to fetch property statistics', {
                agentId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Health check for property service
     * @returns {Object} Health status
     */
    async healthCheck() {
        try {
            // Test database connection
            const { data, error } = await this.supabase
                .from('properties')
                .select('count')
                .limit(1);

            if (error) throw error;

            // Test workflow service
            let workflowHealth = { status: 'healthy' };
            try {
                workflowHealth = await this.workflowService.healthCheck();
            } catch (workflowError) {
                workflowHealth = { status: 'unhealthy', error: workflowError.message };
            }

            return {
                status: 'healthy',
                database: 'connected',
                workflows: workflowHealth.status,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Property service health check failed', {
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

module.exports = new PropertyService();