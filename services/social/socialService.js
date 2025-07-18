const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/config');
const aiService = require('../ai/aiService');
const storageService = require('../storage/storageService');
const brandService = require('../brand/brandService');
const puppeteer = require('puppeteer');
const axios = require('axios');

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

class SocialService {
  constructor() {
    // 70-day campaign architecture
    this.campaignConfig = {
      TOTAL_DAYS: 70,
      POSTS_PER_DAY: 3,
      TOTAL_POSTS: 210
    };

    // Weekly themes for content variety
    this.weeklyThemes = [
      { week: 1, theme: 'Property Showcase', focus: 'Highlight key features and spaces' },
      { week: 2, theme: 'Neighborhood Spotlight', focus: 'Local amenities and community' },
      { week: 3, theme: 'Lifestyle & Living', focus: 'How life feels in this space' },
      { week: 4, theme: 'Investment Insights', focus: 'Market value and investment potential' },
      { week: 5, theme: 'Behind the Scenes', focus: 'Process, staging, and preparation' },
      { week: 6, theme: 'Client Stories', focus: 'Testimonials and success stories' },
      { week: 7, theme: 'Market Trends', focus: 'Industry insights and expertise' },
      { week: 8, theme: 'Virtual Tours', focus: 'Interactive and immersive content' },
      { week: 9, theme: 'Seasonal Appeal', focus: 'How property shines in current season' },
      { week: 10, theme: 'Final Push', focus: 'Urgency and call-to-action focused' }
    ];

    // Content archetypes for variety
    this.contentArchetypes = [
      'feature_highlight',
      'lifestyle_moment',
      'neighborhood_gem',
      'investment_insight',
      'virtual_walkthrough',
      'before_after',
      'client_testimonial',
      'market_update',
      'behind_scenes',
      'call_to_action'
    ];

    // Platform-specific configurations
    this.platformConfigs = {
      instagram: {
        maxTextLength: 2200,
        hashtagLimit: 30,
        imageFormats: ['square', 'story'],
        preferredAspectRatio: '1:1'
      },
      facebook: {
        maxTextLength: 63206,
        hashtagLimit: 10,
        imageFormats: ['landscape', 'square'],
        preferredAspectRatio: '16:9'
      },
      linkedin: {
        maxTextLength: 3000,
        hashtagLimit: 5,
        imageFormats: ['landscape'],
        preferredAspectRatio: '16:9'
      },
      tiktok: {
        maxTextLength: 150,
        hashtagLimit: 10,
        imageFormats: ['story'],
        preferredAspectRatio: '9:16'
      },
      twitter: {
        maxTextLength: 280,
        hashtagLimit: 5,
        imageFormats: ['landscape', 'square'],
        preferredAspectRatio: '16:9'
      },
      bluesky: {
        maxTextLength: 300,
        hashtagLimit: 5,
        imageFormats: ['landscape', 'square'],
        preferredAspectRatio: '16:9'
      },
      threads: {
        maxTextLength: 500,
        hashtagLimit: 10,
        imageFormats: ['square'],
        preferredAspectRatio: '1:1'
      }
    };

    // Never-the-Same-Day algorithm tracking
    this.usedCombinations = new Map();
  }

  /**
   * Generate complete 70-day social media campaign
   */
  async generateCampaign(propertyId, agentId, options = {}) {
    try {
      console.log(`Starting 70-day campaign generation for property ${propertyId}`);

      // Get property and brand data
      const [propertyData, brandAssets] = await Promise.all([
        this.getPropertyData(propertyId),
        brandService.resolveBrandAssets(agentId)
      ]);

      // Generate campaign strategy
      const campaignStrategy = await this.generateCampaignStrategy(propertyData, brandAssets);

      // Generate all 210 posts
      const allPosts = [];
      const platforms = options.platforms || ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter'];

      for (let day = 1; day <= this.campaignConfig.TOTAL_DAYS; day++) {
        const weekNumber = Math.ceil(day / 7);
        const theme = this.weeklyThemes[(weekNumber - 1) % this.weeklyThemes.length];

        for (let postIndex = 0; postIndex < this.campaignConfig.POSTS_PER_DAY; postIndex++) {
          // Apply Never-the-Same-Day algorithm
          const contentConfig = this.generateUniqueContentConfig(day, postIndex, theme);
          
          // Generate posts for each platform
          for (const platform of platforms) {
            const post = await this.generateSinglePost(
              propertyData,
              brandAssets,
              campaignStrategy,
              platform,
              contentConfig,
              day,
              postIndex
            );

            allPosts.push(post);
          }
        }

        // Progress logging
        if (day % 10 === 0) {
          console.log(`Campaign generation progress: ${day}/${this.campaignConfig.TOTAL_DAYS} days completed`);
        }
      }

      // Save campaign to database
      const campaign = await this.saveCampaign(propertyId, agentId, {
        strategy: campaignStrategy,
        posts: allPosts,
        total_posts: allPosts.length,
        platforms: platforms,
        status: 'generated'
      });

      console.log(`Campaign generation completed: ${allPosts.length} posts created`);
      return campaign;

    } catch (error) {
      console.error('Error generating campaign:', error);
      throw error;
    }
  }

  /**
   * Generate unique content configuration using Never-the-Same-Day algorithm
   */
  generateUniqueContentConfig(day, postIndex, theme) {
    const maxAttempts = 50;
    let attempts = 0;
    let config;

    do {
      config = {
        day,
        postIndex,
        theme: theme.theme,
        archetype: this.contentArchetypes[Math.floor(Math.random() * this.contentArchetypes.length)],
        tone: this.getRandomTone(),
        visualStyle: this.getRandomVisualStyle(),
        callToAction: this.getRandomCTA(),
        focusArea: this.getRandomFocusArea()
      };

      const configKey = `${config.archetype}-${config.tone}-${config.visualStyle}-${config.callToAction}`;
      const dayKey = `day-${day}`;

      if (!this.usedCombinations.has(dayKey)) {
        this.usedCombinations.set(dayKey, new Set());
      }

      const dayUsed = this.usedCombinations.get(dayKey);
      
      if (!dayUsed.has(configKey)) {
        dayUsed.add(configKey);
        break;
      }

      attempts++;
    } while (attempts < maxAttempts);

    return config;
  }

  /**
   * Generate campaign strategy using AI
   */
  async generateCampaignStrategy(propertyData, brandAssets) {
    try {
      const strategyPrompt = `
Create a comprehensive 70-day social media campaign strategy for this property:

Property Details:
- Title: ${propertyData.title}
- Type: ${propertyData.property_type}
- Price: ${propertyData.price}
- Location: ${propertyData.location}
- Key Features: ${propertyData.key_features?.join(', ') || 'N/A'}
- Description: ${propertyData.description}

Brand Persona:
- Tone: ${brandAssets.persona.tone}
- Style: ${brandAssets.persona.style}
- Key Phrases: ${brandAssets.persona.key_phrases?.join(', ')}
- Avoid: ${brandAssets.persona.phrases_to_avoid?.join(', ')}

Generate a strategy that includes:
1. Overall campaign messaging
2. Target audience definition
3. Key selling points to emphasize
4. Emotional triggers to use
5. Unique value propositions
6. Content pillars for the 10-week journey

Return as JSON with these exact keys: messaging, target_audience, key_selling_points, emotional_triggers, value_propositions, content_pillars
`;

      const strategy = await aiService.generateContent(strategyPrompt, {
        model: 'claude-3-sonnet',
        maxTokens: 2000,
        temperature: 0.7
      });

      return JSON.parse(strategy);

    } catch (error) {
      console.error('Error generating campaign strategy:', error);
      // Return default strategy
      return this.getDefaultCampaignStrategy(propertyData);
    }
  }

  /**
   * Generate single social media post
   */
  async generateSinglePost(propertyData, brandAssets, strategy, platform, contentConfig, day, postIndex) {
    try {
      const platformConfig = this.platformConfigs[platform];
      
      // Generate AI-optimized content
      const contentPrompt = this.buildContentPrompt(
        propertyData,
        brandAssets,
        strategy,
        platform,
        contentConfig,
        platformConfig
      );

      const aiContent = await aiService.generateContent(contentPrompt, {
        model: 'claude-3-sonnet',
        maxTokens: 1000,
        temperature: 0.8
      });

      const parsedContent = JSON.parse(aiContent);

      // Generate visual content
      const visualContent = await this.generateVisualContent(
        propertyData,
        brandAssets,
        contentConfig,
        platform,
        parsedContent
      );

      // Calculate optimal posting time
      const scheduledTime = this.calculatePostingTime(platform, day, postIndex);

      // Create post record
      const post = {
        property_id: propertyData.id,
        agent_id: propertyData.agent_id,
        platform: platform,
        content_type: contentConfig.archetype,
        content_text: parsedContent.text,
        hashtags: parsedContent.hashtags,
        image_paths: visualContent.imagePaths,
        scheduled_for: scheduledTime,
        campaign_day: day,
        post_index: postIndex,
        theme: contentConfig.theme,
        status: 'scheduled',
        metadata: {
          strategy_used: contentConfig,
          ai_prompt_version: '1.0',
          visual_style: contentConfig.visualStyle,
          generated_at: new Date().toISOString()
        }
      };

      return post;

    } catch (error) {
      console.error('Error generating single post:', error);
      throw error;
    }
  }

  /**
   * Build AI content generation prompt
   */
  buildContentPrompt(propertyData, brandAssets, strategy, platform, contentConfig, platformConfig) {
    return `
Generate a ${platform} post for this real estate property:

Property: ${propertyData.title}
Location: ${propertyData.location}
Price: ${propertyData.price}
Type: ${propertyData.property_type}

Campaign Context:
- Day: ${contentConfig.day}/70
- Theme: ${contentConfig.theme}
- Content Type: ${contentConfig.archetype}
- Tone: ${contentConfig.tone}
- Focus: ${contentConfig.focusArea}

Brand Voice:
- Tone: ${brandAssets.persona.tone}
- Style: ${brandAssets.persona.style}
- Use phrases like: ${brandAssets.persona.key_phrases?.join(', ')}
- Avoid: ${brandAssets.persona.phrases_to_avoid?.join(', ')}

Strategy:
- Target Audience: ${strategy.target_audience}
- Key Message: ${strategy.messaging}
- Selling Points: ${strategy.key_selling_points?.join(', ')}

Platform Constraints:
- Max text length: ${platformConfig.maxTextLength} characters
- Max hashtags: ${platformConfig.hashtagLimit}
- Preferred format: ${platformConfig.preferredAspectRatio}

Generate:
1. Engaging post text that fits platform constraints
2. Relevant hashtags (max ${platformConfig.hashtagLimit})
3. Call-to-action that drives engagement
4. Hook that grabs attention in first 5 words

Return as JSON: {"text": "post content", "hashtags": ["hashtag1", "hashtag2"], "hook": "attention grabber", "cta": "call to action"}
`;
  }

  /**
   * Generate visual content for post
   */
  async generateVisualContent(propertyData, brandAssets, contentConfig, platform, textContent) {
    try {
      const platformConfig = this.platformConfigs[platform];
      const imageFormats = platformConfig.imageFormats;
      const imagePaths = [];

      // Get property images
      const { data: propertyImages } = await supabase
        .from('property_images')
        .select('*')
        .eq('property_id', propertyData.id)
        .order('display_order')
        .limit(3);

      if (!propertyImages || propertyImages.length === 0) {
        throw new Error('No property images available for visual content generation');
      }

      // Generate branded social media graphics
      for (const format of imageFormats) {
        const templateHtml = this.generateSocialTemplate(
          propertyImages[0],
          textContent,
          brandAssets,
          format,
          contentConfig
        );

        const imageBuffer = await this.renderHtmlToImage(templateHtml, format);
        const fileName = `${platform}-${format}-day${contentConfig.day}-post${contentConfig.postIndex}-${Date.now()}.png`;
        
        const uploadResult = await storageService.uploadSocialMediaContent(
          propertyData.agent_id,
          propertyData.id,
          platform,
          imageBuffer,
          fileName
        );

        imagePaths.push(uploadResult.path);
      }

      return { imagePaths };

    } catch (error) {
      console.error('Error generating visual content:', error);
      // Return fallback with original property image
      return { imagePaths: [propertyImages?.[0]?.storage_path || null] };
    }
  }

  /**
   * Generate HTML template for social media graphics
   */
  generateSocialTemplate(propertyImage, textContent, brandAssets, format, contentConfig) {
    const dimensions = this.getFormatDimensions(format);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .container {
            width: ${dimensions.width}px;
            height: ${dimensions.height}px;
            position: relative;
            font-family: ${brandAssets.typography.font_family}, sans-serif;
            overflow: hidden;
        }
        .background {
            width: 100%;
            height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0;
            left: 0;
        }
        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, 
                ${brandAssets.colors.primary}CC 0%, 
                ${brandAssets.colors.secondary}AA 100%);
        }
        .content {
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
        }
        .hook {
            font-size: ${format === 'story' ? '32px' : '24px'};
            font-weight: bold;
            margin-bottom: 10px;
            line-height: 1.2;
        }
        .price {
            font-size: ${format === 'story' ? '28px' : '20px'};
            font-weight: 600;
            color: #FFD700;
            margin-bottom: 8px;
        }
        .location {
            font-size: ${format === 'story' ? '18px' : '14px'};
            opacity: 0.9;
            margin-bottom: 15px;
        }
        .logo {
            position: absolute;
            top: 20px;
            right: 20px;
            width: ${format === 'story' ? '80px' : '60px'};
            height: ${format === 'story' ? '80px' : '60px'};
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: ${brandAssets.colors.primary};
            font-size: ${format === 'story' ? '16px' : '12px'};
        }
        .cta {
            background: ${brandAssets.colors.primary};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: ${format === 'story' ? '16px' : '12px'};
            font-weight: 600;
            display: inline-block;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="${propertyImage.storage_path}" class="background" alt="Property">
        <div class="overlay"></div>
        <div class="logo">${brandAssets.company_name.substring(0, 3).toUpperCase()}</div>
        <div class="content">
            <div class="hook">${textContent.hook}</div>
            <div class="price">${propertyImage.property?.price || 'Contact for Price'}</div>
            <div class="location">${propertyImage.property?.location || ''}</div>
            <div class="cta">${textContent.cta}</div>
        </div>
    </div>
</body>
</html>
`;
  }

  /**
   * Render HTML to image using Puppeteer
   */
  async renderHtmlToImage(html, format) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      const dimensions = this.getFormatDimensions(format);
      await page.setViewport({ width: dimensions.width, height: dimensions.height });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const imageBuffer = await page.screenshot({
        type: 'png',
        fullPage: true
      });
      
      return imageBuffer;
      
    } finally {
      await browser.close();
    }
  }

  /**
   * Publish campaign to MixPost
   */
  async publishToMixPost(campaignId, agentId) {
    try {
      // Get campaign posts
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'scheduled')
        .order('scheduled_for');

      if (error) {
        throw new Error(`Failed to fetch campaign posts: ${error.message}`);
      }

      // Get MixPost credentials for agent
      const mixpostConfig = await this.getMixPostConfig(agentId);
      
      let publishedCount = 0;
      const batchSize = 10; // Process in batches to avoid rate limits

      for (let i = 0; i < posts.length; i += batchSize) {
        const batch = posts.slice(i, i + batchSize);
        
        const publishPromises = batch.map(async (post) => {
          try {
            const mixpostPost = await this.createMixPostScheduledPost(post, mixpostConfig);
            
            // Update post with MixPost ID
            await supabase
              .from('social_posts')
              .update({
                mixpost_id: mixpostPost.id,
                status: 'published_to_scheduler',
                published_at: new Date().toISOString()
              })
              .eq('id', post.id);

            publishedCount++;
            return mixpostPost;
            
          } catch (error) {
            console.error(`Failed to publish post ${post.id}:`, error);
            
            // Mark post as failed
            await supabase
              .from('social_posts')
              .update({ status: 'failed', error_message: error.message })
              .eq('id', post.id);
              
            return null;
          }
        });

        await Promise.all(publishPromises);
        
        // Rate limiting delay
        if (i + batchSize < posts.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`Published ${publishedCount}/${posts.length} posts to MixPost`);
      return { publishedCount, totalPosts: posts.length };

    } catch (error) {
      console.error('Error publishing to MixPost:', error);
      throw error;
    }
  }

  /**
   * Create scheduled post in MixPost
   */
  async createMixPostScheduledPost(post, mixpostConfig) {
    try {
      const postData = {
        content: post.content_text,
        media: post.image_paths?.map(path => ({ url: storageService.getPublicUrl('social-media', path) })) || [],
        platforms: [post.platform],
        scheduled_at: post.scheduled_for,
        tags: post.hashtags || []
      };

      const response = await axios.post(
        `${mixpostConfig.apiUrl}/api/posts`,
        postData,
        {
          headers: {
            'Authorization': `Bearer ${mixpostConfig.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;

    } catch (error) {
      console.error('Error creating MixPost scheduled post:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  async getPropertyData(propertyId) {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch property data: ${error.message}`);
    }

    return data;
  }

  async saveCampaign(propertyId, agentId, campaignData) {
    try {
      // Save campaign record
      const { data: campaign, error: campaignError } = await supabase
        .from('social_campaigns')
        .insert([{
          property_id: propertyId,
          agent_id: agentId,
          total_posts: campaignData.total_posts,
          platforms: campaignData.platforms,
          strategy: campaignData.strategy,
          status: campaignData.status
        }])
        .select('*')
        .single();

      if (campaignError) {
        throw new Error(`Failed to save campaign: ${campaignError.message}`);
      }

      // Save all posts
      const postsWithCampaignId = campaignData.posts.map(post => ({
        ...post,
        campaign_id: campaign.id
      }));

      const { error: postsError } = await supabase
        .from('social_posts')
        .insert(postsWithCampaignId);

      if (postsError) {
        throw new Error(`Failed to save posts: ${postsError.message}`);
      }

      return campaign;

    } catch (error) {
      console.error('Error saving campaign:', error);
      throw error;
    }
  }

  calculatePostingTime(platform, day, postIndex) {
    // Optimal posting times by platform
    const optimalTimes = {
      instagram: ['09:00', '13:00', '19:00'],
      facebook: ['09:00', '15:00', '20:00'],
      linkedin: ['08:00', '12:00', '17:00'],
      tiktok: ['06:00', '10:00', '19:00'],
      twitter: ['08:00', '12:00', '17:00'],
      bluesky: ['09:00', '13:00', '18:00'],
      threads: ['10:00', '14:00', '19:00']
    };

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + day - 1);
    
    const timeSlot = optimalTimes[platform][postIndex] || '12:00';
    const [hours, minutes] = timeSlot.split(':');
    
    baseDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    return baseDate.toISOString();
  }

  getFormatDimensions(format) {
    const dimensions = {
      square: { width: 1080, height: 1080 },
      story: { width: 1080, height: 1920 },
      landscape: { width: 1920, height: 1080 }
    };
    
    return dimensions[format] || dimensions.square;
  }

  getRandomTone() {
    const tones = ['professional', 'friendly', 'luxurious', 'approachable', 'authoritative', 'warm'];
    return tones[Math.floor(Math.random() * tones.length)];
  }

  getRandomVisualStyle() {
    const styles = ['modern', 'elegant', 'bold', 'minimalist', 'vibrant', 'sophisticated'];
    return styles[Math.floor(Math.random() * styles.length)];
  }

  getRandomCTA() {
    const ctas = ['Learn More', 'Schedule Tour', 'Contact Agent', 'View Details', 'Book Viewing', 'Get Info'];
    return ctas[Math.floor(Math.random() * ctas.length)];
  }

  getRandomFocusArea() {
    const areas = ['exterior', 'interior', 'kitchen', 'bedroom', 'bathroom', 'living_area', 'outdoor_space', 'neighborhood'];
    return areas[Math.floor(Math.random() * areas.length)];
  }

  getDefaultCampaignStrategy(propertyData) {
    return {
      messaging: `Discover your dream home at ${propertyData.location}`,
      target_audience: 'Home buyers and real estate investors',
      key_selling_points: ['Prime location', 'Modern amenities', 'Investment potential'],
      emotional_triggers: ['Security', 'Comfort', 'Pride of ownership'],
      value_propositions: ['Quality construction', 'Desirable neighborhood', 'Move-in ready'],
      content_pillars: ['Property features', 'Lifestyle benefits', 'Investment value', 'Community highlights']
    };
  }

  async getMixPostConfig(agentId) {
    // This would typically fetch from agent settings or environment variables
    return {
      apiUrl: process.env.MIXPOST_API_URL,
      apiToken: process.env.MIXPOST_API_TOKEN
    };
  }
}

module.exports = new SocialService();