import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '../config';
import { logger, requestLogger } from '../utils/logger';
import { errorHandler } from '../middleware';
import routes from '../routes';
import { alertService } from '../services/AlertService';

// Validate configuration on startup
try {
  validateConfig();
  logger.info('Configuration validated successfully');
} catch (error) {
  logger.error('Configuration validation failed', { error: error.message });
  process.exit(1);
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: config.CORS_ALLOWED_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization', 
    'X-Signature',
    'X-Timestamp',
    'X-Internal-Secret',
    'X-Claim-Token'
  ]
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use(requestLogger);

// Trust proxy for rate limiting (if behind reverse proxy)
app.set('trust proxy', 1);

// API routes
app.use('/api', routes);

// Health check route (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.NODE_ENV
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', { 
    path: req.path,
    method: req.method 
  });
  
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');
  
  // Close server
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }
    
    logger.info('Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, starting graceful shutdown');
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }
    
    logger.info('Server closed gracefully');
    process.exit(0);
  });
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { 
    reason: reason.toString(),
    promise: promise.toString()
  });
  
  // Don't exit in production, just log
  if (config.NODE_ENV === 'development') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  
  // Exit gracefully
  process.exit(1);
});

// Start server
const server = app.listen(config.PORT, () => {
  logger.info('API server started', {
    port: config.PORT,
    environment: config.NODE_ENV,
    cors_origin: config.CORS_ALLOWED_ORIGIN,
    pterodactyl_url: config.PT_APP_BASE_URL
  });
  
  // Send startup notification
  if (config.NODE_ENV === 'production') {
    alertService.sendStartupNotification().catch(error => {
      logger.error('Failed to send startup notification', { error: error.message });
    });
  }
});

// Set server timeout (5 minutes for long-running operations)
server.timeout = 5 * 60 * 1000;

export { app, server };
