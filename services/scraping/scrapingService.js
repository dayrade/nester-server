const puppeteer = require('puppeteer');
const axios = require('axios');
const validationService = require('../validation/validationService');
const propertyService = require('../property/propertyService');
const emailService = require('../email/emailService');
const config = require('../../config/config');

class ScrapingService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.brightDataConfig = {
      endpoint: process.env.BRIGHTDATA_ENDPOINT,
      username: process.env.BRIGHTDATA_USERNAME,
      password: process.env.BRIGHTDATA_PASSWORD
    };
  }

  /**
   * Main scraping orchestrator with three-tier fallback system
   */
  async scrapePropertyData(url, agentId) {
    const jobId = this.generateJobId();
    
    try {
      // Create initial property record
      const property = await propertyService.createProperty({
        agent_id: agentId,
        listing_url: url,
        listing_status: 'processing',
        scraping_job_id: jobId
      });

      // Start scraping process asynchronously
      this.processScrapingJob(property.id, url, agentId).catch(error => {
        console.error(`Scraping job ${jobId} failed:`, error);
      });

      return {
        id: jobId,
        propertyId: property.id,
        status: 'started'
      };
    } catch (error) {
      console.error('Failed to start scraping job:', error);
      throw error;
    }
  }

  /**
   * Process scraping job with fallback tiers
   */
  async processScrapingJob(propertyId, url, agentId) {
    try {
      // Tier 1: Native Puppeteer scraping with retries
      let scrapedData = await this.scrapeWithPuppeteer(url);
      
      if (!scrapedData) {
        console.log('Tier 1 failed, trying Tier 2: BrightData API');
        // Tier 2: BrightData API for protected sites
        scrapedData = await this.scrapeWithBrightData(url);
      }
      
      if (!scrapedData) {
        console.log('Tier 2 failed, executing Tier 3: Email fallback');
        // Tier 3: Email user with manual form link
        await this.sendManualFormEmail(agentId, url);
        
        await propertyService.updateScrapingStatus(
          propertyId, 
          'manual_required',
          'Automatic scraping failed. Manual form link sent via email.'
        );
        return;
      }

      // Validate scraped data
      const validationResult = validationService.validatePropertyData(scrapedData);
      
      if (!validationResult.isValid) {
        throw new Error(`Invalid scraped data: ${validationResult.errors.join(', ')}`);
      }

      // Update property with scraped data
      await propertyService.updateProperty(propertyId, {
        ...scrapedData,
        listing_status: 'active',
        scraping_completed_at: new Date().toISOString()
      }, agentId);

      console.log(`Scraping completed successfully for property ${propertyId}`);
      
    } catch (error) {
      console.error(`Scraping failed for property ${propertyId}:`, error);
      
      await propertyService.updateScrapingStatus(
        propertyId,
        'error',
        error.message
      );
    }
  }

  /**
   * Tier 1: Native Puppeteer scraping with retries
   */
  async scrapeWithPuppeteer(url, retryCount = 0) {
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });
      
      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for content to load
      await page.waitForTimeout(3000);

      // Extract property data using selectors
      const propertyData = await page.evaluate(() => {
        return this.extractPropertyData();
      });

      await browser.close();
      
      if (propertyData && this.isValidPropertyData(propertyData)) {
        return propertyData;
      }
      
      return null;
      
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      
      console.error(`Puppeteer scraping attempt ${retryCount + 1} failed:`, error);
      
      if (retryCount < this.maxRetries - 1) {
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.scrapeWithPuppeteer(url, retryCount + 1);
      }
      
      return null;
    }
  }

  /**
   * Extract property data from page content
   */
  extractPropertyData() {
    const data = {};
    
    // Common selectors for property data
    const selectors = {
      address: [
        '[data-testid="property-address"]',
        '.address',
        '.property-address',
        'h1[class*="address"]',
        '[class*="street-address"]'
      ],
      price: [
        '[data-testid="price"]',
        '.price',
        '.property-price',
        '[class*="price"]',
        '.listing-price'
      ],
      bedrooms: [
        '[data-testid="bedrooms"]',
        '.bedrooms',
        '[class*="bed"]',
        '.beds'
      ],
      bathrooms: [
        '[data-testid="bathrooms"]',
        '.bathrooms',
        '[class*="bath"]',
        '.baths'
      ],
      squareFeet: [
        '[data-testid="square-feet"]',
        '.square-feet',
        '.sqft',
        '[class*="sqft"]'
      ],
      description: [
        '[data-testid="description"]',
        '.description',
        '.property-description',
        '[class*="description"]'
      ]
    };

    // Extract data using selectors
    Object.entries(selectors).forEach(([key, selectorList]) => {
      for (const selector of selectorList) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          data[key] = element.textContent.trim();
          break;
        }
      }
    });

    // Extract images
    const imageElements = document.querySelectorAll('img[src*="property"], img[src*="listing"], .property-image img, .listing-image img');
    data.images = Array.from(imageElements)
      .map(img => img.src)
      .filter(src => src && src.startsWith('http'))
      .slice(0, 20); // Limit to 20 images

    // Clean and format data
    if (data.price) {
      data.price = this.extractPrice(data.price);
    }
    
    if (data.bedrooms) {
      data.bedrooms = this.extractNumber(data.bedrooms);
    }
    
    if (data.bathrooms) {
      data.bathrooms = this.extractNumber(data.bathrooms);
    }
    
    if (data.squareFeet) {
      data.square_feet = this.extractNumber(data.squareFeet);
      delete data.squareFeet;
    }

    return data;
  }

  /**
   * Tier 2: BrightData API scraping
   */
  async scrapeWithBrightData(url) {
    if (!this.brightDataConfig.endpoint) {
      console.log('BrightData not configured, skipping Tier 2');
      return null;
    }

    try {
      const response = await axios.post(this.brightDataConfig.endpoint, {
        url: url,
        format: 'json'
      }, {
        auth: {
          username: this.brightDataConfig.username,
          password: this.brightDataConfig.password
        },
        timeout: 60000
      });

      if (response.data && response.data.success) {
        return this.formatBrightDataResponse(response.data.data);
      }
      
      return null;
      
    } catch (error) {
      console.error('BrightData scraping failed:', error);
      return null;
    }
  }

  /**
   * Tier 3: Send manual form email
   */
  async sendManualFormEmail(agentId, url) {
    try {
      const manualFormUrl = `${process.env.FRONTEND_URL}/properties/manual-entry?url=${encodeURIComponent(url)}`;
      
      await emailService.sendManualFormEmail(agentId, {
        originalUrl: url,
        manualFormUrl: manualFormUrl
      });
      
      console.log(`Manual form email sent to agent ${agentId}`);
      
    } catch (error) {
      console.error('Failed to send manual form email:', error);
      throw error;
    }
  }

  /**
   * Utility methods
   */
  generateJobId() {
    return `scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  extractPrice(priceText) {
    const match = priceText.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, '')) : null;
  }

  extractNumber(text) {
    const match = text.match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  }

  isValidPropertyData(data) {
    return data && (data.address || data.price || data.bedrooms);
  }

  formatBrightDataResponse(data) {
    // Format BrightData response to match our schema
    return {
      address: data.address,
      price: data.price,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      square_feet: data.squareFeet,
      description: data.description,
      images: data.images || []
    };
  }
}

module.exports = new ScrapingService();