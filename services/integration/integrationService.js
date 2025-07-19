const axios = require('axios');
const config = require('../../config/config');
const { supabaseAdmin } = require('../../config/supabaseClient');

class IntegrationService {
  constructor() {
    // API endpoints
    this.apis = {
      googlePlaces: 'https://maps.googleapis.com/maps/api/place',
      walkScore: 'https://api.walkscore.com/score',
      greatSchools: 'https://api.greatschools.org/v1',
      apiNinjas: 'https://api.api-ninjas.com/v1',
      mixPost: process.env.MIXPOST_API_URL || 'https://api.mixpost.app/v1'
    };

    // API keys from environment
    this.apiKeys = {
      googlePlaces: process.env.GOOGLE_PLACES_API_KEY,
      walkScore: process.env.WALK_SCORE_API_KEY,
      greatSchools: process.env.GREAT_SCHOOLS_API_KEY,
      apiNinjas: process.env.API_NINJAS_KEY,
      mixPost: process.env.MIXPOST_API_KEY
    };

    // Cache duration (in minutes)
    this.cacheDuration = {
      places: parseInt(process.env.CACHE_DURATION_HOURS || '24') * 60, // configurable hours
      walkScore: parseInt(process.env.WALKSCORE_CACHE_DURATION_DAYS || '7') * 60 * 24, // configurable days
      schools: 60 * 24 * 7, // 7 days
      mortgageRates: 60, // 1 hour
      marketData: 60 * 6 // 6 hours
    };
  }

  /**
   * Google Places API Integration
   */
  async getPlaceDetails(address, propertyId = null) {
    try {
      console.log(`Fetching place details for: ${address}`);

      // Check cache first
      const cached = await this.getCachedData('places', address);
      if (cached) {
        console.log('Returning cached place details');
        return cached;
      }

      // Search for place
      const searchResponse = await axios.get(`${this.apis.googlePlaces}/textsearch/json`, {
        params: {
          query: address,
          key: this.apiKeys.googlePlaces
        }
      });

      if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
        throw new Error('No place found for the given address');
      }

      const place = searchResponse.data.results[0];
      const placeId = place.place_id;

      // Get detailed place information
      const detailsResponse = await axios.get(`${this.apis.googlePlaces}/details/json`, {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,geometry,rating,reviews,photos,types,vicinity,website,formatted_phone_number',
          key: this.apiKeys.googlePlaces
        }
      });

      const details = detailsResponse.data.result;

      // Get nearby amenities
      const amenities = await this.getNearbyAmenities(details.geometry.location);

      const placeData = {
        place_id: placeId,
        name: details.name,
        formatted_address: details.formatted_address,
        location: details.geometry.location,
        rating: details.rating,
        types: details.types,
        vicinity: details.vicinity,
        website: details.website,
        phone: details.formatted_phone_number,
        photos: details.photos?.slice(0, 5).map(photo => ({
          reference: photo.photo_reference,
          width: photo.width,
          height: photo.height,
          url: `${this.apis.googlePlaces}/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${this.apiKeys.googlePlaces}`
        })) || [],
        reviews: details.reviews?.slice(0, 3).map(review => ({
          author: review.author_name,
          rating: review.rating,
          text: review.text,
          time: review.time
        })) || [],
        amenities: amenities,
        fetched_at: new Date().toISOString()
      };

      // Cache the data
      await this.cacheData('places', address, placeData, this.cacheDuration.places);

      // Save to property if propertyId provided
      if (propertyId) {
        await this.savePropertyPlaceData(propertyId, placeData);
      }

      console.log('Place details fetched successfully');
      return placeData;

    } catch (error) {
      console.error('Error fetching place details:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get nearby amenities
   */
  async getNearbyAmenities(location, radius = 2000) {
    try {
      const amenityTypes = [
        'school', 'hospital', 'grocery_or_supermarket', 'restaurant',
        'gas_station', 'bank', 'pharmacy', 'shopping_mall', 'park',
        'gym', 'library', 'subway_station', 'bus_station'
      ];

      const amenities = {};

      for (const type of amenityTypes) {
        try {
          const response = await axios.get(`${process.env.GOOGLE_PLACES_API_URL || this.apis.googlePlaces}/nearbysearch/json`, {
            params: {
              location: `${location.lat},${location.lng}`,
              radius: radius,
              type: type,
              key: this.apiKeys.googlePlaces
            }
          });

          amenities[type] = response.data.results.slice(0, 5).map(place => ({
            name: place.name,
            rating: place.rating,
            vicinity: place.vicinity,
            distance: this.calculateDistance(
              location.lat, location.lng,
              place.geometry.location.lat, place.geometry.location.lng
            )
          }));

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, parseInt(process.env.INTEGRATION_REQUEST_DELAY_MS || '100')));

        } catch (error) {
          console.error(`Error fetching ${type} amenities:`, error.message);
          amenities[type] = [];
        }
      }

      return amenities;

    } catch (error) {
      console.error('Error fetching nearby amenities:', error);
      return {};
    }
  }

  /**
   * Walk Score API Integration
   */
  async getWalkScore(address, lat, lng) {
    try {
      console.log(`Fetching Walk Score for: ${address}`);

      // Check cache first
      const cacheKey = `${lat}_${lng}`;
      const cached = await this.getCachedData('walkScore', cacheKey);
      if (cached) {
        console.log('Returning cached Walk Score');
        return cached;
      }

      const response = await axios.get(process.env.WALKSCORE_API_URL || this.apis.walkScore, {
        params: {
          format: 'json',
          address: address,
          lat: lat,
          lon: lng,
          transit: 1,
          bike: 1,
          wsapikey: this.apiKeys.walkScore
        }
      });

      const walkScoreData = {
        walkscore: response.data.walkscore,
        description: response.data.description,
        updated: response.data.updated,
        logo_url: response.data.logo_url,
        more_info_icon: response.data.more_info_icon,
        more_info_link: response.data.more_info_link,
        ws_link: response.data.ws_link,
        help_link: response.data.help_link,
        snapped_lat: response.data.snapped_lat,
        snapped_lon: response.data.snapped_lon,
        transit: response.data.transit || {},
        bike: response.data.bike || {},
        fetched_at: new Date().toISOString()
      };

      // Cache the data
      await this.cacheData('walkScore', cacheKey, walkScoreData, this.cacheDuration.walkScore);

      console.log('Walk Score fetched successfully');
      return walkScoreData;

    } catch (error) {
      console.error('Error fetching Walk Score:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * GreatSchools API Integration
   */
  async getSchoolData(lat, lng, radius = 5) {
    try {
      console.log(`Fetching school data for coordinates: ${lat}, ${lng}`);

      // Check cache first
      const cacheKey = `${lat}_${lng}_${radius}`;
      const cached = await this.getCachedData('schools', cacheKey);
      if (cached) {
        console.log('Returning cached school data');
        return cached;
      }

      // Get schools by location
      const response = await axios.get(`${this.apis.greatSchools}/schools/nearby`, {
        params: {
          key: this.apiKeys.greatSchools,
          lat: lat,
          lon: lng,
          radius: radius,
          sort: 'rating',
          limit: 20
        }
      });

      const schools = response.data.schools?.map(school => ({
        id: school.id,
        name: school.name,
        type: school.type,
        level: school.level,
        rating: school.rating,
        number_of_students: school.numberOfStudents,
        student_teacher_ratio: school.studentTeacherRatio,
        address: {
          street: school.address?.street,
          city: school.address?.city,
          state: school.address?.state,
          zip: school.address?.zip
        },
        phone: school.phone,
        website: school.website,
        distance: school.distance,
        grades_served: school.gradesServed,
        district: {
          id: school.district?.id,
          name: school.district?.name
        }
      })) || [];

      // Group schools by level
      const schoolData = {
        elementary: schools.filter(s => s.level === 'Elementary'),
        middle: schools.filter(s => s.level === 'Middle'),
        high: schools.filter(s => s.level === 'High'),
        all: schools,
        summary: {
          total_schools: schools.length,
          average_rating: schools.length > 0 
            ? (schools.reduce((sum, s) => sum + (s.rating || 0), 0) / schools.length).toFixed(1)
            : 0,
          top_rated: schools.filter(s => s.rating >= 8).length
        },
        fetched_at: new Date().toISOString()
      };

      // Cache the data
      await this.cacheData('schools', cacheKey, schoolData, this.cacheDuration.schools);

      console.log('School data fetched successfully');
      return schoolData;

    } catch (error) {
      console.error('Error fetching school data:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * API Ninjas - Mortgage Rates
   */
  async getMortgageRates() {
    try {
      console.log('Fetching current mortgage rates');

      // Check cache first
      const cached = await this.getCachedData('mortgageRates', 'current');
      if (cached) {
        console.log('Returning cached mortgage rates');
        return cached;
      }

      const response = await axios.get(`${this.apis.apiNinjas}/mortgagerate`, {
        headers: {
          'X-Api-Key': this.apiKeys.apiNinjas
        }
      });

      const mortgageData = {
        rates: response.data,
        fetched_at: new Date().toISOString(),
        source: 'API Ninjas'
      };

      // Cache the data
      await this.cacheData('mortgageRates', 'current', mortgageData, this.cacheDuration.mortgageRates);

      console.log('Mortgage rates fetched successfully');
      return mortgageData;

    } catch (error) {
      console.error('Error fetching mortgage rates:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Calculate mortgage payment
   */
  calculateMortgagePayment(principal, annualRate, years) {
    try {
      const monthlyRate = annualRate / 100 / 12;
      const numberOfPayments = years * 12;
      
      if (monthlyRate === 0) {
        return principal / numberOfPayments;
      }
      
      const monthlyPayment = principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
      
      return {
        monthly_payment: Math.round(monthlyPayment * 100) / 100,
        total_payment: Math.round(monthlyPayment * numberOfPayments * 100) / 100,
        total_interest: Math.round((monthlyPayment * numberOfPayments - principal) * 100) / 100,
        principal: principal,
        rate: annualRate,
        term_years: years
      };
      
    } catch (error) {
      console.error('Error calculating mortgage payment:', error);
      throw error;
    }
  }

  /**
   * MixPost Integration for Social Media
   */
  async publishToMixPost(postData) {
    try {
      console.log('Publishing to MixPost');

      const response = await axios.post(`${this.apis.mixPost}/posts`, {
        accounts: postData.accounts, // Array of social media account IDs
        content: postData.content,
        media: postData.media || [],
        scheduled_at: postData.scheduledAt,
        tags: postData.tags || []
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.mixPost}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Post published to MixPost successfully');
      return response.data;

    } catch (error) {
      console.error('Error publishing to MixPost:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get MixPost accounts
   */
  async getMixPostAccounts() {
    try {
      const response = await axios.get(`${this.apis.mixPost}/accounts`, {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.mixPost}`
        }
      });

      return response.data;

    } catch (error) {
      console.error('Error fetching MixPost accounts:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Comprehensive property enrichment
   */
  async enrichPropertyData(propertyId, address, lat, lng) {
    try {
      console.log(`Enriching property data for: ${address}`);

      const enrichmentPromises = [
        this.getPlaceDetails(address, propertyId).catch(err => {
          console.error('Place details failed:', err.message);
          return null;
        }),
        this.getWalkScore(address, lat, lng).catch(err => {
          console.error('Walk Score failed:', err.message);
          return null;
        }),
        this.getSchoolData(lat, lng).catch(err => {
          console.error('School data failed:', err.message);
          return null;
        }),
        this.getMortgageRates().catch(err => {
          console.error('Mortgage rates failed:', err.message);
          return null;
        })
      ];

      const [placeDetails, walkScore, schoolData, mortgageRates] = await Promise.all(enrichmentPromises);

      const enrichedData = {
        property_id: propertyId,
        place_details: placeDetails,
        walk_score: walkScore,
        school_data: schoolData,
        mortgage_rates: mortgageRates,
        enriched_at: new Date().toISOString()
      };

      // Save enriched data to database
      await this.saveEnrichedPropertyData(propertyId, enrichedData);

      console.log('Property data enriched successfully');
      return enrichedData;

    } catch (error) {
      console.error('Error enriching property data:', error);
      throw error;
    }
  }

  /**
   * Cache management
   */
  async cacheData(type, key, data, durationMinutes) {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

      const { error } = await supabaseAdmin
        .from('api_cache')
        .upsert({
          cache_type: type,
          cache_key: key,
          data: data,
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'cache_type,cache_key'
        });

      if (error) {
        console.error('Error caching data:', error);
      }

    } catch (error) {
      console.error('Error in cache operation:', error);
    }
  }

  async getCachedData(type, key) {
    try {
      const { data, error } = await supabaseAdmin
        .from('api_cache')
        .select('data, expires_at')
        .eq('cache_type', type)
        .eq('cache_key', key)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching cached data:', error);
        return null;
      }

      return data?.data || null;

    } catch (error) {
      console.error('Error in cache retrieval:', error);
      return null;
    }
  }

  async clearExpiredCache() {
    try {
      const { error } = await supabaseAdmin
        .from('api_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error clearing expired cache:', error);
      } else {
        console.log('Expired cache cleared successfully');
      }

    } catch (error) {
      console.error('Error in cache cleanup:', error);
    }
  }

  /**
   * Database operations
   */
  async savePropertyPlaceData(propertyId, placeData) {
    try {
      const { error } = await supabaseAdmin
        .from('properties')
        .update({
          place_data: placeData,
          place_updated_at: new Date().toISOString()
        })
        .eq('id', propertyId);

      if (error) {
        console.error('Error saving place data:', error);
      }

    } catch (error) {
      console.error('Error in place data save:', error);
    }
  }

  async saveEnrichedPropertyData(propertyId, enrichedData) {
    try {
      const { error } = await supabaseAdmin
        .from('property_enrichment')
        .upsert({
          property_id: propertyId,
          enriched_data: enrichedData,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'property_id'
        });

      if (error) {
        console.error('Error saving enriched data:', error);
      }

    } catch (error) {
      console.error('Error in enriched data save:', error);
    }
  }

  /**
   * Utility functions
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // Distance in miles, rounded to 2 decimal places
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Health check for all integrations
   */
  async healthCheck() {
    const results = {
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Test Google Places API
    try {
      await axios.get(`${this.apis.googlePlaces}/textsearch/json`, {
        params: {
          query: 'test',
          key: this.apiKeys.googlePlaces
        }
      });
      results.services.googlePlaces = { status: 'healthy', message: 'API responding' };
    } catch (error) {
      results.services.googlePlaces = { status: 'unhealthy', message: error.message };
    }

    // Test Walk Score API
    try {
      await axios.get(this.apis.walkScore, {
        params: {
          format: 'json',
          address: 'test',
          lat: 40.7128,
          lon: -74.0060,
          wsapikey: this.apiKeys.walkScore
        }
      });
      results.services.walkScore = { status: 'healthy', message: 'API responding' };
    } catch (error) {
      results.services.walkScore = { status: 'unhealthy', message: error.message };
    }

    // Test API Ninjas
    try {
      await axios.get(`${this.apis.apiNinjas}/mortgagerate`, {
        headers: {
          'X-Api-Key': this.apiKeys.apiNinjas
        }
      });
      results.services.apiNinjas = { status: 'healthy', message: 'API responding' };
    } catch (error) {
      results.services.apiNinjas = { status: 'unhealthy', message: error.message };
    }

    // Test MixPost
    try {
      await axios.get(`${this.apis.mixPost}/accounts`, {
        headers: {
          'Authorization': `Bearer ${this.apiKeys.mixPost}`
        }
      });
      results.services.mixPost = { status: 'healthy', message: 'API responding' };
    } catch (error) {
      results.services.mixPost = { status: 'unhealthy', message: error.message };
    }

    return results;
  }

  /**
   * Get integration analytics
   */
  async getIntegrationAnalytics(timeRange = '30d') {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange.replace('d', '')));

      const { data: cacheData, error } = await supabaseAdmin
        .from('api_cache')
        .select('cache_type, created_at')
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch integration analytics: ${error.message}`);
      }

      // Process analytics
      const analytics = {
        total_requests: cacheData.length,
        by_service: {},
        by_day: {},
        cache_hit_rate: 0
      };

      // Group by service type
      cacheData.forEach(item => {
        const service = item.cache_type;
        if (!analytics.by_service[service]) {
          analytics.by_service[service] = 0;
        }
        analytics.by_service[service]++;

        // Group by day
        const day = new Date(item.created_at).toISOString().split('T')[0];
        if (!analytics.by_day[day]) {
          analytics.by_day[day] = 0;
        }
        analytics.by_day[day]++;
      });

      return analytics;

    } catch (error) {
      console.error('Error getting integration analytics:', error);
      throw error;
    }
  }
}

module.exports = new IntegrationService();