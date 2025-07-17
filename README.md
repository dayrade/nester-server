# Nester Authentication System

A robust, production-ready authentication system built with Express.js and Supabase, featuring comprehensive security measures, structured logging, and extensive error handling.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn
- Supabase project configured

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp ../.env.example .env
# Edit .env with your configuration
```

### Development

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Build TypeScript (if using TS files)
npm run build

# Start built production server
npm run start:prod
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Clean build directory
npm run clean
```

## 📁 Project Structure

```
server/
├── config/           # Database and service configurations
├── controller/       # Route controllers
├── middlewares/      # Express middlewares
├── routes/          # API route definitions
├── services/        # Business logic services
├── supabase/        # Database setup and migrations
├── server.js        # Main server entry point
├── package.json     # Backend dependencies
└── tsconfig.json    # TypeScript configuration
```

## 🔧 Configuration

The server uses environment variables for configuration. Key variables:

- `PORT` - Server port (default: 3001)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `NODE_ENV` - Environment (development/production)

## 🛡️ Security Features

- CORS protection
- Rate limiting
- Helmet security headers
- Input validation
- Authentication middleware

## 📊 Monitoring

- Sentry error tracking
- Performance monitoring
- Request logging

## 🚀 Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

## 🔗 API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/*` - Authentication endpoints
- `GET/POST/PUT/DELETE /api/properties/*` - Property management
- `GET /api/analytics/*` - Analytics data

For detailed API documentation, see the main project README.

## 🤝 Contributing

When working on the backend:

1. Follow TypeScript best practices
2. Add tests for new features
3. Run linting before commits
4. Update this README for new endpoints

## 📝 Notes

- This server runs independently from the Next.js frontend
- Database migrations are handled via Supabase
- All API routes are prefixed with `/api`
- CORS is configured to allow frontend requests