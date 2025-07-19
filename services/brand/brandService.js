const config = require('../../config/config');
const logger = require('../../utils/logger');
const { StorageService } = require('../storage/storageService');
const validationService = require('../validation/validationService');
const { supabaseAdmin } = require('../../config/supabaseClient');

const supabase = supabaseAdmin;

class BrandService {
  constructor() {
    this.supabase = supabase;
    this.storageService = new StorageService();
    this.validationService = validationService;
    
    // Default Nester branding
    this.defaultBranding = {
      logo_path: '/assets/nester-logo.svg',
      primary_color: '#2563eb',
      secondary_color: '#64748b',
      font_family: 'Inter',
      company_name: 'Nester',
      persona_tone: 'Professional & Authoritative',
      persona_style: 'Concise & Factual',
      persona_key_phrases: ['Discover your dream home', 'Premium real estate marketing'],
      persona_phrases_to_avoid: ['cheap', 'deal', 'bargain']
    };
  }

  /**
   * Autonomous brand resolution algorithm
   * Decides whether to use custom branding or default Nester branding
   */
  async resolveBrandAssets(agentId) {
    try {
      // Get agent's brand configuration
      const { data: agentBrand, error } = await supabase
        .from('agent_brands')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch agent brand: ${error.message}`);
      }

      // If no brand record exists, create default one
      if (!agentBrand) {
        return await this.createDefaultBrandRecord(agentId);
      }

      // Apply autonomous branding decision logic
      const brandDecision = this.decideBrandingStrategy(agentBrand);
      
      return this.generateBrandAssets(agentBrand, brandDecision);
      
    } catch (error) {
      console.error('Error resolving brand assets:', error);
      // Fallback to default branding
      return this.generateDefaultBrandAssets();
    }
  }

  /**
   * Autonomous algorithm to decide branding strategy
   */
  decideBrandingStrategy(agentBrand) {
    const decision = {
      useCustomBranding: false,
      brandTier: agentBrand.brand_tier || 'nester_default',
      reasoning: []
    };

    // Check if agent has custom branding enabled
    if (agentBrand.has_custom_branding) {
      decision.reasoning.push('Agent has custom branding enabled');
      
      // Validate custom brand assets
      const hasValidAssets = this.validateCustomBrandAssets(agentBrand);
      
      if (hasValidAssets) {
        decision.useCustomBranding = true;
        decision.reasoning.push('Valid custom brand assets found');
      } else {
        decision.reasoning.push('Custom brand assets incomplete, falling back to Nester branding');
      }
    } else {
      decision.reasoning.push('Agent using default Nester branding');
    }

    // Brand tier considerations
    switch (agentBrand.brand_tier) {
      case 'white_label':
        if (decision.useCustomBranding) {
          decision.reasoning.push('White label tier: using full custom branding');
        } else {
          decision.reasoning.push('White label tier: custom assets missing, using Nester Plus styling');
          decision.brandTier = 'nester_plus';
        }
        break;
        
      case 'nester_plus':
        decision.reasoning.push('Nester Plus tier: enhanced Nester branding with custom colors');
        break;
        
      default:
        decision.reasoning.push('Default tier: standard Nester branding');
    }

    console.log(`Brand decision for agent ${agentBrand.agent_id}:`, decision);
    return decision;
  }

  /**
   * Validate custom brand assets
   */
  validateCustomBrandAssets(agentBrand) {
    const requiredFields = [
      'company_name',
      'primary_color',
      'secondary_color'
    ];

    const optionalButRecommended = [
      'logo_storage_path',
      'font_family',
      'persona_tone',
      'persona_style'
    ];

    // Check required fields
    const hasRequired = requiredFields.every(field => 
      agentBrand[field] && agentBrand[field].trim() !== ''
    );

    if (!hasRequired) {
      return false;
    }

    // Check color format
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!colorRegex.test(agentBrand.primary_color) || 
        !colorRegex.test(agentBrand.secondary_color)) {
      return false;
    }

    return true;
  }

  /**
   * Generate brand assets based on decision
   */
  generateBrandAssets(agentBrand, decision) {
    const assets = {
      // Base information
      agent_id: agentBrand.agent_id,
      brand_tier: decision.brandTier,
      use_custom_branding: decision.useCustomBranding,
      decision_reasoning: decision.reasoning,
      
      // CSS Variables for frontend
      css_variables: {},
      
      // Brand assets
      logo_path: null,
      company_name: null,
      colors: {},
      typography: {},
      persona: {}
    };

    if (decision.useCustomBranding) {
      // Use custom branding
      assets.logo_path = agentBrand.logo_storage_path;
      assets.company_name = agentBrand.company_name;
      
      assets.colors = {
        primary: agentBrand.primary_color,
        secondary: agentBrand.secondary_color
      };
      
      assets.typography = {
        font_family: agentBrand.font_family || 'Inter'
      };
      
      assets.persona = {
        tone: agentBrand.persona_tone || this.defaultBranding.persona_tone,
        style: agentBrand.persona_style || this.defaultBranding.persona_style,
        key_phrases: agentBrand.persona_key_phrases || this.defaultBranding.persona_key_phrases,
        phrases_to_avoid: agentBrand.persona_phrases_to_avoid || this.defaultBranding.persona_phrases_to_avoid
      };
      
      // Generate CSS variables for custom branding
      assets.css_variables = {
        '--brand-primary': agentBrand.primary_color,
        '--brand-secondary': agentBrand.secondary_color,
        '--brand-font': agentBrand.font_family || 'Inter',
        '--brand-logo': `url('${agentBrand.logo_storage_path}')`,
        '--brand-company': `'${agentBrand.company_name}'`
      };
      
    } else {
      // Use Nester branding (with potential tier enhancements)
      assets.logo_path = agentBrand.nester_logo_path || this.defaultBranding.logo_path;
      assets.company_name = 'Nester';
      
      if (decision.brandTier === 'nester_plus' && agentBrand.primary_color) {
        // Nester Plus: use custom colors with Nester logo
        assets.colors = {
          primary: agentBrand.primary_color,
          secondary: agentBrand.secondary_color || this.defaultBranding.secondary_color
        };
      } else {
        // Default Nester colors
        assets.colors = {
          primary: agentBrand.nester_primary_color || this.defaultBranding.primary_color,
          secondary: agentBrand.nester_secondary_color || this.defaultBranding.secondary_color
        };
      }
      
      assets.typography = {
        font_family: agentBrand.nester_font_family || this.defaultBranding.font_family
      };
      
      assets.persona = {
        tone: this.defaultBranding.persona_tone,
        style: this.defaultBranding.persona_style,
        key_phrases: this.defaultBranding.persona_key_phrases,
        phrases_to_avoid: this.defaultBranding.persona_phrases_to_avoid
      };
      
      // Generate CSS variables for Nester branding
      assets.css_variables = {
        '--brand-primary': assets.colors.primary,
        '--brand-secondary': assets.colors.secondary,
        '--brand-font': assets.typography.font_family,
        '--brand-logo': `url('${assets.logo_path}')`,
        '--brand-company': `'Nester'`
      };
    }

    return assets;
  }

  /**
   * Create default brand record for new agent
   */
  async createDefaultBrandRecord(agentId) {
    try {
      const defaultRecord = {
        agent_id: agentId,
        has_custom_branding: false,
        brand_tier: 'nester_default',
        nester_logo_path: this.defaultBranding.logo_path,
        nester_primary_color: this.defaultBranding.primary_color,
        nester_secondary_color: this.defaultBranding.secondary_color,
        nester_font_family: this.defaultBranding.font_family,
        persona_tone: this.defaultBranding.persona_tone,
        persona_style: this.defaultBranding.persona_style,
        persona_key_phrases: this.defaultBranding.persona_key_phrases,
        persona_phrases_to_avoid: this.defaultBranding.persona_phrases_to_avoid
      };

      const { data, error } = await supabase
        .from('agent_brands')
        .insert([defaultRecord])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create default brand record: ${error.message}`);
      }

      // Generate assets for the new record
      const decision = this.decideBrandingStrategy(data);
      return this.generateBrandAssets(data, decision);
      
    } catch (error) {
      console.error('Error creating default brand record:', error);
      return this.generateDefaultBrandAssets();
    }
  }

  /**
   * Generate fallback default brand assets
   */
  generateDefaultBrandAssets() {
    return {
      agent_id: null,
      brand_tier: 'nester_default',
      use_custom_branding: false,
      decision_reasoning: ['Fallback to default branding due to error'],
      
      logo_path: this.defaultBranding.logo_path,
      company_name: 'Nester',
      
      colors: {
        primary: this.defaultBranding.primary_color,
        secondary: this.defaultBranding.secondary_color
      },
      
      typography: {
        font_family: this.defaultBranding.font_family
      },
      
      persona: {
        tone: this.defaultBranding.persona_tone,
        style: this.defaultBranding.persona_style,
        key_phrases: this.defaultBranding.persona_key_phrases,
        phrases_to_avoid: this.defaultBranding.persona_phrases_to_avoid
      },
      
      css_variables: {
        '--brand-primary': this.defaultBranding.primary_color,
        '--brand-secondary': this.defaultBranding.secondary_color,
        '--brand-font': this.defaultBranding.font_family,
        '--brand-logo': `url('${this.defaultBranding.logo_path}')`,
        '--brand-company': `'Nester'`
      }
    };
  }

  /**
   * Update agent brand settings
   */
  async updateAgentBrand(agentId, updateData) {
    try {
      const { data, error } = await supabase
        .from('agent_brands')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('agent_id', agentId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update agent brand: ${error.message}`);
      }

      return data;
      
    } catch (error) {
      console.error('Error updating agent brand:', error);
      throw error;
    }
  }

  /**
   * Get agent brand configuration
   */
  async getAgentBrand(agentId) {
    try {
      const { data, error } = await supabase
        .from('agent_brands')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch agent brand: ${error.message}`);
      }

      return data;
      
    } catch (error) {
      console.error('Error fetching agent brand:', error);
      throw error;
    }
  }

  /**
   * Upload brand logo
   */
  async uploadBrandLogo(agentId, logoFile) {
    try {
      const fileName = `brand-logos/${agentId}-${Date.now()}.${logoFile.originalname.split('.').pop()}`;
      
      const { data, error } = await supabase.storage
        .from('brand-assets')
        .upload(fileName, logoFile.buffer, {
          contentType: logoFile.mimetype
        });

      if (error) {
        throw new Error(`Failed to upload logo: ${error.message}`);
      }

      // Update agent brand record with new logo path
      await this.updateAgentBrand(agentId, {
        logo_storage_path: data.path
      });

      return data.path;
      
    } catch (error) {
      console.error('Error uploading brand logo:', error);
      throw error;
    }
  }

  /**
   * Validate brand tier upgrade eligibility
   */
  validateTierUpgrade(currentTier, targetTier, agentData) {
    const tierHierarchy = ['nester_default', 'nester_plus', 'white_label'];
    const currentIndex = tierHierarchy.indexOf(currentTier);
    const targetIndex = tierHierarchy.indexOf(targetTier);

    if (targetIndex <= currentIndex) {
      return { valid: false, reason: 'Cannot downgrade or stay at same tier' };
    }

    // Add business logic for tier upgrade validation
    // (e.g., subscription status, payment verification, etc.)
    
    return { valid: true, reason: 'Upgrade eligible' };
  }

  /**
   * Create a new brand for an agent
   * @param {Object} brandData - Brand data
   * @param {string} agentId - Agent ID
   * @returns {Object} Created brand
   */
  async createBrand(brandData, agentId) {
    try {
      logger.info('Creating new brand', {
        agentId,
        brandName: brandData.name
      });

      // Validate brand data
      const validatedData = await this.validationService.validate(
        brandData,
        'brandCreate'
      );

      // Prepare brand data
      const enrichedData = {
        ...validatedData,
        agent_id: agentId,
        id: require('crypto').randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true
      };

      // Insert brand
      const { data, error } = await this.supabase
        .from('brands')
        .insert([enrichedData])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create brand: ${error.message}`);
      }

      logger.info('Brand created successfully', {
        brandId: data.id,
        agentId
      });

      return data;

    } catch (error) {
      logger.error('Failed to create brand', {
        agentId,
        error: error.message,
        brandData: this.sanitizeBrandData(brandData)
      });
      throw error;
    }
  }

  /**
   * Get brand by ID
   * @param {string} brandId - Brand ID
   * @param {string} agentId - Agent ID for access control
   * @returns {Object} Brand data
   */
  async getBrandById(brandId, agentId = null) {
    try {
      let query = this.supabase
        .from('brands')
        .select('*')
        .eq('id', brandId);

      // Apply agent filter if provided
      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Brand not found
        }
        throw new Error(`Failed to fetch brand: ${error.message}`);
      }

      return data;

    } catch (error) {
      logger.error('Failed to fetch brand by ID', {
        brandId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all brands for an agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Array} Brands
   */
  async getBrandsByAgent(agentId, options = {}) {
    try {
      const {
        includeInactive = false,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options;

      let query = this.supabase
        .from('brands')
        .select('*')
        .eq('agent_id', agentId);

      // Filter active brands only unless specified
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch brands: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to fetch brands by agent', {
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update a brand
   * @param {string} brandId - Brand ID
   * @param {Object} updateData - Update data
   * @param {string} agentId - Agent ID for access control
   * @returns {Object} Updated brand
   */
  async updateBrand(brandId, updateData, agentId) {
    try {
      logger.info('Updating brand', {
        brandId,
        agentId,
        updateFields: Object.keys(updateData)
      });

      // Validate update data
      const validatedData = await this.validationService.validate(
        updateData,
        'brandUpdate'
      );

      // Prepare update data
      const enrichedUpdateData = {
        ...validatedData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('brands')
        .update(enrichedUpdateData)
        .eq('id', brandId)
        .eq('agent_id', agentId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Brand not found
        }
        throw new Error(`Failed to update brand: ${error.message}`);
      }

      logger.info('Brand updated successfully', {
        brandId,
        agentId
      });

      return data;

    } catch (error) {
      logger.error('Failed to update brand', {
        brandId,
        agentId,
        error: error.message,
        updateData: this.sanitizeBrandData(updateData)
      });
      throw error;
    }
  }

  /**
   * Delete a brand (soft delete)
   * @param {string} brandId - Brand ID
   * @param {string} agentId - Agent ID for access control
   * @returns {Object} Deletion result
   */
  async deleteBrand(brandId, agentId) {
    try {
      logger.info('Deleting brand', {
        brandId,
        agentId
      });

      // Soft delete by setting is_active to false
      const { data, error } = await this.supabase
        .from('brands')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', brandId)
        .eq('agent_id', agentId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Brand not found
        }
        throw new Error(`Failed to delete brand: ${error.message}`);
      }

      logger.info('Brand deleted successfully', {
        brandId,
        agentId
      });

      return { success: true, deletedBrand: data };

    } catch (error) {
      logger.error('Failed to delete brand', {
        brandId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get brand theme/styling configuration
   * @param {string} brandId - Brand ID
   * @param {string} agentId - Agent ID for access control
   * @returns {Object} Theme configuration
   */
  async getBrandTheme(brandId, agentId = null) {
    try {
      const brand = await this.getBrandById(brandId, agentId);
      if (!brand) {
        return null;
      }

      return {
        colors: {
          primary: brand.primary_color || '#007bff',
          secondary: brand.secondary_color || '#6c757d',
          accent: brand.accent_color || '#28a745',
          background: brand.background_color || '#ffffff',
          text: brand.text_color || '#212529'
        },
        fonts: {
          primary: brand.primary_font || 'Inter, sans-serif',
          secondary: brand.secondary_font || 'Georgia, serif'
        },
        logo: {
          url: brand.logo_url,
          alt: brand.name
        },
        banner: {
          url: brand.banner_url,
          alt: `${brand.name} banner`
        },
        styles: {
          borderRadius: brand.border_radius || '8px',
          shadowStyle: brand.shadow_style || 'soft',
          buttonStyle: brand.button_style || 'rounded'
        }
      };

    } catch (error) {
      logger.error('Failed to get brand theme', {
        brandId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate CSS for brand styling
   * @param {string} brandId - Brand ID
   * @param {string} agentId - Agent ID for access control
   * @returns {string} CSS string
   */
  async generateBrandCSS(brandId, agentId = null) {
    try {
      const theme = await this.getBrandTheme(brandId, agentId);
      if (!theme) {
        return null;
      }

      const css = `
        :root {
          --brand-primary: ${theme.colors.primary};
          --brand-secondary: ${theme.colors.secondary};
          --brand-accent: ${theme.colors.accent};
          --brand-background: ${theme.colors.background};
          --brand-text: ${theme.colors.text};
          --brand-font-primary: ${theme.fonts.primary};
          --brand-font-secondary: ${theme.fonts.secondary};
          --brand-border-radius: ${theme.styles.borderRadius};
        }

        .brand-primary { color: var(--brand-primary) !important; }
        .brand-secondary { color: var(--brand-secondary) !important; }
        .brand-accent { color: var(--brand-accent) !important; }
        .brand-text { color: var(--brand-text) !important; }

        .brand-bg-primary { background-color: var(--brand-primary) !important; }
        .brand-bg-secondary { background-color: var(--brand-secondary) !important; }
        .brand-bg-accent { background-color: var(--brand-accent) !important; }
        .brand-bg-background { background-color: var(--brand-background) !important; }

        .brand-font-primary { font-family: var(--brand-font-primary) !important; }
        .brand-font-secondary { font-family: var(--brand-font-secondary) !important; }

        .brand-button {
          background-color: var(--brand-primary);
          color: white;
          border: none;
          border-radius: var(--brand-border-radius);
          padding: 12px 24px;
          font-family: var(--brand-font-primary);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .brand-button:hover {
          background-color: var(--brand-accent);
          transform: translateY(-2px);
        }

        .brand-card {
          background-color: var(--brand-background);
          border-radius: var(--brand-border-radius);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 24px;
          font-family: var(--brand-font-primary);
        }
      `;

      return css.trim();

    } catch (error) {
      logger.error('Failed to generate brand CSS', {
        brandId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get brand statistics
   * @param {string} brandId - Brand ID
   * @param {string} agentId - Agent ID for access control
   * @returns {Object} Brand statistics
   */
  async getBrandStatistics(brandId, agentId) {
    try {
      // Get properties using this brand
      const { data: properties, error: propError } = await this.supabase
        .from('properties')
        .select('id, created_at')
        .eq('brand_id', brandId)
        .eq('agent_id', agentId);

      if (propError) throw propError;

      // Get social posts using this brand
      const { data: socialPosts, error: socialError } = await this.supabase
        .from('social_posts')
        .select('id, platform, status, created_at')
        .eq('brand_id', brandId);

      if (socialError) throw socialError;

      // Calculate statistics
      const stats = {
        properties: {
          total: properties.length,
          recent: properties.filter(p => 
            new Date(p.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length
        },
        socialPosts: {
          total: socialPosts.length,
          published: socialPosts.filter(p => p.status === 'published').length,
          byPlatform: socialPosts.reduce((acc, post) => {
            acc[post.platform] = (acc[post.platform] || 0) + 1;
            return acc;
          }, {})
        },
        lastUsed: properties.length > 0 || socialPosts.length > 0 ? 
          Math.max(
            ...properties.map(p => new Date(p.created_at).getTime()),
            ...socialPosts.map(p => new Date(p.created_at).getTime())
          ) : null
      };

      return stats;

    } catch (error) {
      logger.error('Failed to get brand statistics', {
        brandId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Sanitize brand data for logging
   * @param {Object} brandData - Brand data
   * @returns {Object} Sanitized data
   */
  sanitizeBrandData(brandData) {
    const sanitized = { ...brandData };
    // Remove any sensitive fields if needed
    return sanitized;
  }

  /**
   * Health check for brand service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      // Test database connection
      const { data, error } = await this.supabase
        .from('brands')
        .select('count')
        .limit(1);

      if (error) throw error;

      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Brand service health check failed', {
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

module.exports = { BrandService };