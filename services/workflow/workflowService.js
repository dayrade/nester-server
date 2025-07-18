const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/config');
const logger = require('../../utils/logger');
const aiService = require('../ai/aiService');
const socialService = require('../social/socialService');
const emailService = require('../email/emailService');
const brandService = require('../brand/brandService');
const scrapingService = require('../scraping/scrapingService');
const storageService = require('../storage/storageService');

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

class WorkflowService {
  constructor() {
    // N8N Configuration
    this.n8nConfig = {
      baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
      apiKey: process.env.N8N_API_KEY,
      webhookUrl: process.env.N8N_WEBHOOK_URL
    };

    // Workflow types
    this.workflowTypes = {
      PROPERTY_INGESTION: 'property_ingestion',
      CONTENT_GENERATION: 'content_generation',
      SOCIAL_CAMPAIGN: 'social_campaign',
      EMAIL_AUTOMATION: 'email_automation',
      BRAND_PROCESSING: 'brand_processing',
      DATA_ENRICHMENT: 'data_enrichment',
      LEAD_PROCESSING: 'lead_processing',
      ANALYTICS_COLLECTION: 'analytics_collection'
    };

    // Workflow statuses
    this.workflowStatuses = {
      PENDING: 'pending',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled',
      RETRYING: 'retrying'
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      backoffMultiplier: 2
    };
  }

  /**
   * Property Ingestion Workflow
   */
  async triggerPropertyIngestionWorkflow(propertyData, agentId) {
    try {
      logger.info('Triggering property ingestion workflow', {
        agentId,
        propertyId: propertyData?.id,
        propertyAddress: propertyData?.address
      });

      // Create workflow execution record
      const workflowExecution = await this.createWorkflowExecution({
        workflow_type: this.workflowTypes.PROPERTY_INGESTION,
        agent_id: agentId,
        input_data: this.sanitizeWorkflowData(propertyData),
        status: this.workflowStatuses.PENDING
      });

      // Prepare workflow payload
      const workflowPayload = {
        executionId: workflowExecution.id,
        agentId: agentId,
        propertyData: propertyData,
        steps: [
          'validate_property_data',
          'scrape_additional_data',
          'enrich_with_external_apis',
          'generate_ai_content',
          'process_images',
          'create_social_campaign',
          'setup_chat_agent',
          'send_notifications'
        ]
      };

      // Trigger N8N workflow
      const n8nResponse = await this.triggerN8NWorkflow('property-ingestion', workflowPayload);

      // Update execution status
      await this.updateWorkflowExecution(workflowExecution.id, {
        status: this.workflowStatuses.RUNNING,
        n8n_execution_id: n8nResponse.executionId,
        started_at: new Date().toISOString()
      });

      logger.info('Property ingestion workflow triggered successfully', {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        agentId
      });
      
      return {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        status: this.workflowStatuses.RUNNING
      };

    } catch (error) {
      logger.error('Error triggering property ingestion workflow', {
        agentId,
        propertyId: propertyData?.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Content Generation Workflow
   */
  async triggerContentGenerationWorkflow(propertyId, agentId, contentTypes = []) {
    try {
      logger.info('Triggering content generation workflow', {
        propertyId,
        agentId,
        contentTypes
      });

      // Get property data
      const { data: property, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch property: ${error.message}`);
      }

      // Create workflow execution
      const workflowExecution = await this.createWorkflowExecution({
        workflow_type: this.workflowTypes.CONTENT_GENERATION,
        agent_id: agentId,
        property_id: propertyId,
        input_data: { propertyId, contentTypes },
        status: this.workflowStatuses.PENDING
      });

      // Determine content generation steps
      const steps = this.buildContentGenerationSteps(contentTypes);

      const workflowPayload = {
        executionId: workflowExecution.id,
        propertyId: propertyId,
        agentId: agentId,
        property: property,
        contentTypes: contentTypes,
        steps: steps
      };

      // Trigger N8N workflow
      const n8nResponse = await this.triggerN8NWorkflow('content-generation', workflowPayload);

      // Update execution status
      await this.updateWorkflowExecution(workflowExecution.id, {
        status: this.workflowStatuses.RUNNING,
        n8n_execution_id: n8nResponse.executionId,
        started_at: new Date().toISOString()
      });

      logger.info('Content generation workflow triggered successfully', {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        propertyId,
        agentId,
        contentTypes
      });
      
      return {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        status: this.workflowStatuses.RUNNING
      };

    } catch (error) {
      logger.error('Error triggering content generation workflow', {
        propertyId,
        agentId,
        contentTypes,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Social Media Campaign Workflow
   */
  async triggerSocialCampaignWorkflow(propertyId, agentId, campaignConfig = {}) {
    try {
      logger.info('Triggering social campaign workflow', {
        propertyId,
        agentId,
        platforms: campaignConfig.platforms,
        duration: campaignConfig.duration
      });

      // Create workflow execution
      const workflowExecution = await this.createWorkflowExecution({
        workflow_type: this.workflowTypes.SOCIAL_CAMPAIGN,
        agent_id: agentId,
        property_id: propertyId,
        input_data: this.sanitizeWorkflowData(campaignConfig),
        status: this.workflowStatuses.PENDING
      });

      const workflowPayload = {
        executionId: workflowExecution.id,
        propertyId: propertyId,
        agentId: agentId,
        campaignConfig: {
          duration: campaignConfig.duration || 70, // days
          postsPerDay: campaignConfig.postsPerDay || 3,
          platforms: campaignConfig.platforms || ['instagram', 'facebook', 'linkedin'],
          startDate: campaignConfig.startDate || new Date().toISOString(),
          ...campaignConfig
        },
        steps: [
          'generate_campaign_strategy',
          'create_content_calendar',
          'generate_post_content',
          'create_visual_assets',
          'schedule_posts',
          'setup_monitoring'
        ]
      };

      // Trigger N8N workflow
      const n8nResponse = await this.triggerN8NWorkflow('social-campaign', workflowPayload);

      // Update execution status
      await this.updateWorkflowExecution(workflowExecution.id, {
        status: this.workflowStatuses.RUNNING,
        n8n_execution_id: n8nResponse.executionId,
        started_at: new Date().toISOString()
      });

      logger.info('Social campaign workflow triggered successfully', {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        propertyId,
        agentId
      });
      
      return {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        status: this.workflowStatuses.RUNNING
      };

    } catch (error) {
      logger.error('Error triggering social campaign workflow', {
        propertyId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Email Automation Workflow
   */
  async triggerEmailAutomationWorkflow(agentId, automationType, triggerData = {}) {
    try {
      logger.info('Triggering email automation workflow', {
        agentId,
        automationType,
        triggerType: triggerData.type
      });

      // Create workflow execution
      const workflowExecution = await this.createWorkflowExecution({
        workflow_type: this.workflowTypes.EMAIL_AUTOMATION,
        agent_id: agentId,
        input_data: this.sanitizeWorkflowData({ automationType, ...triggerData }),
        status: this.workflowStatuses.PENDING
      });

      const workflowPayload = {
        executionId: workflowExecution.id,
        agentId: agentId,
        automationType: automationType,
        triggerData: triggerData,
        steps: this.buildEmailAutomationSteps(automationType)
      };

      // Trigger N8N workflow
      const n8nResponse = await this.triggerN8NWorkflow('email-automation', workflowPayload);

      // Update execution status
      await this.updateWorkflowExecution(workflowExecution.id, {
        status: this.workflowStatuses.RUNNING,
        n8n_execution_id: n8nResponse.executionId,
        started_at: new Date().toISOString()
      });

      logger.info('Email automation workflow triggered successfully', {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        agentId,
        automationType
      });
      
      return {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        status: this.workflowStatuses.RUNNING
      };

    } catch (error) {
      logger.error('Error triggering email automation workflow', {
        agentId,
        automationType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Brand Processing Workflow
   */
  async triggerBrandProcessingWorkflow(agentId, brandData) {
    try {
      logger.info('Triggering brand processing workflow', {
        agentId,
        brandName: brandData?.name,
        hasLogo: !!brandData?.logo
      });

      // Create workflow execution
      const workflowExecution = await this.createWorkflowExecution({
        workflow_type: this.workflowTypes.BRAND_PROCESSING,
        agent_id: agentId,
        input_data: this.sanitizeWorkflowData(brandData),
        status: this.workflowStatuses.PENDING
      });

      const workflowPayload = {
        executionId: workflowExecution.id,
        agentId: agentId,
        brandData: brandData,
        steps: [
          'validate_brand_assets',
          'process_logo',
          'generate_color_palette',
          'create_brand_guidelines',
          'generate_email_templates',
          'update_social_templates',
          'apply_brand_to_existing_content'
        ]
      };

      // Trigger N8N workflow
      const n8nResponse = await this.triggerN8NWorkflow('brand-processing', workflowPayload);

      // Update execution status
      await this.updateWorkflowExecution(workflowExecution.id, {
        status: this.workflowStatuses.RUNNING,
        n8n_execution_id: n8nResponse.executionId,
        started_at: new Date().toISOString()
      });

      logger.info('Brand processing workflow triggered successfully', {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        agentId
      });
      
      return {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        status: this.workflowStatuses.RUNNING
      };

    } catch (error) {
      logger.error('Error triggering brand processing workflow', {
        agentId,
        brandName: brandData?.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Lead Processing Workflow
   */
  async triggerLeadProcessingWorkflow(leadData, agentId) {
    try {
      logger.info('Triggering lead processing workflow', {
        agentId,
        leadEmail: leadData?.email,
        leadSource: leadData?.source
      });

      // Create workflow execution
      const workflowExecution = await this.createWorkflowExecution({
        workflow_type: this.workflowTypes.LEAD_PROCESSING,
        agent_id: agentId,
        input_data: this.sanitizeWorkflowData(leadData),
        status: this.workflowStatuses.PENDING
      });

      const workflowPayload = {
        executionId: workflowExecution.id,
        agentId: agentId,
        leadData: leadData,
        steps: [
          'validate_lead_data',
          'enrich_lead_profile',
          'send_welcome_email',
          'notify_agent',
          'schedule_follow_up',
          'add_to_crm',
          'trigger_nurture_sequence'
        ]
      };

      // Trigger N8N workflow
      const n8nResponse = await this.triggerN8NWorkflow('lead-processing', workflowPayload);

      // Update execution status
      await this.updateWorkflowExecution(workflowExecution.id, {
        status: this.workflowStatuses.RUNNING,
        n8n_execution_id: n8nResponse.executionId,
        started_at: new Date().toISOString()
      });

      logger.info('Lead processing workflow triggered successfully', {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        agentId,
        leadEmail: leadData?.email
      });
      
      return {
        executionId: workflowExecution.id,
        n8nExecutionId: n8nResponse.executionId,
        status: this.workflowStatuses.RUNNING
      };

    } catch (error) {
      logger.error('Error triggering lead processing workflow', {
        agentId,
        leadEmail: leadData?.email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * N8N Integration Methods
   */
  async triggerN8NWorkflow(workflowName, payload) {
    try {
      logger.debug('Triggering N8N workflow', {
        workflowName,
        payloadSize: JSON.stringify(payload).length,
        webhookUrl: `${this.n8nConfig.baseUrl}/webhook/${workflowName}`
      });

      const response = await axios.post(
        `${this.n8nConfig.baseUrl}/webhook/${workflowName}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.n8nConfig.apiKey}`
          },
          timeout: 30000 // 30 seconds
        }
      );

      logger.info('N8N workflow triggered successfully', {
        workflowName,
        executionId: response.data?.executionId,
        status: response.status
      });

      return {
        success: true,
        executionId: response.data.executionId || `n8n_${Date.now()}`,
        data: response.data
      };

    } catch (error) {
      logger.error('Error triggering N8N workflow', {
        workflowName,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      throw error;
    }
  }

  async getN8NWorkflowStatus(executionId) {
    try {
      logger.debug('Getting N8N workflow status', { executionId });
      
      const response = await axios.get(
        `${this.n8nConfig.baseUrl}/api/v1/executions/${executionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.n8nConfig.apiKey}`
          }
        }
      );

      logger.debug('N8N workflow status retrieved', {
        executionId,
        status: response.data?.finished,
        success: response.data?.success
      });
      
      return response.data;

    } catch (error) {
      logger.error('Error getting N8N workflow status', {
        executionId,
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }

  /**
   * Workflow Execution Management
   */
  async createWorkflowExecution(executionData) {
    try {
      logger.debug('Creating workflow execution record', {
        workflowType: executionData.workflow_type,
        agentId: executionData.agent_id,
        propertyId: executionData.property_id
      });
      
      const { data, error } = await supabase
        .from('workflow_executions')
        .insert([{
          ...executionData,
          created_at: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create workflow execution: ${error.message}`);
      }

      logger.info('Workflow execution record created', {
        executionId: data.id,
        workflowType: data.workflow_type,
        agentId: data.agent_id
      });
      
      return data;

    } catch (error) {
      logger.error('Error creating workflow execution', {
        workflowType: executionData.workflow_type,
        agentId: executionData.agent_id,
        error: error.message
      });
      throw error;
    }
  }

  async updateWorkflowExecution(executionId, updateData) {
    try {
      logger.debug('Updating workflow execution', {
        executionId,
        status: updateData.status,
        hasOutput: !!updateData.output_data
      });
      
      const { error } = await supabase
        .from('workflow_executions')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', executionId);

      if (error) {
        throw new Error(`Failed to update workflow execution: ${error.message}`);
      }

      logger.info('Workflow execution updated', {
        executionId,
        status: updateData.status,
        workflowType: updateData.workflow_type
      });

    } catch (error) {
      logger.error('Error updating workflow execution', {
        executionId,
        error: error.message
      });
      throw error;
    }
  }

  async getWorkflowExecution(executionId) {
    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch workflow execution: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error fetching workflow execution:', error);
      throw error;
    }
  }

  /**
   * Workflow Status Monitoring
   */
  async monitorWorkflowExecution(executionId) {
    try {
      logger.debug('Monitoring workflow execution', { executionId });
      
      const execution = await this.getWorkflowExecution(executionId);
      
      if (!execution.n8n_execution_id) {
        logger.debug('No N8N execution ID found', { executionId });
        return execution;
      }

      // Get status from N8N
      const n8nStatus = await this.getN8NWorkflowStatus(execution.n8n_execution_id);
      
      // Map N8N status to our status
      let status = this.workflowStatuses.RUNNING;
      if (n8nStatus.finished) {
        status = n8nStatus.success ? this.workflowStatuses.COMPLETED : this.workflowStatuses.FAILED;
      }

      // Update execution if status changed
      if (status !== execution.status) {
        logger.info('Workflow execution status changed', {
          executionId,
          oldStatus: execution.status,
          newStatus: status,
          n8nExecutionId: execution.n8n_execution_id
        });
        
        await this.updateWorkflowExecution(executionId, {
          status: status,
          n8n_data: n8nStatus,
          completed_at: status === this.workflowStatuses.COMPLETED ? new Date().toISOString() : null,
          failed_at: status === this.workflowStatuses.FAILED ? new Date().toISOString() : null
        });
      }

      return {
        ...execution,
        status: status,
        n8n_data: n8nStatus
      };

    } catch (error) {
      logger.error('Error monitoring workflow execution', {
        executionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Workflow Retry Logic
   */
  async retryFailedWorkflow(executionId) {
    try {
      logger.info('Retrying failed workflow', { executionId });
      
      const execution = await this.getWorkflowExecution(executionId);
      
      if (execution.status !== this.workflowStatuses.FAILED) {
        throw new Error('Only failed workflows can be retried');
      }

      const retryCount = execution.retry_count || 0;
      if (retryCount >= this.retryConfig.maxRetries) {
        logger.warn('Maximum retry attempts exceeded', {
          executionId,
          retryCount,
          maxRetries: this.retryConfig.maxRetries
        });
        throw new Error('Maximum retry attempts exceeded');
      }

      // Update status to retrying
      await this.updateWorkflowExecution(executionId, {
        status: this.workflowStatuses.RETRYING,
        retry_count: retryCount + 1,
        last_retry_at: new Date().toISOString()
      });

      logger.info('Retrying workflow execution', {
        executionId,
        workflowType: execution.workflow_type,
        retryAttempt: retryCount + 1
      });

      // Determine workflow type and re-trigger
      const workflowType = execution.workflow_type;
      const inputData = execution.input_data;
      const agentId = execution.agent_id;

      let retryResult;
      switch (workflowType) {
        case this.workflowTypes.PROPERTY_INGESTION:
          retryResult = await this.triggerPropertyIngestionWorkflow(inputData, agentId);
          break;
        case this.workflowTypes.CONTENT_GENERATION:
          retryResult = await this.triggerContentGenerationWorkflow(execution.property_id, agentId, inputData.contentTypes);
          break;
        case this.workflowTypes.SOCIAL_CAMPAIGN:
          retryResult = await this.triggerSocialCampaignWorkflow(execution.property_id, agentId, inputData);
          break;
        default:
          throw new Error(`Retry not implemented for workflow type: ${workflowType}`);
      }

      // Update with new N8N execution ID
      await this.updateWorkflowExecution(executionId, {
        status: this.workflowStatuses.RUNNING,
        n8n_execution_id: retryResult.n8nExecutionId,
        retried_at: new Date().toISOString()
      });

      logger.info('Workflow retry triggered successfully', {
        executionId,
        newExecutionId: retryResult.executionId
      });
      
      return retryResult;

    } catch (error) {
      logger.error('Error retrying workflow', {
        executionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
    * Data Sanitization
    */
   sanitizeWorkflowData(data) {
     try {
       // Remove sensitive information and ensure data is serializable
       const sanitized = JSON.parse(JSON.stringify(data));
       
       // Remove any potential sensitive fields
       const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey'];
       
       const removeSensitiveFields = (obj) => {
         if (typeof obj !== 'object' || obj === null) return obj;
         
         for (const key in obj) {
           if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
             obj[key] = '[REDACTED]';
           } else if (typeof obj[key] === 'object') {
             removeSensitiveFields(obj[key]);
           }
         }
         return obj;
       };
       
       return removeSensitiveFields(sanitized);
     } catch (error) {
       logger.warn('Error sanitizing workflow data', { error: error.message });
       return {};
     }
   }

   /**
    * Check N8N Health
    */
   async checkN8NHealth() {
     try {
       const response = await axios.get(`${this.n8nConfig.baseUrl}/healthz`, {
         timeout: 5000,
         headers: {
           'Authorization': `Bearer ${this.n8nConfig.apiKey}`
         }
       });
       
       return response.status === 200;
     } catch (error) {
       logger.debug('N8N health check failed', {
         baseUrl: this.n8nConfig.baseUrl,
         error: error.message
       });
       throw new Error(`N8N health check failed: ${error.message}`);
     }
   }

  /**
   * Helper Methods
   */
  buildContentGenerationSteps(contentTypes) {
    const allSteps = {
      'ai_description': 'generate_ai_description',
      'image_restyling': 'generate_restyled_images',
      'social_campaign': 'create_social_campaign',
      'pdf_brochure': 'generate_pdf_brochure',
      'microsite': 'create_microsite',
      'email_templates': 'generate_email_templates'
    };

    if (contentTypes.length === 0) {
      return Object.values(allSteps); // Generate all content types
    }

    return contentTypes.map(type => allSteps[type]).filter(Boolean);
  }

  buildEmailAutomationSteps(automationType) {
    const stepMappings = {
      'welcome_sequence': ['send_welcome_email', 'schedule_follow_up'],
      'lead_nurture': ['send_nurture_emails', 'track_engagement'],
      'property_alerts': ['check_new_properties', 'send_alerts'],
      'market_updates': ['gather_market_data', 'send_updates']
    };

    return stepMappings[automationType] || ['send_email'];
  }

  /**
   * Webhook Handlers for N8N Callbacks
   */
  async handleWorkflowCallback(callbackData) {
    try {
      logger.info('Received workflow callback', {
        executionId: callbackData.executionId,
        status: callbackData.status,
        hasData: !!callbackData.data,
        hasError: !!callbackData.error
      });

      const { executionId, status, data, error } = callbackData;

      if (!executionId) {
        throw new Error('Execution ID is required for workflow callback');
      }

      // Update workflow execution
      const updateData = {
        status: status,
        n8n_data: this.sanitizeWorkflowData(data),
        completed_at: status === this.workflowStatuses.COMPLETED ? new Date().toISOString() : null,
        failed_at: status === this.workflowStatuses.FAILED ? new Date().toISOString() : null,
        error_message: error || null
      };

      await this.updateWorkflowExecution(executionId, updateData);

      // Handle post-completion actions
      if (status === this.workflowStatuses.COMPLETED) {
        await this.handleWorkflowCompletion(executionId, data);
      } else if (status === this.workflowStatuses.FAILED) {
        await this.handleWorkflowFailure(executionId, error);
      }

      logger.info('Workflow callback processed successfully', {
        executionId,
        status
      });
      return { success: true };

    } catch (error) {
      logger.error('Error handling workflow callback', {
        executionId: callbackData?.executionId,
        status: callbackData?.status,
        error: error.message
      });
      throw error;
    }
  }

  async handleWorkflowCompletion(executionId, data) {
    try {
      logger.info('Handling workflow completion', { executionId });
      
      const execution = await this.getWorkflowExecution(executionId);
      
      logger.debug('Processing workflow completion actions', {
        executionId,
        workflowType: execution.workflow_type,
        agentId: execution.agent_id,
        propertyId: execution.property_id
      });
      
      // Trigger follow-up actions based on workflow type
      switch (execution.workflow_type) {
        case this.workflowTypes.PROPERTY_INGESTION:
          logger.info('Property ingestion workflow completed', {
            executionId,
            propertyId: execution.property_id
          });
          // Send completion notifications
          // This could trigger additional workflows or notifications
          break;
        case this.workflowTypes.CONTENT_GENERATION:
          logger.info('Content generation workflow completed', {
            executionId,
            propertyId: execution.property_id
          });
          break;
        case this.workflowTypes.SOCIAL_CAMPAIGN:
          logger.info('Social campaign workflow completed', {
            executionId,
            propertyId: execution.property_id
          });
          break;
        default:
          logger.info('Workflow completed', {
            executionId,
            workflowType: execution.workflow_type
          });
      }

    } catch (error) {
      logger.error('Error handling workflow completion', {
        executionId,
        error: error.message
      });
    }
  }

  async handleWorkflowFailure(executionId, error) {
    try {
      logger.warn('Handling workflow failure', {
        executionId,
        errorMessage: error
      });
      
      const execution = await this.getWorkflowExecution(executionId);
      
      // Check if we should retry
      const retryCount = execution.retry_count || 0;
      if (retryCount < this.retryConfig.maxRetries) {
        const retryDelay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
        
        logger.info('Scheduling workflow retry', {
          executionId,
          retryAttempt: retryCount + 1,
          retryDelay,
          workflowType: execution.workflow_type
        });
        
        // Schedule retry with delay
        setTimeout(async () => {
          try {
            await this.retryFailedWorkflow(executionId);
          } catch (retryError) {
            logger.error('Error in automatic retry', {
              executionId,
              retryAttempt: retryCount + 1,
              error: retryError.message
            });
          }
        }, retryDelay);
      } else {
        logger.error('Max retries exceeded for workflow', {
          executionId,
          workflowType: execution.workflow_type,
          retryCount,
          maxRetries: this.retryConfig.maxRetries
        });
      }

      logger.error('Workflow execution failed', {
        executionId,
        workflowType: execution.workflow_type,
        error
      });

    } catch (error) {
      logger.error('Error handling workflow failure', {
        executionId,
        error: error.message
      });
    }
  }

  /**
   * Analytics and Monitoring
   */
  async getWorkflowAnalytics(agentId, timeRange = '30d') {
    try {
      logger.debug('Getting workflow analytics', { agentId, timeRange });
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange.replace('d', '')));

      const { data: executions, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('agent_id', agentId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch workflow analytics: ${error.message}`);
      }

      logger.debug('Processing workflow analytics', {
        agentId,
        executionCount: executions.length,
        timeRange
      });

      // Process analytics
      const analytics = {
        total_executions: executions.length,
        completed: executions.filter(e => e.status === this.workflowStatuses.COMPLETED).length,
        failed: executions.filter(e => e.status === this.workflowStatuses.FAILED).length,
        running: executions.filter(e => e.status === this.workflowStatuses.RUNNING).length,
        pending: executions.filter(e => e.status === this.workflowStatuses.PENDING).length,
        success_rate: 0,
        by_type: {},
        by_day: {},
        average_duration: 0
      };

      // Calculate success rate
      const completedOrFailed = analytics.completed + analytics.failed;
      analytics.success_rate = completedOrFailed > 0 
        ? ((analytics.completed / completedOrFailed) * 100).toFixed(1)
        : 0;

      // Group by workflow type
      executions.forEach(execution => {
        const type = execution.workflow_type;
        if (!analytics.by_type[type]) {
          analytics.by_type[type] = { total: 0, completed: 0, failed: 0 };
        }
        analytics.by_type[type].total++;
        if (execution.status === this.workflowStatuses.COMPLETED) {
          analytics.by_type[type].completed++;
        } else if (execution.status === this.workflowStatuses.FAILED) {
          analytics.by_type[type].failed++;
        }

        // Group by day
        const day = new Date(execution.created_at).toISOString().split('T')[0];
        if (!analytics.by_day[day]) {
          analytics.by_day[day] = { total: 0, completed: 0, failed: 0 };
        }
        analytics.by_day[day].total++;
        if (execution.status === this.workflowStatuses.COMPLETED) {
          analytics.by_day[day].completed++;
        } else if (execution.status === this.workflowStatuses.FAILED) {
          analytics.by_day[day].failed++;
        }
      });

      // Calculate average duration for completed workflows
      const completedExecutions = executions.filter(e => 
        e.status === this.workflowStatuses.COMPLETED && e.completed_at
      );
      
      if (completedExecutions.length > 0) {
        const totalDuration = completedExecutions.reduce((sum, execution) => {
          const start = new Date(execution.started_at || execution.created_at);
          const end = new Date(execution.completed_at);
          return sum + (end - start);
        }, 0);
        
        analytics.average_duration = Math.round(totalDuration / completedExecutions.length / 1000); // in seconds
      }

      logger.info('Workflow analytics generated', {
        agentId,
        timeRange,
        total: analytics.total_executions,
        successRate: analytics.success_rate + '%'
      });

      return analytics;

    } catch (error) {
      logger.error('Error getting workflow analytics', {
        agentId,
        timeRange,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Health check for workflow service
   */
  async healthCheck() {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        n8n: { status: 'unknown', responseTime: null },
        database: { status: 'unknown', responseTime: null },
        supabase: { status: 'unknown', responseTime: null }
      },
      metrics: {
        activeWorkflows: 0,
        pendingWorkflows: 0,
        failedWorkflows: 0
      }
    };

    try {
      logger.debug('Starting workflow service health check');

      // Test N8N connection
      const n8nStart = Date.now();
      try {
        await axios.get(`${this.n8nConfig.baseUrl}/healthz`, {
          timeout: 5000
        });
        healthStatus.services.n8n = {
          status: 'healthy',
          responseTime: Date.now() - n8nStart
        };
        logger.debug('N8N health check passed');
      } catch (n8nError) {
        healthStatus.services.n8n = {
          status: 'unhealthy',
          responseTime: Date.now() - n8nStart,
          error: n8nError.message
        };
        healthStatus.status = 'degraded';
        logger.warn('N8N health check failed', { error: n8nError.message });
      }

      // Test database connection
      const dbStart = Date.now();
      try {
        const { error } = await supabase
          .from('workflow_executions')
          .select('id')
          .limit(1);
        
        if (error) throw error;
        
        healthStatus.services.supabase = {
          status: 'healthy',
          responseTime: Date.now() - dbStart
        };
        logger.debug('Supabase health check passed');
      } catch (dbError) {
        healthStatus.services.supabase = {
          status: 'unhealthy',
          responseTime: Date.now() - dbStart,
          error: dbError.message
        };
        healthStatus.status = 'unhealthy';
        logger.error('Supabase health check failed', { error: dbError.message });
      }

      // Get workflow metrics
      try {
        const { data: metrics, error } = await supabase
          .from('workflow_executions')
          .select('status')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (!error && metrics) {
          healthStatus.metrics = {
            activeWorkflows: metrics.filter(m => m.status === this.workflowStatuses.RUNNING).length,
            pendingWorkflows: metrics.filter(m => m.status === this.workflowStatuses.PENDING).length,
            failedWorkflows: metrics.filter(m => m.status === this.workflowStatuses.FAILED).length,
            totalLast24h: metrics.length
          };
        }
      } catch (metricsError) {
        logger.warn('Failed to get workflow metrics', { error: metricsError.message });
      }

      logger.info('Workflow service health check completed', {
        status: healthStatus.status,
        n8nStatus: healthStatus.services.n8n.status,
        supabaseStatus: healthStatus.services.supabase.status
      });

      return healthStatus;

    } catch (error) {
      logger.error('Error in workflow service health check', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        services: healthStatus.services
      };
    }
  }
}

module.exports = new WorkflowService();