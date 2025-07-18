const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/config');
const aiService = require('../ai/aiService');
const emailService = require('../email/emailService');
const analyticsService = require('../analytics/analyticsService');
const brandService = require('../brand/brandService');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

class ChatService {
  constructor() {
    // Chat session states
    this.sessionStates = {
      ACTIVE: 'active',
      LEAD_CAPTURE: 'lead_capture',
      COMPLETED: 'completed',
      ABANDONED: 'abandoned'
    };

    // Message types
    this.messageTypes = {
      USER: 'user',
      ASSISTANT: 'assistant',
      SYSTEM: 'system',
      LEAD_FORM: 'lead_form'
    };

    // Lead capture triggers
    this.leadTriggers = {
      VIEWING_REQUEST: 'viewing_request',
      CONTACT_REQUEST: 'contact_request',
      BROCHURE_REQUEST: 'brochure_request',
      PRICE_INQUIRY: 'price_inquiry',
      MORTGAGE_INQUIRY: 'mortgage_inquiry',
      SIMILAR_PROPERTIES: 'similar_properties'
    };

    // Session timeout (30 minutes)
    this.sessionTimeout = 30 * 60 * 1000;
  }

  /**
   * Initialize new chat session
   */
  async initializeSession(propertyId, agentId, visitorData = {}) {
    try {
      console.log(`Initializing chat session for property ${propertyId}`);

      // Get property data for context
      const property = await this.getPropertyContext(propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      // Get agent brand assets for persona
      const brandAssets = await brandService.resolveBrandAssets(agentId);

      // Build knowledge base
      const knowledgeBase = await this.buildKnowledgeBase(property, agentId);

      // Create session
      const sessionId = uuidv4();
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .insert([{
          id: sessionId,
          property_id: propertyId,
          agent_id: agentId,
          visitor_ip: visitorData.ip,
          visitor_user_agent: visitorData.userAgent,
          visitor_location: visitorData.location,
          session_state: this.sessionStates.ACTIVE,
          knowledge_base: knowledgeBase,
          brand_context: brandAssets,
          messages: [],
          metadata: {
            initialized_at: new Date().toISOString(),
            property_title: property.title,
            property_address: property.location
          }
        }])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create chat session: ${error.message}`);
      }

      // Generate welcome message
      const welcomeMessage = await this.generateWelcomeMessage(property, brandAssets);
      
      // Add welcome message to session
      await this.addMessage(sessionId, {
        type: this.messageTypes.ASSISTANT,
        content: welcomeMessage,
        timestamp: new Date().toISOString()
      });

      // Track session start
      await analyticsService.trackChatInteraction(propertyId, agentId, {
        action: 'session_started',
        sessionId: sessionId
      });

      console.log(`Chat session ${sessionId} initialized successfully`);
      return {
        sessionId,
        welcomeMessage,
        property: {
          id: property.id,
          title: property.title,
          location: property.location,
          price: property.price
        }
      };

    } catch (error) {
      console.error('Error initializing chat session:', error);
      throw error;
    }
  }

  /**
   * Process user message and generate AI response
   */
  async processMessage(sessionId, userMessage, visitorData = {}) {
    try {
      console.log(`Processing message for session ${sessionId}`);

      // Get session
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Chat session not found');
      }

      // Check if session is still active
      if (session.session_state !== this.sessionStates.ACTIVE) {
        throw new Error('Chat session is not active');
      }

      // Add user message
      await this.addMessage(sessionId, {
        type: this.messageTypes.USER,
        content: userMessage,
        timestamp: new Date().toISOString(),
        visitor_data: visitorData
      });

      // Check for lead capture triggers
      const leadTrigger = this.detectLeadTrigger(userMessage);
      
      if (leadTrigger) {
        console.log(`Lead trigger detected: ${leadTrigger}`);
        return await this.handleLeadCapture(sessionId, leadTrigger, userMessage);
      }

      // Generate AI response
      const aiResponse = await this.generateAIResponse(session, userMessage);

      // Add AI response
      await this.addMessage(sessionId, {
        type: this.messageTypes.ASSISTANT,
        content: aiResponse.content,
        timestamp: new Date().toISOString(),
        metadata: {
          model: aiResponse.model,
          tokens_used: aiResponse.tokensUsed,
          confidence: aiResponse.confidence
        }
      });

      // Track interaction
      await analyticsService.trackChatInteraction(session.property_id, session.agent_id, {
        action: 'message_processed',
        sessionId: sessionId,
        userMessage: userMessage.substring(0, 100), // First 100 chars for analytics
        aiResponseLength: aiResponse.content.length
      });

      return {
        response: aiResponse.content,
        sessionId: sessionId,
        leadTrigger: null
      };

    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  /**
   * Handle lead capture flow
   */
  async handleLeadCapture(sessionId, triggerType, userMessage) {
    try {
      console.log(`Handling lead capture for session ${sessionId}, trigger: ${triggerType}`);

      // Update session state
      await supabase
        .from('chat_sessions')
        .update({ 
          session_state: this.sessionStates.LEAD_CAPTURE,
          lead_trigger: triggerType,
          lead_trigger_message: userMessage
        })
        .eq('id', sessionId);

      // Generate lead capture message
      const leadCaptureMessage = this.generateLeadCaptureMessage(triggerType);

      // Add lead capture message
      await this.addMessage(sessionId, {
        type: this.messageTypes.ASSISTANT,
        content: leadCaptureMessage.message,
        timestamp: new Date().toISOString(),
        metadata: {
          lead_capture: true,
          trigger_type: triggerType
        }
      });

      return {
        response: leadCaptureMessage.message,
        sessionId: sessionId,
        leadTrigger: triggerType,
        leadForm: leadCaptureMessage.form
      };

    } catch (error) {
      console.error('Error handling lead capture:', error);
      throw error;
    }
  }

  /**
   * Process lead form submission
   */
  async processLeadSubmission(sessionId, leadData) {
    try {
      console.log(`Processing lead submission for session ${sessionId}`);

      // Get session
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Chat session not found');
      }

      // Validate lead data
      const validatedLead = this.validateLeadData(leadData);

      // Save lead information
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert([{
          session_id: sessionId,
          property_id: session.property_id,
          agent_id: session.agent_id,
          name: validatedLead.name,
          email: validatedLead.email,
          phone: validatedLead.phone,
          message: validatedLead.message,
          lead_source: 'chat',
          trigger_type: session.lead_trigger,
          metadata: {
            captured_at: new Date().toISOString(),
            session_messages: session.messages?.length || 0,
            visitor_data: session.visitor_location
          }
        }])
        .select('*')
        .single();

      if (leadError) {
        throw new Error(`Failed to save lead: ${leadError.message}`);
      }

      // Update session with lead info
      await supabase
        .from('chat_sessions')
        .update({ 
          session_state: this.sessionStates.COMPLETED,
          visitor_name: validatedLead.name,
          visitor_email: validatedLead.email,
          visitor_phone: validatedLead.phone,
          lead_captured_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      // Send brochure if requested
      if (session.lead_trigger === this.leadTriggers.BROCHURE_REQUEST) {
        await this.sendPropertyBrochure(session, validatedLead);
      }

      // Send lead notification to agent
      await this.sendLeadNotification(session, validatedLead, lead.id);

      // Track lead generation
      await analyticsService.trackLeadGeneration(session.property_id, session.agent_id, {
        source: 'chat',
        type: session.lead_trigger,
        contactMethod: validatedLead.email ? 'email' : 'phone',
        sessionId: sessionId,
        leadId: lead.id
      });

      // Generate thank you message
      const thankYouMessage = this.generateThankYouMessage(session.lead_trigger, validatedLead.name);

      // Add thank you message
      await this.addMessage(sessionId, {
        type: this.messageTypes.ASSISTANT,
        content: thankYouMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          lead_completed: true,
          lead_id: lead.id
        }
      });

      console.log(`Lead captured successfully: ${lead.id}`);
      return {
        success: true,
        leadId: lead.id,
        message: thankYouMessage,
        brochureSent: session.lead_trigger === this.leadTriggers.BROCHURE_REQUEST
      };

    } catch (error) {
      console.error('Error processing lead submission:', error);
      throw error;
    }
  }

  /**
   * Build knowledge base for property
   */
  async buildKnowledgeBase(property, agentId) {
    try {
      // Get property images
      const { data: images } = await supabase
        .from('property_images')
        .select('*')
        .eq('property_id', property.id)
        .order('display_order');

      // Get agent information
      const { data: agent } = await supabase
        .from('users')
        .select('full_name, email, phone, bio')
        .eq('id', agentId)
        .single();

      // Get neighborhood data (if available)
      const neighborhoodData = await this.getNeighborhoodData(property.location);

      // Build comprehensive knowledge base
      const knowledgeBase = {
        property: {
          id: property.id,
          title: property.title,
          description: property.description,
          location: property.location,
          price: property.price,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          square_feet: property.square_feet,
          property_type: property.property_type,
          listing_status: property.listing_status,
          features: property.features || [],
          amenities: property.amenities || [],
          year_built: property.year_built,
          lot_size: property.lot_size,
          parking: property.parking,
          heating_cooling: property.heating_cooling,
          flooring: property.flooring,
          appliances: property.appliances || [],
          images: images || []
        },
        agent: {
          name: agent?.full_name || 'Real Estate Professional',
          email: agent?.email || '',
          phone: agent?.phone || '',
          bio: agent?.bio || 'Experienced real estate professional dedicated to helping you find your perfect home.'
        },
        neighborhood: neighborhoodData,
        market_context: {
          last_updated: new Date().toISOString(),
          comparable_properties: [], // Could be populated with similar properties
          market_trends: {} // Could be populated with market data
        }
      };

      return knowledgeBase;

    } catch (error) {
      console.error('Error building knowledge base:', error);
      return {
        property: property,
        agent: { name: 'Real Estate Professional' },
        neighborhood: {},
        market_context: {}
      };
    }
  }

  /**
   * Generate AI response using RAG
   */
  async generateAIResponse(session, userMessage) {
    try {
      // Build dynamic system prompt
      const systemPrompt = this.buildSystemPrompt(session.knowledge_base, session.brand_context);

      // Get conversation history
      const conversationHistory = this.formatConversationHistory(session.messages);

      // Build complete prompt
      const prompt = `${systemPrompt}

Conversation History:
${conversationHistory}

User: ${userMessage}

Assistant:`;

      // Generate response using AI service
      const response = await aiService.generateContent(prompt, {
        model: 'claude-3-sonnet',
        maxTokens: 1000,
        temperature: 0.7,
        systemPrompt: 'You are a helpful real estate AI assistant. Provide accurate, helpful information about the property and assist with any questions.'
      });

      return {
        content: response,
        model: 'claude-3-sonnet',
        tokensUsed: response.length, // Approximate
        confidence: 0.9 // Could be calculated based on response quality
      };

    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Fallback response
      return {
        content: "I apologize, but I'm having trouble processing your request right now. Please try again or contact our agent directly for assistance.",
        model: 'fallback',
        tokensUsed: 0,
        confidence: 0.1
      };
    }
  }

  /**
   * Build dynamic system prompt
   */
  buildSystemPrompt(knowledgeBase, brandContext) {
    const property = knowledgeBase.property;
    const agent = knowledgeBase.agent;
    const neighborhood = knowledgeBase.neighborhood;

    return `You are an AI assistant for ${brandContext.company_name}, helping potential buyers learn about this property:

PROPERTY INFORMATION:
- Title: ${property.title}
- Location: ${property.location}
- Price: ${property.price}
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms}
- Square Feet: ${property.square_feet}
- Property Type: ${property.property_type}
- Status: ${property.listing_status}
- Description: ${property.description}

KEY FEATURES:
${property.features?.map(f => `- ${f}`).join('\n') || 'No specific features listed'}

AMENITIES:
${property.amenities?.map(a => `- ${a}`).join('\n') || 'No specific amenities listed'}

AGENT INFORMATION:
- Name: ${agent.name}
- Email: ${agent.email}
- Phone: ${agent.phone}
- Bio: ${agent.bio}

NEIGHBORHOOD CONTEXT:
${neighborhood.description || 'Great neighborhood with convenient access to local amenities.'}

BRAND PERSONA:
- Tone: ${brandContext.persona?.tone || 'Professional and friendly'}
- Style: ${brandContext.persona?.style || 'Helpful and informative'}
- Key Phrases: ${brandContext.persona?.key_phrases?.join(', ') || 'Quality service, trusted expertise'}

INSTRUCTIONS:
1. Answer questions about the property using the provided information
2. Be helpful, accurate, and professional
3. If asked about scheduling viewings, contact information, or brochures, guide them toward providing their contact details
4. Stay focused on this specific property and real estate topics
5. Use the brand tone and style consistently
6. If you don't know something, be honest and suggest contacting the agent
7. Encourage engagement and help move the conversation toward a potential viewing or contact

REMEMBER: Your goal is to provide helpful information while identifying serious buyers who might want to schedule a viewing or request more information.`;
  }

  /**
   * Detect lead capture triggers in user messages
   */
  detectLeadTrigger(message) {
    const lowerMessage = message.toLowerCase();
    
    // Define trigger patterns
    const triggers = {
      [this.leadTriggers.VIEWING_REQUEST]: [
        'schedule', 'viewing', 'visit', 'see the property', 'tour', 'appointment',
        'when can i', 'available to show', 'look at the house'
      ],
      [this.leadTriggers.CONTACT_REQUEST]: [
        'contact', 'call me', 'reach out', 'get in touch', 'speak with',
        'talk to agent', 'phone number', 'email'
      ],
      [this.leadTriggers.BROCHURE_REQUEST]: [
        'brochure', 'more information', 'details', 'send me', 'email me',
        'additional info', 'property details', 'fact sheet'
      ],
      [this.leadTriggers.PRICE_INQUIRY]: [
        'negotiate', 'best price', 'lower price', 'discount', 'offer',
        'price negotiable', 'final price'
      ],
      [this.leadTriggers.MORTGAGE_INQUIRY]: [
        'mortgage', 'financing', 'loan', 'monthly payment', 'down payment',
        'interest rate', 'qualify', 'pre-approved'
      ],
      [this.leadTriggers.SIMILAR_PROPERTIES]: [
        'similar properties', 'other listings', 'comparable', 'alternatives',
        'what else', 'other options'
      ]
    };

    // Check for triggers
    for (const [triggerType, patterns] of Object.entries(triggers)) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          return triggerType;
        }
      }
    }

    return null;
  }

  /**
   * Generate lead capture message
   */
  generateLeadCaptureMessage(triggerType) {
    const messages = {
      [this.leadTriggers.VIEWING_REQUEST]: {
        message: "I'd be happy to help you schedule a viewing! To arrange a convenient time, I'll need to connect you with our agent. Could you please provide your contact information?",
        form: {
          title: "Schedule a Viewing",
          fields: ['name', 'email', 'phone', 'preferred_time'],
          cta: "Schedule Viewing"
        }
      },
      [this.leadTriggers.BROCHURE_REQUEST]: {
        message: "I can send you a detailed property brochure with all the information, photos, and specifications. Please provide your email address and I'll send it right over!",
        form: {
          title: "Get Property Brochure",
          fields: ['name', 'email'],
          cta: "Send Brochure"
        }
      },
      [this.leadTriggers.CONTACT_REQUEST]: {
        message: "Our agent would love to speak with you directly about this property. Please share your contact information and they'll reach out to you soon!",
        form: {
          title: "Contact Our Agent",
          fields: ['name', 'email', 'phone', 'message'],
          cta: "Request Contact"
        }
      },
      [this.leadTriggers.PRICE_INQUIRY]: {
        message: "Great question about pricing! Our agent can discuss pricing details and any potential opportunities. Let's get you connected with them.",
        form: {
          title: "Discuss Pricing",
          fields: ['name', 'email', 'phone'],
          cta: "Discuss Price"
        }
      },
      [this.leadTriggers.MORTGAGE_INQUIRY]: {
        message: "I can help connect you with financing information and our preferred lenders. Let me get your contact details so our agent can provide you with mortgage guidance.",
        form: {
          title: "Financing Information",
          fields: ['name', 'email', 'phone'],
          cta: "Get Financing Info"
        }
      },
      [this.leadTriggers.SIMILAR_PROPERTIES]: {
        message: "I can help you explore similar properties in the area! Our agent has access to the latest listings and can show you comparable options. Let's get you connected.",
        form: {
          title: "Explore Similar Properties",
          fields: ['name', 'email', 'phone', 'preferences'],
          cta: "See Similar Properties"
        }
      }
    };

    return messages[triggerType] || {
      message: "I'd be happy to help you with more information! Please provide your contact details so our agent can assist you further.",
      form: {
        title: "Get More Information",
        fields: ['name', 'email', 'phone'],
        cta: "Get Information"
      }
    };
  }

  /**
   * Helper methods
   */
  async getSession(sessionId) {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch session: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  }

  async addMessage(sessionId, message) {
    try {
      // Get current messages
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const messages = session.messages || [];
      messages.push(message);

      // Update session with new message
      const { error } = await supabase
        .from('chat_sessions')
        .update({ 
          messages: messages,
          last_activity: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        throw new Error(`Failed to add message: ${error.message}`);
      }

    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  async getPropertyContext(propertyId) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch property: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error fetching property context:', error);
      return null;
    }
  }

  async getNeighborhoodData(location) {
    try {
      // This could integrate with external APIs for neighborhood data
      // For now, return basic structure
      return {
        description: `${location} is a desirable area with great amenities and convenient access to local attractions.`,
        schools: [],
        amenities: [],
        transportation: {},
        demographics: {}
      };

    } catch (error) {
      console.error('Error fetching neighborhood data:', error);
      return {};
    }
  }

  generateWelcomeMessage(property, brandAssets) {
    return `Hello! Welcome to ${property.title}. I'm here to help you learn more about this beautiful ${property.property_type} in ${property.location}. 

This property features ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms, and ${property.square_feet} square feet of living space, priced at ${property.price}.

Feel free to ask me anything about the property, neighborhood, or if you'd like to schedule a viewing. How can I help you today?`;
  }

  generateThankYouMessage(triggerType, name) {
    const messages = {
      [this.leadTriggers.BROCHURE_REQUEST]: `Thank you, ${name}! I've sent the property brochure to your email. Our agent will also follow up with you shortly to answer any questions you might have.`,
      [this.leadTriggers.VIEWING_REQUEST]: `Thank you, ${name}! Our agent will contact you soon to schedule a convenient viewing time. We look forward to showing you this beautiful property!`,
      [this.leadTriggers.CONTACT_REQUEST]: `Thank you, ${name}! Our agent will reach out to you shortly to discuss this property and answer any questions you may have.`
    };

    return messages[triggerType] || `Thank you, ${name}! Our agent will be in touch with you soon to provide the information you requested.`;
  }

  formatConversationHistory(messages) {
    if (!messages || messages.length === 0) {
      return 'No previous conversation.';
    }

    return messages
      .filter(msg => msg.type === this.messageTypes.USER || msg.type === this.messageTypes.ASSISTANT)
      .slice(-10) // Last 10 messages for context
      .map(msg => `${msg.type === this.messageTypes.USER ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  }

  validateLeadData(leadData) {
    const required = ['name', 'email'];
    const missing = required.filter(field => !leadData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadData.email)) {
      throw new Error('Invalid email format');
    }

    return {
      name: leadData.name.trim(),
      email: leadData.email.trim().toLowerCase(),
      phone: leadData.phone?.trim() || '',
      message: leadData.message?.trim() || '',
      preferences: leadData.preferences?.trim() || '',
      preferred_time: leadData.preferred_time?.trim() || ''
    };
  }

  async sendPropertyBrochure(session, leadData) {
    try {
      await emailService.sendPropertyBrochure(
        session.property_id,
        leadData.email,
        session.agent_id,
        {
          contact_name: leadData.name,
          source: 'chat_request'
        }
      );

      console.log(`Brochure sent to ${leadData.email} for property ${session.property_id}`);

    } catch (error) {
      console.error('Error sending brochure:', error);
    }
  }

  async sendLeadNotification(session, leadData, leadId) {
    try {
      await emailService.sendLeadNotification({
        ...leadData,
        property_title: session.metadata?.property_title,
        source: 'chat',
        lead_id: leadId,
        session_id: session.id
      }, session.agent_id);

      console.log(`Lead notification sent to agent ${session.agent_id}`);

    } catch (error) {
      console.error('Error sending lead notification:', error);
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 24); // 24 hours ago

      const { error } = await supabase
        .from('chat_sessions')
        .update({ session_state: this.sessionStates.ABANDONED })
        .eq('session_state', this.sessionStates.ACTIVE)
        .lt('last_activity', cutoffDate.toISOString());

      if (error) {
        console.error('Error cleaning up old sessions:', error);
      } else {
        console.log('Old chat sessions cleaned up successfully');
      }

    } catch (error) {
      console.error('Error in cleanup process:', error);
    }
  }

  /**
   * Get chat analytics
   */
  async getChatAnalytics(agentId, timeRange = '30d') {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange.replace('d', '')));

      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('agent_id', agentId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch chat analytics: ${error.message}`);
      }

      // Process analytics
      const analytics = {
        total_sessions: sessions.length,
        completed_sessions: sessions.filter(s => s.session_state === this.sessionStates.COMPLETED).length,
        leads_captured: sessions.filter(s => s.lead_captured_at).length,
        average_messages: 0,
        conversion_rate: 0,
        top_triggers: {},
        by_property: {}
      };

      // Calculate averages
      const totalMessages = sessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0);
      analytics.average_messages = sessions.length > 0 ? (totalMessages / sessions.length).toFixed(1) : 0;
      analytics.conversion_rate = sessions.length > 0 ? ((analytics.leads_captured / sessions.length) * 100).toFixed(1) : 0;

      // Group by trigger type
      sessions.forEach(session => {
        if (session.lead_trigger) {
          analytics.top_triggers[session.lead_trigger] = (analytics.top_triggers[session.lead_trigger] || 0) + 1;
        }

        // Group by property
        const propertyId = session.property_id;
        if (!analytics.by_property[propertyId]) {
          analytics.by_property[propertyId] = {
            sessions: 0,
            leads: 0,
            property_title: session.metadata?.property_title || 'Unknown Property'
          };
        }
        analytics.by_property[propertyId].sessions++;
        if (session.lead_captured_at) {
          analytics.by_property[propertyId].leads++;
        }
      });

      return analytics;

    } catch (error) {
      console.error('Error getting chat analytics:', error);
      throw error;
    }
  }
}

module.exports = new ChatService();