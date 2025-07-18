const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/config');
const aiService = require('../ai/aiService');
const brandService = require('../brand/brandService');
const axios = require('axios');
const puppeteer = require('puppeteer');

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

class EmailService {
  constructor() {
    this.brevoApiUrl = 'https://api.brevo.com/v3';
    this.brevoApiKey = process.env.BREVO_API_KEY;
    
    // Email template types
    this.templateTypes = {
      WELCOME: 'welcome',
      PROPERTY_INQUIRY: 'property_inquiry',
      VIEWING_CONFIRMATION: 'viewing_confirmation',
      BROCHURE_DELIVERY: 'brochure_delivery',
      FOLLOW_UP: 'follow_up',
      NEWSLETTER: 'newsletter',
      LEAD_NOTIFICATION: 'lead_notification',
      CHAT_TRANSCRIPT: 'chat_transcript',
      MARKET_UPDATE: 'market_update',
      THANK_YOU: 'thank_you'
    };

    // Email categories for organization
    this.categories = {
      TRANSACTIONAL: 'transactional',
      MARKETING: 'marketing',
      NOTIFICATION: 'notification'
    };
  }

  /**
   * Generate and upload branded email templates
   */
  async generateBrandedTemplates(agentId) {
    try {
      console.log(`Generating branded email templates for agent ${agentId}`);

      // Get brand assets
      const brandAssets = await brandService.resolveBrandAssets(agentId);

      const generatedTemplates = [];

      // Generate templates for each type
      for (const [templateKey, templateType] of Object.entries(this.templateTypes)) {
        try {
          const template = await this.generateSingleTemplate(
            agentId,
            templateType,
            brandAssets
          );

          // Upload to Brevo
          const brevoTemplate = await this.uploadTemplateToBrevo(
            template,
            agentId
          );

          // Save template record
          const savedTemplate = await this.saveTemplateRecord(
            agentId,
            templateType,
            template,
            brevoTemplate.id
          );

          generatedTemplates.push(savedTemplate);
          
          console.log(`Generated template: ${templateType}`);
          
        } catch (error) {
          console.error(`Failed to generate template ${templateType}:`, error);
        }
      }

      console.log(`Generated ${generatedTemplates.length} email templates`);
      return generatedTemplates;

    } catch (error) {
      console.error('Error generating branded templates:', error);
      throw error;
    }
  }

  /**
   * Generate single email template
   */
  async generateSingleTemplate(agentId, templateType, brandAssets) {
    try {
      // Get template configuration
      const templateConfig = this.getTemplateConfig(templateType);

      // Generate content using AI
      const contentPrompt = this.buildTemplatePrompt(
        templateType,
        templateConfig,
        brandAssets
      );

      const aiContent = await aiService.generateContent(contentPrompt, {
        model: 'claude-3-sonnet',
        maxTokens: 2000,
        temperature: 0.7
      });

      const parsedContent = JSON.parse(aiContent);

      // Generate HTML template
      const htmlTemplate = this.generateHtmlTemplate(
        parsedContent,
        brandAssets,
        templateConfig
      );

      return {
        type: templateType,
        subject: parsedContent.subject,
        html_content: htmlTemplate,
        text_content: parsedContent.text_content,
        variables: parsedContent.variables || [],
        category: templateConfig.category,
        metadata: {
          generated_at: new Date().toISOString(),
          brand_assets_used: brandAssets.brand_tier,
          ai_model: 'claude-3-sonnet'
        }
      };

    } catch (error) {
      console.error(`Error generating template ${templateType}:`, error);
      throw error;
    }
  }

  /**
   * Build AI prompt for template generation
   */
  buildTemplatePrompt(templateType, templateConfig, brandAssets) {
    return `
Generate a professional email template for: ${templateType}

Template Purpose: ${templateConfig.description}
Category: ${templateConfig.category}
Tone: ${templateConfig.tone}

Brand Guidelines:
- Company: ${brandAssets.company_name}
- Tone: ${brandAssets.persona.tone}
- Style: ${brandAssets.persona.style}
- Key Phrases: ${brandAssets.persona.key_phrases?.join(', ')}
- Avoid: ${brandAssets.persona.phrases_to_avoid?.join(', ')}

Requirements:
1. Professional and branded email content
2. Clear subject line
3. Personalized greeting using {{contact_name}} variable
4. Relevant content for ${templateType}
5. Professional signature
6. Clear call-to-action
7. Mobile-friendly design considerations

Include these dynamic variables where appropriate:
- {{contact_name}} - Recipient's name
- {{agent_name}} - Agent's name
- {{agent_email}} - Agent's email
- {{agent_phone}} - Agent's phone
- {{property_title}} - Property title
- {{property_address}} - Property address
- {{property_price}} - Property price
- {{company_name}} - Company name
- {{website_url}} - Website URL

Generate:
1. Email subject line
2. HTML-friendly content structure
3. Plain text version
4. List of variables used

Return as JSON: {
  "subject": "email subject",
  "html_structure": "main content with HTML structure",
  "text_content": "plain text version",
  "variables": ["list of variables used"],
  "cta_text": "call to action text",
  "cta_url": "call to action URL placeholder"
}
`;
  }

  /**
   * Generate HTML email template
   */
  generateHtmlTemplate(content, brandAssets, templateConfig) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.subject}</title>
    <style>
        /* Reset styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        /* Base styles */
        body {
            font-family: ${brandAssets.typography.font_family}, Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f8f9fa;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        /* Header */
        .email-header {
            background: linear-gradient(135deg, ${brandAssets.colors.primary} 0%, ${brandAssets.colors.secondary} 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        
        .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 15px;
        }
        
        .company-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .tagline {
            font-size: 14px;
            opacity: 0.9;
        }
        
        /* Content */
        .email-content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: ${brandAssets.colors.primary};
        }
        
        .main-content {
            font-size: 16px;
            margin-bottom: 30px;
            line-height: 1.8;
        }
        
        .main-content p {
            margin-bottom: 15px;
        }
        
        /* Call to Action */
        .cta-section {
            text-align: center;
            margin: 30px 0;
        }
        
        .cta-button {
            display: inline-block;
            background-color: ${brandAssets.colors.primary};
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            font-size: 16px;
            transition: background-color 0.3s ease;
        }
        
        .cta-button:hover {
            background-color: ${brandAssets.colors.secondary};
        }
        
        /* Property highlight (for property-related emails) */
        .property-highlight {
            background-color: #f8f9fa;
            border-left: 4px solid ${brandAssets.colors.primary};
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 5px 5px 0;
        }
        
        .property-title {
            font-size: 18px;
            font-weight: bold;
            color: ${brandAssets.colors.primary};
            margin-bottom: 10px;
        }
        
        .property-details {
            font-size: 14px;
            color: #666;
        }
        
        /* Footer */
        .email-footer {
            background-color: #f8f9fa;
            padding: 30px 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        
        .agent-signature {
            margin-bottom: 20px;
        }
        
        .agent-name {
            font-size: 18px;
            font-weight: bold;
            color: ${brandAssets.colors.primary};
            margin-bottom: 5px;
        }
        
        .agent-title {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
        }
        
        .contact-info {
            font-size: 14px;
            color: #666;
        }
        
        .contact-info a {
            color: ${brandAssets.colors.primary};
            text-decoration: none;
        }
        
        .social-links {
            margin: 20px 0;
        }
        
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: ${brandAssets.colors.primary};
            text-decoration: none;
        }
        
        .disclaimer {
            font-size: 12px;
            color: #999;
            margin-top: 20px;
            line-height: 1.4;
        }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
            }
            
            .email-content {
                padding: 20px 15px !important;
            }
            
            .email-header {
                padding: 20px 15px !important;
            }
            
            .company-name {
                font-size: 20px !important;
            }
            
            .main-content {
                font-size: 14px !important;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="email-header">
            ${brandAssets.logo_path ? `<img src="{{logo_url}}" alt="${brandAssets.company_name}" class="logo">` : ''}
            <div class="company-name">{{company_name}}</div>
            <div class="tagline">Your Trusted Real Estate Partner</div>
        </div>
        
        <!-- Content -->
        <div class="email-content">
            <div class="greeting">Hello {{contact_name}},</div>
            
            <div class="main-content">
                ${content.html_structure}
            </div>
            
            ${templateConfig.includePropertyHighlight ? `
            <div class="property-highlight">
                <div class="property-title">{{property_title}}</div>
                <div class="property-details">
                    <strong>Address:</strong> {{property_address}}<br>
                    <strong>Price:</strong> {{property_price}}
                </div>
            </div>
            ` : ''}
            
            ${content.cta_text ? `
            <div class="cta-section">
                <a href="${content.cta_url || '{{cta_url}}'}" class="cta-button">${content.cta_text}</a>
            </div>
            ` : ''}
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
            <div class="agent-signature">
                <div class="agent-name">{{agent_name}}</div>
                <div class="agent-title">Real Estate Professional</div>
                <div class="contact-info">
                    <a href="mailto:{{agent_email}}">{{agent_email}}</a> | 
                    <a href="tel:{{agent_phone}}">{{agent_phone}}</a>
                </div>
            </div>
            
            <div class="social-links">
                <a href="{{website_url}}">Visit Our Website</a>
            </div>
            
            <div class="disclaimer">
                This email was sent by {{company_name}}. If you no longer wish to receive these emails, 
                you can <a href="{{unsubscribe_url}}">unsubscribe here</a>.
                <br><br>
                {{company_address}}
            </div>
        </div>
    </div>
</body>
</html>
`;
  }

  /**
   * Upload template to Brevo
   */
  async uploadTemplateToBrevo(template, agentId) {
    try {
      const templateData = {
        name: `${template.type}_${agentId}_${Date.now()}`,
        subject: template.subject,
        htmlContent: template.html_content,
        textContent: template.text_content,
        isActive: true,
        tag: `agent_${agentId}`,
        category: template.category
      };

      const response = await axios.post(
        `${this.brevoApiUrl}/smtp/templates`,
        templateData,
        {
          headers: {
            'api-key': this.brevoApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;

    } catch (error) {
      console.error('Error uploading template to Brevo:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send transactional email
   */
  async sendTransactionalEmail(templateType, recipientEmail, templateData, agentId) {
    try {
      // Get template
      const template = await this.getAgentTemplate(agentId, templateType);
      
      if (!template) {
        throw new Error(`Template ${templateType} not found for agent ${agentId}`);
      }

      // Prepare email data
      const emailData = {
        templateId: template.brevo_template_id,
        to: [{ email: recipientEmail, name: templateData.contact_name || recipientEmail }],
        params: templateData,
        replyTo: {
          email: templateData.agent_email,
          name: templateData.agent_name
        },
        tags: [`agent_${agentId}`, templateType]
      };

      // Send via Brevo
      const response = await axios.post(
        `${this.brevoApiUrl}/smtp/email`,
        emailData,
        {
          headers: {
            'api-key': this.brevoApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      // Log email sent
      await this.logEmailSent({
        agent_id: agentId,
        template_type: templateType,
        recipient_email: recipientEmail,
        brevo_message_id: response.data.messageId,
        status: 'sent',
        template_data: templateData
      });

      return response.data;

    } catch (error) {
      console.error('Error sending transactional email:', error.response?.data || error.message);
      
      // Log failed email
      await this.logEmailSent({
        agent_id: agentId,
        template_type: templateType,
        recipient_email: recipientEmail,
        status: 'failed',
        error_message: error.message,
        template_data: templateData
      });
      
      throw error;
    }
  }

  /**
   * Send property brochure
   */
  async sendPropertyBrochure(propertyId, recipientEmail, agentId, additionalData = {}) {
    try {
      // Get property data
      const { data: property, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch property: ${error.message}`);
      }

      // Get agent data
      const { data: agent } = await supabase
        .from('users')
        .select('*')
        .eq('id', agentId)
        .single();

      // Prepare template data
      const templateData = {
        contact_name: additionalData.contact_name || 'Valued Client',
        agent_name: agent?.full_name || 'Real Estate Agent',
        agent_email: agent?.email || '',
        agent_phone: agent?.phone || '',
        property_title: property.title,
        property_address: property.location,
        property_price: property.price,
        company_name: additionalData.company_name || 'Nester',
        website_url: additionalData.website_url || '',
        ...additionalData
      };

      // Send brochure email
      const result = await this.sendTransactionalEmail(
        this.templateTypes.BROCHURE_DELIVERY,
        recipientEmail,
        templateData,
        agentId
      );

      // Track lead generation
      const analyticsService = require('../analytics/analyticsService');
      await analyticsService.trackLeadGeneration(propertyId, agentId, {
        source: 'email',
        type: 'brochure_request',
        contactMethod: 'email'
      });

      return result;

    } catch (error) {
      console.error('Error sending property brochure:', error);
      throw error;
    }
  }

  /**
   * Send lead notification to agent
   */
  async sendLeadNotification(leadData, agentId) {
    try {
      // Get agent data
      const { data: agent } = await supabase
        .from('users')
        .select('*')
        .eq('id', agentId)
        .single();

      if (!agent) {
        throw new Error('Agent not found');
      }

      // Prepare template data
      const templateData = {
        contact_name: agent.full_name,
        agent_name: agent.full_name,
        agent_email: agent.email,
        lead_name: leadData.name || 'Unknown',
        lead_email: leadData.email || 'Not provided',
        lead_phone: leadData.phone || 'Not provided',
        lead_message: leadData.message || 'No message provided',
        property_title: leadData.property_title || '',
        lead_source: leadData.source || 'Website',
        timestamp: new Date().toLocaleString(),
        company_name: leadData.company_name || 'Nester'
      };

      // Send notification
      const result = await this.sendTransactionalEmail(
        this.templateTypes.LEAD_NOTIFICATION,
        agent.email,
        templateData,
        agentId
      );

      return result;

    } catch (error) {
      console.error('Error sending lead notification:', error);
      throw error;
    }
  }

  /**
   * Send chat transcript
   */
  async sendChatTranscript(sessionId, recipientEmail, agentId) {
    try {
      // Get chat session data
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch chat session: ${error.message}`);
      }

      // Format chat transcript
      const transcript = this.formatChatTranscript(session.messages);

      // Get agent data
      const { data: agent } = await supabase
        .from('users')
        .select('*')
        .eq('id', agentId)
        .single();

      // Prepare template data
      const templateData = {
        contact_name: session.visitor_name || 'Valued Client',
        agent_name: agent?.full_name || 'Real Estate Agent',
        agent_email: agent?.email || '',
        chat_transcript: transcript,
        session_date: new Date(session.created_at).toLocaleDateString(),
        property_title: session.property_title || '',
        company_name: 'Nester'
      };

      // Send transcript
      const result = await this.sendTransactionalEmail(
        this.templateTypes.CHAT_TRANSCRIPT,
        recipientEmail,
        templateData,
        agentId
      );

      return result;

    } catch (error) {
      console.error('Error sending chat transcript:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  getTemplateConfig(templateType) {
    const configs = {
      [this.templateTypes.WELCOME]: {
        description: 'Welcome new users to the platform',
        category: this.categories.TRANSACTIONAL,
        tone: 'friendly',
        includePropertyHighlight: false
      },
      [this.templateTypes.PROPERTY_INQUIRY]: {
        description: 'Response to property inquiries',
        category: this.categories.TRANSACTIONAL,
        tone: 'professional',
        includePropertyHighlight: true
      },
      [this.templateTypes.BROCHURE_DELIVERY]: {
        description: 'Deliver property brochure to interested clients',
        category: this.categories.TRANSACTIONAL,
        tone: 'professional',
        includePropertyHighlight: true
      },
      [this.templateTypes.LEAD_NOTIFICATION]: {
        description: 'Notify agents of new leads',
        category: this.categories.NOTIFICATION,
        tone: 'urgent',
        includePropertyHighlight: false
      },
      [this.templateTypes.FOLLOW_UP]: {
        description: 'Follow up with potential clients',
        category: this.categories.MARKETING,
        tone: 'friendly',
        includePropertyHighlight: true
      }
    };

    return configs[templateType] || {
      description: 'General email template',
      category: this.categories.TRANSACTIONAL,
      tone: 'professional',
      includePropertyHighlight: false
    };
  }

  async saveTemplateRecord(agentId, templateType, template, brevoTemplateId) {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .insert([{
          agent_id: agentId,
          template_type: templateType,
          brevo_template_id: brevoTemplateId,
          subject: template.subject,
          html_content: template.html_content,
          text_content: template.text_content,
          variables: template.variables,
          category: template.category,
          metadata: template.metadata,
          is_active: true
        }])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to save template record: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error saving template record:', error);
      throw error;
    }
  }

  async getAgentTemplate(agentId, templateType) {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('agent_id', agentId)
        .eq('template_type', templateType)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch template: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error fetching agent template:', error);
      return null;
    }
  }

  async logEmailSent(emailData) {
    try {
      const { error } = await supabase
        .from('email_logs')
        .insert([{
          ...emailData,
          sent_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error logging email:', error);
      }

    } catch (error) {
      console.error('Error logging email:', error);
    }
  }

  formatChatTranscript(messages) {
    if (!messages || !Array.isArray(messages)) {
      return 'No messages in this conversation.';
    }

    return messages.map(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString();
      const sender = msg.sender === 'user' ? 'Visitor' : 'AI Assistant';
      return `[${timestamp}] ${sender}: ${msg.content}`;
    }).join('\n\n');
  }

  /**
   * Get email analytics
   */
  async getEmailAnalytics(agentId, timeRange = '30d') {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange.replace('d', '')));

      const { data: emailLogs, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('agent_id', agentId)
        .gte('sent_at', startDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch email analytics: ${error.message}`);
      }

      // Process analytics
      const analytics = {
        total_sent: emailLogs.length,
        successful: emailLogs.filter(log => log.status === 'sent').length,
        failed: emailLogs.filter(log => log.status === 'failed').length,
        by_template: {},
        by_day: {}
      };

      // Group by template type
      emailLogs.forEach(log => {
        const templateType = log.template_type;
        if (!analytics.by_template[templateType]) {
          analytics.by_template[templateType] = { sent: 0, failed: 0 };
        }
        analytics.by_template[templateType][log.status === 'sent' ? 'sent' : 'failed']++;

        // Group by day
        const day = new Date(log.sent_at).toISOString().split('T')[0];
        if (!analytics.by_day[day]) {
          analytics.by_day[day] = { sent: 0, failed: 0 };
        }
        analytics.by_day[day][log.status === 'sent' ? 'sent' : 'failed']++;
      });

      analytics.success_rate = analytics.total_sent > 0 
        ? ((analytics.successful / analytics.total_sent) * 100).toFixed(2)
        : 0;

      return analytics;

    } catch (error) {
      console.error('Error getting email analytics:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();