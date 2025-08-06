import dotenv from 'dotenv';
import { BackendConfig } from '@wa-ptero-claim/shared-types';

// Load environment variables
dotenv.config();

// Parse and validate configuration
export const config: BackendConfig = {
  // Pterodactyl Configuration
  PT_APP_BASE_URL: process.env.PT_APP_BASE_URL || '',
  PT_APP_API_KEY: process.env.PT_APP_API_KEY || '',
  PT_NODE_ID: parseInt(process.env.PT_NODE_ID || '1'),
  PT_FALLBACK_NODE_IDS: process.env.PT_FALLBACK_NODE_IDS,
  HEALTHCHECK_HOST_OVERRIDE: process.env.HEALTHCHECK_HOST_OVERRIDE,
  
  // Default Resources
  DEFAULT_SERVER_MEMORY_MB: parseInt(process.env.DEFAULT_SERVER_MEMORY_MB || '1024'),
  DEFAULT_SERVER_DISK_MB: parseInt(process.env.DEFAULT_SERVER_DISK_MB || '10240'),
  DEFAULT_SERVER_CPU_PCT: parseInt(process.env.DEFAULT_SERVER_CPU_PCT || '100'),
  
  // Queue & Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  QUEUE_PREFIX: process.env.QUEUE_PREFIX || 'wa-ptero',
  
  // Security
  INTERNAL_SECRET: process.env.INTERNAL_SECRET || '',
  CORS_ALLOWED_ORIGIN: process.env.CORS_ALLOWED_ORIGIN || 'http://localhost:3000',
  CLAIM_STATUS_REQUIRE_TOKEN: process.env.CLAIM_STATUS_REQUIRE_TOKEN === 'true',
  
  // Alerts
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  ALERT_ENV: process.env.ALERT_ENV || 'development',
  
  // Server
  PORT: parseInt(process.env.PORT || '3001'),
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validation
export function validateConfig(): void {
  const required = [
    'PT_APP_BASE_URL',
    'PT_APP_API_KEY', 
    'INTERNAL_SECRET'
  ];
  
  const missing = required.filter(key => !config[key as keyof BackendConfig]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (!config.PT_APP_API_KEY.startsWith('ptla_')) {
    throw new Error('PT_APP_API_KEY must be an Application API key (starts with ptla_)');
  }
}

// Parse fallback node IDs
export function getFallbackNodeIds(): number[] {
  if (!config.PT_FALLBACK_NODE_IDS) return [];
  
  return config.PT_FALLBACK_NODE_IDS
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id));
}

// Get rate limit configuration
export const rateLimitConfig = {
  ipPerMin: parseInt(process.env.RATE_LIMIT_IP_PER_MIN || '20'),
  jidPerMin: parseInt(process.env.RATE_LIMIT_JID_PER_MIN || '5')
};

// Grace period configuration
export const gracePeriodHours = parseInt(process.env.GRACE_PERIOD_HOURS || '4');

// Data directory
export const dataDir = process.env.DATA_DIR || './data';
