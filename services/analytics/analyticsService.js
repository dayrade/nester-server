const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/config');

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

class AnalyticsService {
  constructor() {
    // Analytics collection intervals
    this.intervals = {
      REAL_TIME: '1m',
      HOURLY: '1h',
      DAILY: '1d',
      WEEKLY: '7d',
      MONTHLY: '30d'
    };

    // Metric types
    this.metricTypes = {
      PROPERTY_VIEWS: 'property_views',
      SOCIAL_ENGAGEMENT: 'social_engagement',
      LEAD_GENERATION: 'lead_generation',
      CONTENT_PERFORMANCE: 'content_performance',
      CHAT_INTERACTIONS: 'chat_interactions',
      CONVERSION_RATES: 'conversion_rates'
    };
  }

  /**
   * Track property view event
   */
  async trackPropertyView(propertyId, agentId, viewData = {}) {
    try {
      const eventData = {
        property_id: propertyId,
        agent_id: agentId,
        event_type: 'property_view',
        event_data: {
          timestamp: new Date().toISOString(),
          user_agent: viewData.userAgent,
          ip_address: viewData.ipAddress,
          referrer: viewData.referrer,
          session_id: viewData.sessionId,
          page_url: viewData.pageUrl,
          view_duration: viewData.viewDuration || 0
        }
      };

      // Store in property_stats table
      await this.updatePropertyStats(propertyId, {
        total_views: { increment: 1 },
        last_viewed_at: new Date().toISOString()
      });

      // Store detailed event for analysis
      await this.storeAnalyticsEvent(eventData);

      return true;

    } catch (error) {
      console.error('Error tracking property view:', error);
      throw error;
    }
  }

  /**
   * Track social media engagement
   */
  async trackSocialEngagement(socialPostId, agentId, engagementData) {
    try {
      const { platform, engagement_type, value = 1 } = engagementData;

      // Update social_stats table
      const updateData = {};
      switch (engagement_type) {
        case 'like':
          updateData.total_likes = { increment: value };
          break;
        case 'comment':
          updateData.total_comments = { increment: value };
          break;
        case 'share':
          updateData.total_shares = { increment: value };
          break;
        case 'view':
          updateData.total_views = { increment: value };
          break;
        case 'click':
          updateData.total_clicks = { increment: value };
          break;
      }

      updateData.last_engagement_at = new Date().toISOString();

      await this.updateSocialStats(socialPostId, updateData);

      // Store detailed event
      const eventData = {
        social_post_id: socialPostId,
        agent_id: agentId,
        event_type: 'social_engagement',
        event_data: {
          platform,
          engagement_type,
          value,
          timestamp: new Date().toISOString()
        }
      };

      await this.storeAnalyticsEvent(eventData);

      return true;

    } catch (error) {
      console.error('Error tracking social engagement:', error);
      throw error;
    }
  }

  /**
   * Track lead generation event
   */
  async trackLeadGeneration(propertyId, agentId, leadData) {
    try {
      const eventData = {
        property_id: propertyId,
        agent_id: agentId,
        event_type: 'lead_generation',
        event_data: {
          lead_source: leadData.source, // 'chat', 'form', 'social', 'email'
          lead_type: leadData.type, // 'inquiry', 'viewing_request', 'download'
          contact_method: leadData.contactMethod,
          timestamp: new Date().toISOString(),
          lead_score: leadData.leadScore || 0
        }
      };

      // Update property stats
      await this.updatePropertyStats(propertyId, {
        total_leads: { increment: 1 },
        last_lead_at: new Date().toISOString()
      });

      await this.storeAnalyticsEvent(eventData);

      return true;

    } catch (error) {
      console.error('Error tracking lead generation:', error);
      throw error;
    }
  }

  /**
   * Track chat interaction
   */
  async trackChatInteraction(sessionId, agentId, propertyId, interactionData) {
    try {
      const eventData = {
        chat_session_id: sessionId,
        property_id: propertyId,
        agent_id: agentId,
        event_type: 'chat_interaction',
        event_data: {
          message_count: interactionData.messageCount,
          session_duration: interactionData.sessionDuration,
          lead_captured: interactionData.leadCaptured || false,
          satisfaction_score: interactionData.satisfactionScore,
          timestamp: new Date().toISOString()
        }
      };

      await this.storeAnalyticsEvent(eventData);

      return true;

    } catch (error) {
      console.error('Error tracking chat interaction:', error);
      throw error;
    }
  }

  /**
   * Get property performance analytics
   */
  async getPropertyAnalytics(propertyId, agentId, timeRange = '30d') {
    try {
      const startDate = this.getStartDate(timeRange);

      // Get property stats
      const { data: propertyStats, error: statsError } = await supabase
        .from('property_stats')
        .select('*')
        .eq('property_id', propertyId)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch property stats: ${statsError.message}`);
      }

      // Get time-series data
      const { data: events, error: eventsError } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('property_id', propertyId)
        .eq('agent_id', agentId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (eventsError) {
        throw new Error(`Failed to fetch analytics events: ${eventsError.message}`);
      }

      // Process events into metrics
      const metrics = this.processEventsIntoMetrics(events, timeRange);

      return {
        property_id: propertyId,
        time_range: timeRange,
        summary: propertyStats || this.getDefaultPropertyStats(),
        metrics,
        trends: this.calculateTrends(metrics),
        performance_score: this.calculatePerformanceScore(propertyStats, metrics)
      };

    } catch (error) {
      console.error('Error getting property analytics:', error);
      throw error;
    }
  }

  /**
   * Get agent dashboard analytics
   */
  async getAgentDashboard(agentId, timeRange = '30d') {
    try {
      const startDate = this.getStartDate(timeRange);

      // Get all properties for agent
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, title, created_at')
        .eq('agent_id', agentId);

      if (propertiesError) {
        throw new Error(`Failed to fetch properties: ${propertiesError.message}`);
      }

      // Get aggregated stats
      const propertyIds = properties.map(p => p.id);
      
      const [propertyStats, socialStats, events] = await Promise.all([
        this.getAggregatedPropertyStats(propertyIds),
        this.getAggregatedSocialStats(agentId),
        this.getAgentEvents(agentId, startDate)
      ]);

      // Process into dashboard metrics
      const dashboard = {
        agent_id: agentId,
        time_range: timeRange,
        summary: {
          total_properties: properties.length,
          total_views: propertyStats.total_views || 0,
          total_leads: propertyStats.total_leads || 0,
          total_social_engagement: socialStats.total_engagement || 0,
          conversion_rate: this.calculateConversionRate(propertyStats.total_views, propertyStats.total_leads)
        },
        top_performing_properties: await this.getTopPerformingProperties(agentId, timeRange, 5),
        social_performance: await this.getSocialPerformance(agentId, timeRange),
        lead_sources: this.analyzeLeadSources(events),
        engagement_trends: this.calculateEngagementTrends(events, timeRange),
        recommendations: await this.generateRecommendations(agentId, propertyStats, socialStats)
      };

      return dashboard;

    } catch (error) {
      console.error('Error getting agent dashboard:', error);
      throw error;
    }
  }

  /**
   * Get social media performance analytics
   */
  async getSocialPerformance(agentId, timeRange = '30d') {
    try {
      const startDate = this.getStartDate(timeRange);

      const { data: socialPosts, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          social_stats(*)
        `)
        .eq('agent_id', agentId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch social performance: ${error.message}`);
      }

      // Aggregate by platform
      const platformPerformance = {};
      let totalEngagement = 0;
      let totalReach = 0;

      socialPosts.forEach(post => {
        const platform = post.platform;
        const stats = post.social_stats[0] || {};
        
        if (!platformPerformance[platform]) {
          platformPerformance[platform] = {
            posts: 0,
            total_likes: 0,
            total_comments: 0,
            total_shares: 0,
            total_views: 0,
            total_clicks: 0,
            engagement_rate: 0
          };
        }

        platformPerformance[platform].posts += 1;
        platformPerformance[platform].total_likes += stats.total_likes || 0;
        platformPerformance[platform].total_comments += stats.total_comments || 0;
        platformPerformance[platform].total_shares += stats.total_shares || 0;
        platformPerformance[platform].total_views += stats.total_views || 0;
        platformPerformance[platform].total_clicks += stats.total_clicks || 0;

        const postEngagement = (stats.total_likes || 0) + (stats.total_comments || 0) + (stats.total_shares || 0);
        totalEngagement += postEngagement;
        totalReach += stats.total_views || 0;
      });

      // Calculate engagement rates
      Object.keys(platformPerformance).forEach(platform => {
        const data = platformPerformance[platform];
        const totalEngagementForPlatform = data.total_likes + data.total_comments + data.total_shares;
        data.engagement_rate = data.total_views > 0 ? (totalEngagementForPlatform / data.total_views) * 100 : 0;
      });

      return {
        time_range: timeRange,
        total_posts: socialPosts.length,
        total_engagement: totalEngagement,
        total_reach: totalReach,
        overall_engagement_rate: totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0,
        platform_performance: platformPerformance,
        top_posts: this.getTopPosts(socialPosts, 5),
        content_type_performance: this.analyzeContentTypePerformance(socialPosts)
      };

    } catch (error) {
      console.error('Error getting social performance:', error);
      throw error;
    }
  }

  /**
   * Generate performance recommendations
   */
  async generateRecommendations(agentId, propertyStats, socialStats) {
    const recommendations = [];

    // Property performance recommendations
    if (propertyStats.total_views < 100) {
      recommendations.push({
        type: 'property_visibility',
        priority: 'high',
        title: 'Increase Property Visibility',
        description: 'Your properties have low view counts. Consider improving SEO, social media promotion, or property descriptions.',
        action: 'optimize_listings'
      });
    }

    // Conversion rate recommendations
    const conversionRate = this.calculateConversionRate(propertyStats.total_views, propertyStats.total_leads);
    if (conversionRate < 2) {
      recommendations.push({
        type: 'conversion_optimization',
        priority: 'medium',
        title: 'Improve Lead Conversion',
        description: 'Your conversion rate is below average. Consider improving property photos, descriptions, or call-to-action placement.',
        action: 'optimize_conversion'
      });
    }

    // Social media recommendations
    if (socialStats.total_engagement < 50) {
      recommendations.push({
        type: 'social_engagement',
        priority: 'medium',
        title: 'Boost Social Media Engagement',
        description: 'Your social media posts have low engagement. Try posting at different times or using more engaging content formats.',
        action: 'improve_social_strategy'
      });
    }

    return recommendations;
  }

  /**
   * Store analytics event
   */
  async storeAnalyticsEvent(eventData) {
    try {
      const { error } = await supabase
        .from('analytics_events')
        .insert([{
          ...eventData,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        throw new Error(`Failed to store analytics event: ${error.message}`);
      }

    } catch (error) {
      console.error('Error storing analytics event:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
   * Update property stats
   */
  async updatePropertyStats(propertyId, updateData) {
    try {
      // Handle increment operations
      const processedData = {};
      Object.keys(updateData).forEach(key => {
        if (updateData[key] && typeof updateData[key] === 'object' && updateData[key].increment) {
          // For increment operations, we need to use raw SQL
          processedData[key] = supabase.rpc('increment_stat', {
            property_id: propertyId,
            stat_name: key,
            increment_value: updateData[key].increment
          });
        } else {
          processedData[key] = updateData[key];
        }
      });

      const { error } = await supabase
        .from('property_stats')
        .upsert({
          property_id: propertyId,
          ...processedData,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to update property stats: ${error.message}`);
      }

    } catch (error) {
      console.error('Error updating property stats:', error);
    }
  }

  /**
   * Update social stats
   */
  async updateSocialStats(socialPostId, updateData) {
    try {
      const { error } = await supabase
        .from('social_stats')
        .upsert({
          social_post_id: socialPostId,
          ...updateData,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to update social stats: ${error.message}`);
      }

    } catch (error) {
      console.error('Error updating social stats:', error);
    }
  }

  /**
   * Helper methods
   */
  getStartDate(timeRange) {
    const now = new Date();
    switch (timeRange) {
      case '1d': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  calculateConversionRate(views, leads) {
    return views > 0 ? ((leads / views) * 100).toFixed(2) : 0;
  }

  calculatePerformanceScore(propertyStats, metrics) {
    // Simple scoring algorithm - can be enhanced
    let score = 0;
    
    if (propertyStats) {
      score += Math.min((propertyStats.total_views || 0) / 100, 1) * 30; // Max 30 points for views
      score += Math.min((propertyStats.total_leads || 0) / 10, 1) * 40; // Max 40 points for leads
      score += Math.min(this.calculateConversionRate(propertyStats.total_views, propertyStats.total_leads) / 5, 1) * 30; // Max 30 points for conversion rate
    }
    
    return Math.round(score);
  }

  processEventsIntoMetrics(events, timeRange) {
    // Group events by type and time period
    const metrics = {
      views_over_time: [],
      leads_over_time: [],
      engagement_over_time: []
    };

    // Process events into time-series data
    // This is a simplified version - can be enhanced with proper time bucketing
    events.forEach(event => {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      
      switch (event.event_type) {
        case 'property_view':
          this.addToTimeSeries(metrics.views_over_time, date, 1);
          break;
        case 'lead_generation':
          this.addToTimeSeries(metrics.leads_over_time, date, 1);
          break;
        case 'social_engagement':
          this.addToTimeSeries(metrics.engagement_over_time, date, 1);
          break;
      }
    });

    return metrics;
  }

  addToTimeSeries(series, date, value) {
    const existing = series.find(item => item.date === date);
    if (existing) {
      existing.value += value;
    } else {
      series.push({ date, value });
    }
  }

  calculateTrends(metrics) {
    // Calculate trends for each metric
    return {
      views_trend: this.calculateTrend(metrics.views_over_time),
      leads_trend: this.calculateTrend(metrics.leads_over_time),
      engagement_trend: this.calculateTrend(metrics.engagement_over_time)
    };
  }

  calculateTrend(timeSeries) {
    if (timeSeries.length < 2) return 0;
    
    const firstHalf = timeSeries.slice(0, Math.floor(timeSeries.length / 2));
    const secondHalf = timeSeries.slice(Math.floor(timeSeries.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, item) => sum + item.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, item) => sum + item.value, 0) / secondHalf.length;
    
    return firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg * 100).toFixed(2) : 0;
  }

  getDefaultPropertyStats() {
    return {
      total_views: 0,
      total_leads: 0,
      conversion_rate: 0,
      last_viewed_at: null,
      last_lead_at: null
    };
  }

  async getAggregatedPropertyStats(propertyIds) {
    if (propertyIds.length === 0) return { total_views: 0, total_leads: 0 };
    
    const { data, error } = await supabase
      .from('property_stats')
      .select('total_views, total_leads')
      .in('property_id', propertyIds);

    if (error) return { total_views: 0, total_leads: 0 };

    return data.reduce((acc, stat) => ({
      total_views: acc.total_views + (stat.total_views || 0),
      total_leads: acc.total_leads + (stat.total_leads || 0)
    }), { total_views: 0, total_leads: 0 });
  }

  async getAggregatedSocialStats(agentId) {
    const { data, error } = await supabase
      .from('social_stats')
      .select(`
        total_likes,
        total_comments,
        total_shares,
        social_posts!inner(agent_id)
      `)
      .eq('social_posts.agent_id', agentId);

    if (error) return { total_engagement: 0 };

    const totalEngagement = data.reduce((acc, stat) => 
      acc + (stat.total_likes || 0) + (stat.total_comments || 0) + (stat.total_shares || 0), 0
    );

    return { total_engagement: totalEngagement };
  }

  async getAgentEvents(agentId, startDate) {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString());

    return error ? [] : data;
  }

  async getTopPerformingProperties(agentId, timeRange, limit) {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        id,
        title,
        property_stats(total_views, total_leads)
      `)
      .eq('agent_id', agentId)
      .order('property_stats.total_views', { ascending: false })
      .limit(limit);

    return error ? [] : data;
  }

  analyzeLeadSources(events) {
    const leadEvents = events.filter(e => e.event_type === 'lead_generation');
    const sources = {};
    
    leadEvents.forEach(event => {
      const source = event.event_data?.lead_source || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    });
    
    return sources;
  }

  calculateEngagementTrends(events, timeRange) {
    // Simplified engagement trend calculation
    const engagementEvents = events.filter(e => 
      ['property_view', 'social_engagement', 'chat_interaction'].includes(e.event_type)
    );
    
    return this.processEventsIntoMetrics(engagementEvents, timeRange);
  }

  getTopPosts(socialPosts, limit) {
    return socialPosts
      .sort((a, b) => {
        const aEngagement = (a.social_stats[0]?.total_likes || 0) + 
                           (a.social_stats[0]?.total_comments || 0) + 
                           (a.social_stats[0]?.total_shares || 0);
        const bEngagement = (b.social_stats[0]?.total_likes || 0) + 
                           (b.social_stats[0]?.total_comments || 0) + 
                           (b.social_stats[0]?.total_shares || 0);
        return bEngagement - aEngagement;
      })
      .slice(0, limit)
      .map(post => ({
        id: post.id,
        content: post.content_text?.substring(0, 100) + '...',
        platform: post.platform,
        engagement: (post.social_stats[0]?.total_likes || 0) + 
                   (post.social_stats[0]?.total_comments || 0) + 
                   (post.social_stats[0]?.total_shares || 0),
        created_at: post.created_at
      }));
  }

  analyzeContentTypePerformance(socialPosts) {
    const contentTypes = {};
    
    socialPosts.forEach(post => {
      const type = post.content_type || 'text';
      if (!contentTypes[type]) {
        contentTypes[type] = {
          posts: 0,
          total_engagement: 0,
          avg_engagement: 0
        };
      }
      
      contentTypes[type].posts += 1;
      const engagement = (post.social_stats[0]?.total_likes || 0) + 
                        (post.social_stats[0]?.total_comments || 0) + 
                        (post.social_stats[0]?.total_shares || 0);
      contentTypes[type].total_engagement += engagement;
    });
    
    // Calculate averages
    Object.keys(contentTypes).forEach(type => {
      contentTypes[type].avg_engagement = 
        contentTypes[type].total_engagement / contentTypes[type].posts;
    });
    
    return contentTypes;
  }
}

module.exports = new AnalyticsService();