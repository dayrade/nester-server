const axios = require('axios');
const { supabaseAdmin } = require('../../config/supabaseClient');
const config = require('../../config/config');
const propertyService = require('../property/propertyService');
const brandService = require('../brand/brandService');
const socialMediaService = require('../social/socialService');

class AIService {
  constructor() {
    this.claudeApiKey = process.env.CLAUDE_API_KEY;
    this.replicateApiKey = process.env.REPLICATE_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    
    // AI Image Restyling Megaprompts
    this.stylePrompts = {
      contemporary: "Transform this interior space into a contemporary design while preserving the exact architectural elements, window views, and spatial layout. Use clean lines, neutral color palettes (whites, grays, blacks), minimalist furniture with geometric shapes, sleek materials like glass and steel, modern lighting fixtures, and uncluttered spaces. Maintain all existing windows, doors, ceiling height, and room proportions exactly as shown.",
      bohemian: "Redesign this interior in bohemian style while keeping all architectural features, window positions, and room dimensions identical. Incorporate warm earth tones, layered textiles, vintage and eclectic furniture, plants and natural elements, patterned rugs and tapestries, mixed textures, artistic wall hangings, and cozy seating areas. Preserve the exact window views and structural elements.",
      traditional: "Convert this space to traditional style while maintaining precise architectural integrity including all windows, doors, and structural elements. Use classic furniture pieces, rich wood tones, elegant fabrics, symmetrical arrangements, formal dining sets, traditional patterns, warm color schemes, and timeless decorative elements. Keep all existing spatial relationships and views unchanged.",
      scandinavian: "Transform this interior to Scandinavian design while preserving every architectural detail and window placement. Emphasize light woods (birch, pine, oak), white and light color palettes, functional minimalist furniture, cozy textiles (hygge elements), natural light maximization, simple clean lines, and practical storage solutions. Maintain exact room proportions and exterior views."
    };
    
    // Social Media Campaign Architecture
    this.campaignArchetypes = [
      'Property Showcase',
      'Neighborhood Highlight',
      'Market Insight',
      'Home Buying Tips',
      'Design Inspiration',
      'Local Community',
      'Agent Expertise',
      'Success Stories',
      'Market Trends',
      'Investment Opportunities'
    ];
    
    this.weeklyThemes = [
      'New Listings Week',
      'Neighborhood Spotlight',
      'Market Analysis Week',
      'Home Buyer Education',
      'Design & Staging Week',
      'Community Events',
      'Success Stories Week',
      'Investment Focus',
      'Seasonal Market Trends',
      'Agent Insights Week'
    ];
  }

  /**
   * Main content generation orchestrator
   */
  async generatePropertyContent(property, contentTypes) {
    const jobId = this.generateJobId();
    
    try {
      // Update property status
      await propertyService.updateContentGenerationStatus(
        property.id,
        'started',
        jobId
      );

      // Get agent branding
      const brandAssets = await brandService.resolveBrandAssets(property.agent_id);
      
      // Process content generation asynchronously
      this.processContentGeneration(property, contentTypes, brandAssets, jobId)
        .catch(error => {
          console.error(`Content generation job ${jobId} failed:`, error);
        });

      return {
        id: jobId,
        status: 'started',
        contentTypes
      };
      
    } catch (error) {
      console.error('Failed to start content generation:', error);
      throw error;
    }
  }

  /**
   * Process content generation job
   */
  async processContentGeneration(property, contentTypes, brandAssets, jobId) {
    try {
      const results = {};
      
      // Generate enhanced description
      if (contentTypes.includes('description')) {
        results.description = await this.generatePropertyDescription(property, brandAssets);
      }
      
      // Generate AI-restyled images
      if (contentTypes.includes('images')) {
        results.images = await this.generateStyledImages(property);
      }
      
      // Generate social media campaign
      if (contentTypes.includes('social_posts')) {
        results.socialCampaign = await this.generateSocialMediaCampaign(property, brandAssets);
      }
      
      // Generate PDF brochure
      if (contentTypes.includes('pdf')) {
        results.pdf = await this.generatePDFBrochure(property, brandAssets);
      }
      
      // Generate microsite
      if (contentTypes.includes('microsite')) {
        results.microsite = await this.generateMicrosite(property, brandAssets);
      }
      
      // Generate email templates
      if (contentTypes.includes('email_templates')) {
        results.emailTemplates = await this.generateEmailTemplates(property, brandAssets);
      }

      // Update property with generated content
      await propertyService.updateProperty(property.id, {
        description: results.description || property.description,
        content_generation_status: 'completed',
        content_generation_completed_at: new Date().toISOString()
      }, property.agent_id);

      console.log(`Content generation completed for property ${property.id}`);
      
    } catch (error) {
      console.error(`Content generation failed for property ${property.id}:`, error);
      
      await propertyService.updateContentGenerationStatus(
        property.id,
        'failed'
      );
    }
  }

  /**
   * Generate enhanced property description using Claude
   */
  async generatePropertyDescription(property, brandAssets) {
    try {
      const prompt = this.buildDescriptionPrompt(property, brandAssets);
      
      const response = await axios.post(`${process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1'}/messages`, {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${this.claudeApiKey}`,
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey
        }
      });

      return response.data.content[0].text;
      
    } catch (error) {
      console.error('Failed to generate property description:', error);
      throw error;
    }
  }

  /**
   * Generate AI-restyled images using Replicate Flux models
   */
  async generateStyledImages(property) {
    if (!property.property_images || property.property_images.length === 0) {
      return [];
    }

    const styledImages = [];
    
    try {
      // Process up to 5 primary images
      const imagesToProcess = property.property_images
        .sort((a, b) => a.display_order - b.display_order)
        .slice(0, 5);

      for (const image of imagesToProcess) {
        for (const [styleName, stylePrompt] of Object.entries(this.stylePrompts)) {
          try {
            const styledImage = await this.generateStyledImage(image.storage_path, stylePrompt, styleName);
            if (styledImage) {
              styledImages.push({
                original_image_id: image.id,
                style: styleName,
                storage_path: styledImage.storage_path,
                replicate_prediction_id: styledImage.prediction_id
              });
            }
          } catch (error) {
            console.error(`Failed to generate ${styleName} style for image ${image.id}:`, error);
          }
        }
      }
      
      return styledImages;
      
    } catch (error) {
      console.error('Failed to generate styled images:', error);
      throw error;
    }
  }

  /**
   * Generate single styled image using Replicate
   */
  async generateStyledImage(originalImagePath, stylePrompt, styleName) {
    try {
      const response = await axios.post(`${process.env.REPLICATE_API_URL || 'https://api.replicate.com/v1'}/predictions`, {
        version: process.env.REPLICATE_FLUX_MODEL_VERSION || 'flux-1.1-pro', // Latest Flux model
        input: {
          image: originalImagePath,
          prompt: stylePrompt,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 50,
          seed: Math.floor(Math.random() * 1000000)
        }
      }, {
        headers: {
          'Authorization': `Token ${this.replicateApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const prediction = response.data;
      
      // Wait for completion
      const completedPrediction = await this.waitForPrediction(prediction.id);
      
      if (completedPrediction.status === 'succeeded' && completedPrediction.output) {
        // Upload to Supabase storage
        const storagePath = await this.uploadGeneratedImage(
          completedPrediction.output[0],
          `styled-${styleName}-${Date.now()}.jpg`
        );
        
        return {
          storage_path: storagePath,
          prediction_id: prediction.id
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('Failed to generate styled image:', error);
      throw error;
    }
  }

  /**
   * Generate 70-day social media campaign
   */
  async generateSocialMediaCampaign(property, brandAssets) {
    try {
      const campaign = {
        duration: 70,
        totalPosts: 210,
        postsPerDay: 3,
        posts: []
      };

      // Generate posts for 70 days
      for (let day = 1; day <= 70; day++) {
        const weekNumber = Math.ceil(day / 7);
        const theme = this.weeklyThemes[(weekNumber - 1) % this.weeklyThemes.length];
        
        // Generate 3 posts per day with different archetypes
        for (let postIndex = 0; postIndex < 3; postIndex++) {
          const archetype = this.campaignArchetypes[postIndex % this.campaignArchetypes.length];
          
          // Ensure "Never-the-Same-Day" algorithm
          const usedArchetypesToday = campaign.posts
            .filter(post => post.day === day)
            .map(post => post.archetype);
          
          if (!usedArchetypesToday.includes(archetype)) {
            const post = await this.generateSocialPost(property, brandAssets, theme, archetype, day);
            campaign.posts.push({
              day,
              theme,
              archetype,
              ...post
            });
          }
        }
      }

      // Save campaign to database
      await this.saveSocialCampaign(property.id, campaign);
      
      return campaign;
      
    } catch (error) {
      console.error('Failed to generate social media campaign:', error);
      throw error;
    }
  }

  /**
   * Generate individual social media post
   */
  async generateSocialPost(property, brandAssets, theme, archetype, day) {
    try {
      const prompt = this.buildSocialPostPrompt(property, brandAssets, theme, archetype);
      
      const response = await axios.post(`${process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1'}/messages`, {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${this.claudeApiKey}`,
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey
        }
      });

      const content = JSON.parse(response.data.content[0].text);
      
      // Generate visual content for different aspect ratios
      const visuals = await this.generateSocialVisuals(property, content, day);
      
      return {
        content: content.text,
        hashtags: content.hashtags,
        hook: content.hook,
        platform_optimized: content.platform_optimized,
        visuals
      };
      
    } catch (error) {
      console.error('Failed to generate social post:', error);
      throw error;
    }
  }

  /**
   * Generate visual content for social media posts
   */
  async generateSocialVisuals(property, content, day) {
    // This would integrate with your HTML/CSS template rendering using Puppeteer
    // to generate 1:1, 9:16, and 16:9 aspect ratio images
    return {
      square: `visuals/social/day-${day}-square.png`,
      story: `visuals/social/day-${day}-story.png`,
      landscape: `visuals/social/day-${day}-landscape.png`
    };
  }

  /**
   * Build prompts for different content types
   */
  buildDescriptionPrompt(property, brandAssets) {
    return `
Create a compelling property description for this listing:

Property Details:
- Address: ${property.address}
- Price: $${property.price?.toLocaleString()}
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms}
- Square Feet: ${property.square_feet}
- Type: ${property.property_type}
- Features: ${property.features?.join(', ')}

Brand Persona:
- Tone: ${brandAssets.persona_tone}
- Style: ${brandAssets.persona_style}
- Key Phrases: ${brandAssets.persona_key_phrases?.join(', ')}
- Avoid: ${brandAssets.persona_phrases_to_avoid?.join(', ')}

Write a 150-200 word description that highlights the property's best features while maintaining the brand voice. Focus on lifestyle benefits and emotional appeal.
`;
  }

  buildSocialPostPrompt(property, brandAssets, theme, archetype) {
    return `
Generate a social media post for this property:

Property: ${property.address}
Weekly Theme: ${theme}
Content Archetype: ${archetype}
Brand Voice: ${brandAssets.persona_tone}

Create a JSON response with:
{
  "text": "Main post content (150 chars max)",
  "hook": "Attention-grabbing opening line",
  "hashtags": ["array", "of", "relevant", "hashtags"],
  "platform_optimized": {
    "instagram": "Instagram-specific version",
    "facebook": "Facebook-specific version",
    "linkedin": "LinkedIn-specific version",
    "tiktok": "TikTok-specific version"
  }
}

Ensure content is engaging, on-brand, and platform-appropriate.
`;
  }

  /**
   * Utility methods
   */
  generateJobId() {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async waitForPrediction(predictionId) {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`${process.env.REPLICATE_API_URL || 'https://api.replicate.com/v1'}/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Token ${this.replicateApiKey}`
          }
        });
        
        const prediction = response.data;
        
        if (prediction.status === 'succeeded' || prediction.status === 'failed') {
          return prediction;
        }
        
        await new Promise(resolve => setTimeout(resolve, parseInt(process.env.AI_POLLING_DELAY_MS || '5000'))); // Wait 5 seconds
        attempts++;
        
      } catch (error) {
        console.error('Error checking prediction status:', error);
        attempts++;
      }
    }
    
    throw new Error('Prediction timeout');
  }

  async uploadGeneratedImage(imageUrl, filename) {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      
      const { data, error } = await supabaseAdmin.storage
        .from('generated-images')
        .upload(filename, buffer, {
          contentType: 'image/jpeg'
        });
      
      if (error) throw error;
      
      return data.path;
      
    } catch (error) {
      console.error('Failed to upload generated image:', error);
      throw error;
    }
  }

  async saveSocialCampaign(propertyId, campaign) {
    // Save campaign posts to social_posts table
    const posts = campaign.posts.map(post => ({
      property_id: propertyId,
      platform: 'multi', // Will be distributed to specific platforms
      content: post.content,
      hashtags: post.hashtags,
      archetype: post.archetype,
      status: 'draft',
      scheduled_for: new Date(Date.now() + (post.day * 24 * 60 * 60 * 1000)).toISOString(),
      generation_prompt: `Theme: ${post.theme}, Archetype: ${post.archetype}`,
      generation_model: 'claude-3-sonnet'
    }));

    const { error } = await supabaseAdmin
      .from('social_posts')
      .insert(posts);

    if (error) {
      throw new Error(`Failed to save social campaign: ${error.message}`);
    }
  }
}

module.exports = new AIService();