# Nester Server API Documentation

## 🚀 Server Overview

**Server Name:** Nester Backend API  
**Version:** 1.0.0  
**Description:** AI-powered real estate marketing platform backend  
**Base URL:** `http://localhost:3000` (development) / `https://your-domain.com` (production)  
**Node.js Version:** >=18.0.0  

## 📡 Server Configuration

### Core Server Settings
```javascript
{
  "port": 3000,
  "host": "localhost",
  "environment": "development", // development | production | test
  "corsOrigin": "http://localhost:3000",
  "trustProxy": false
}
```

### Security & Middleware
- **CORS:** Enabled with credentials support
- **Helmet:** Security headers enabled
- **Rate Limiting:** 100 requests per 15 minutes per IP
- **Compression:** Gzip compression enabled
- **Body Parser:** JSON (10MB limit) and URL-encoded
- **Request Logging:** Morgan with Winston integration

## 🔐 Authentication

### Configuration
```javascript
{
  "sessionCookieName": "session_token",
  "sessionMaxAge": 86400000, // 24 hours
  "passwordMinLength": 8,
  "passwordRequireSpecialChar": true,
  "passwordRequireNumber": true,
  "passwordRequireUppercase": true,
  "emailVerificationRequired": true
}
```

### Rate Limits
- **Signup:** 5 attempts per 15 minutes
- **Signin:** 10 attempts per 15 minutes
- **General API:** 100 requests per 15 minutes

## 🛣️ API Endpoints

### Health Check
```
GET /health
```
**Response:**
```javascript
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "healthy",
    "storage": "healthy",
    "integrations": "healthy",
    "workflows": "healthy"
  }
}
```

### API Information
```
GET /api
```
**Response:**
```javascript
{
  "name": "Nester API",
  "version": "1.0.0",
  "description": "AI-powered real estate marketing platform",
  "endpoints": {
    "auth": "/api/auth",
    "properties": "/api/properties",
    "profile": "/api/profile",
    "brands": "/api/brands",
    "social": "/api/social",
    "chat": "/api/chat",
    "analytics": "/api/analytics",
    "upload": "/api/upload",
    "webhooks": "/api/webhooks"
  },
  "health": "/health"
}
```

### Authentication Endpoints
**Base Path:** `/api/auth`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/signup` | User registration | No |
| POST | `/login` | User login | No |
| POST | `/reset-password` | Password reset | No |
| GET | `/logout` | User logout | No |

#### POST /api/auth/signup
**Request Body:**
```javascript
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (Success):**
```javascript
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "session": {
      "access_token": "jwt_token",
      "refresh_token": "refresh_token",
      "expires_in": 3600
    }
  }
}
```

#### POST /api/auth/login
**Request Body:**
```javascript
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Property Endpoints
**Base Path:** `/api/properties`  
**Authentication:** Required for all endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create new property |
| GET | `/` | Get all properties for user |
| GET | `/:id` | Get specific property |
| PUT | `/:id` | Update property |
| DELETE | `/:id` | Delete property |
| POST | `/scrape` | Scrape property from URL |
| POST | `/:id/generate-content` | Generate AI content |
| GET | `/:id/images` | Get property images |
| POST | `/:id/images` | Upload property images |
| DELETE | `/:id/images/:imageId` | Delete property image |

#### POST /api/properties
**Request Body:**
```javascript
{
  "address": "123 Main St, City, State 12345",
  "price": 500000,
  "bedrooms": 3,
  "bathrooms": 2,
  "square_feet": 1500,
  "property_type": "single_family",
  "listing_type": "for_sale",
  "description": "Beautiful home...",
  "features": ["garage", "pool", "garden"]
}
```

### Profile Endpoints
**Base Path:** `/api/profile`  
**Authentication:** Required for all endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user profile |
| PUT | `/` | Update user profile |
| POST | `/avatar` | Upload profile avatar |
| GET | `/stats` | Get profile statistics |

#### GET /api/profile
**Response:**
```javascript
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone": "+1234567890",
    "location": "City, State",
    "website": "https://example.com",
    "bio": "Real estate professional...",
    "avatar_url": "https://example.com/avatar.jpg",
    "years_experience": 5,
    "license_number": "RE123456",
    "brokerage": "ABC Realty",
    "specialties": ["residential", "commercial"],
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT /api/profile
**Request Body:**
```javascript
{
  "full_name": "John Doe",
  "phone": "+1234567890",
  "location": "City, State",
  "website": "https://example.com",
  "bio": "Real estate professional...",
  "years_experience": 5,
  "license_number": "RE123456",
  "brokerage": "ABC Realty",
  "specialties": ["residential", "commercial"]
}
```

#### POST /api/profile/avatar
**Request:** Multipart form data with image file
**Response:**
```javascript
{
  "success": true,
  "data": {
    "avatar_url": "https://example.com/avatar.jpg"
  }
}
```

#### GET /api/profile/stats
**Response:**
```javascript
{
  "success": true,
  "data": {
    "total_properties": 25,
    "active_listings": 12,
    "sold_properties": 8,
    "total_views": 1250,
    "recent_activity": [
      {
        "type": "property_created",
        "description": "Added new property listing",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

## 🔧 Services Configuration

### AI Services
```javascript
{
  "anthropic": {
    "model": "claude-3-sonnet-20240229",
    "maxTokens": 4000,
    "temperature": 0.7
  },
  "replicate": {
    "fluxModel": "black-forest-labs/flux-schnell"
  },
  "gemini": {
    "model": "gemini-pro"
  }
}
```

### External APIs
```javascript
{
  "googlePlaces": {
    "baseUrl": "https://maps.googleapis.com/maps/api/place"
  },
  "walkScore": {
    "baseUrl": "https://api.walkscore.com"
  },
  "greatSchools": {
    "baseUrl": "https://api.greatschools.org"
  },
  "apiNinjas": {
    "baseUrl": "https://api.api-ninjas.com/v1"
  }
}
```

### Email Service
```javascript
{
  "brevo": {
    "baseUrl": "https://api.brevo.com/v3",
    "defaultSender": {
      "name": "Nester",
      "email": "noreply@nester.ai"
    },
    "templates": {
      "welcome": 1,
      "propertyBrochure": 2,
      "leadNotification": 3,
      "chatTranscript": 4
    }
  }
}
```

### Workflow Service
```javascript
{
  "n8n": {
    "baseUrl": "http://localhost:5678"
  }
}
```

### Storage Configuration
```javascript
{
  "supabase": {
    "buckets": {
      "propertyImages": "property-images",
      "brandAssets": "brand-assets",
      "generatedContent": "generated-content",
      "socialMedia": "social-media",
      "documents": "documents",
      "temp": "temp"
    }
  },
  "upload": {
    "maxFileSize": 10485760, // 10MB
    "allowedImageTypes": ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    "allowedDocumentTypes": ["application/pdf", "application/msword"]
  }
}
```

## 🎛️ Feature Flags

```javascript
{
  "emailVerification": true,
  "socialAuth": false,
  "passwordReset": true,
  "userProfiles": true,
  "adminPanel": false,
  "aiImageRestyling": true,
  "socialCampaigns": true,
  "emailAutomation": true,
  "chatAgent": true,
  "analytics": true,
  "brandCustomization": true
}
```

## 📊 Database Schema

### Supabase Configuration
```javascript
{
  "url": "https://your-project.supabase.co",
  "anonKey": "your-anon-key",
  "serviceRoleKey": "your-service-role-key",
  "jwtSecret": "your-jwt-secret"
}
```

### Main Tables
- `users` - User accounts and profiles
- `properties` - Property listings and data
- `property_images` - Property image metadata
- `workflow_executions` - AI workflow tracking
- `api_cache` - External API response cache
- `user_sessions` - Session management
- `analytics_events` - User activity tracking

## 🔒 Security Headers

```javascript
{
  "helmet": {
    "contentSecurityPolicy": {
      "defaultSrc": ["'self'"],
      "styleSrc": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "fontSrc": ["'self'", "https://fonts.gstatic.com"],
      "imgSrc": ["'self'", "data:", "https:"],
      "scriptSrc": ["'self'"],
      "connectSrc": ["'self'", "https://api.supabase.co"]
    }
  }
}
```

## 📝 Request/Response Format

### Standard Success Response
```javascript
{
  "success": true,
  "data": {}, // Response data
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "uuid"
}
```

### Standard Error Response
```javascript
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}, // Additional error details
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "uuid"
}
```

## 🚦 HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (e.g., user already exists) |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## 🔧 Environment Variables

### Required
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Server
PORT=3000
NODE_ENV=development
```

### Optional
```bash
# Authentication
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# AI Services
ANTHROPIC_API_KEY=your-anthropic-key
REPLICATE_API_KEY=your-replicate-key
GEMINI_API_KEY=your-gemini-key

# External APIs
GOOGLE_PLACES_API_KEY=your-google-places-key
WALKSCORE_API_KEY=your-walkscore-key
GREATSCHOOLS_API_KEY=your-greatschools-key

# Email
BREVO_API_KEY=your-brevo-key

# Workflows
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your-n8n-key
```

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Health Check
```bash
npm run check-health
```

## 📚 Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon |
| `npm run build` | Build TypeScript to JavaScript |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run validate-config` | Validate configuration |
| `npm run check-health` | Check database health |

## 🔍 Logging

### Log Levels
- `error` - Error conditions
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug-level messages

### Log Configuration
```javascript
{
  "level": "info", // debug in development
  "file": {
    "enabled": true,
    "path": "./logs",
    "maxSize": "10m",
    "maxFiles": 5
  },
  "console": {
    "enabled": true,
    "colorize": true
  }
}
```

## 🔄 Workflow Integration

The server integrates with N8N workflows for:
- Property data ingestion
- AI content generation
- Social media campaigns
- Email automation
- Brand processing
- Lead processing

### Workflow Types
- `property-ingestion`
- `content-generation`
- `social-campaign`
- `email-automation`
- `brand-processing`
- `lead-processing`

## 📞 Support

For technical support or questions about this API documentation, please refer to the main project README or contact the development team.

---

**Last Updated:** 2024-01-01  
**API Version:** 1.0.0  
**Documentation Version:** 1.0.0