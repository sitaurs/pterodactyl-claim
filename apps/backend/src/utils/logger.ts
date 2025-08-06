import winston from 'winston';
import { config } from '../config';

// Custom format to redact sensitive data
const redactSensitiveData = winston.format((info) => {
  // Fields to redact completely
  const sensitiveFields = ['password', 'token', 'api_key', 'secret'];
  
  // Fields to partially redact (show first 4 chars)
  const partialRedactFields = ['wa_jid', 'wa_number_e164'];
  
  function redactObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(redactObject);
    }
    
    const redacted = { ...obj };
    
    for (const [key, value] of Object.entries(redacted)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED]';
      } else if (partialRedactFields.some(field => lowerKey.includes(field))) {
        if (typeof value === 'string' && value.length > 4) {
          redacted[key] = value.substring(0, 4) + '*'.repeat(value.length - 4);
        }
      } else if (typeof value === 'object') {
        redacted[key] = redactObject(value);
      }
    }
    
    return redacted;
  }
  
  info.message = typeof info.message === 'string' 
    ? info.message 
    : JSON.stringify(redactObject(info.message));
    
  // Redact metadata
  Object.keys(info).forEach(key => {
    if (key !== 'level' && key !== 'message' && key !== 'timestamp') {
      info[key] = redactObject(info[key]);
    }
  });
  
  return info;
});

// Create logger instance
export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    redactSensitiveData(),
    winston.format.errors({ stack: true }),
    config.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Add file transport in production
if (config.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
  }));
}

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP request error', logData);
    } else {
      logger.info('HTTP request', logData);
    }
  });
  
  next();
};
