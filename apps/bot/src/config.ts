import { BotConfig } from '@wa-ptero-claim/shared-types';
import dotenv from 'dotenv';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    logger.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function getEnvVarInt(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    logger.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    logger.error(`❌ Invalid integer value for ${name}: ${value}`);
    process.exit(1);
  }
  return parsed;
}

export const config: BotConfig = {
  TARGET_GROUP_ID: getEnvVar('TARGET_GROUP_ID'),
  BACKEND_WEBHOOK_URL: getEnvVar('BACKEND_WEBHOOK_URL'),
  INTERNAL_SECRET: getEnvVar('INTERNAL_SECRET'),
  RPC_PORT: getEnvVarInt('RPC_PORT', 3001)
};

// Validate group ID format
if (!config.TARGET_GROUP_ID.match(/^\d+@g\.us$/)) {
  logger.error(`❌ Invalid TARGET_GROUP_ID format: ${config.TARGET_GROUP_ID}. Expected format: 123456789@g.us`);
  process.exit(1);
}

// Validate webhook URL
try {
  new URL(config.BACKEND_WEBHOOK_URL);
} catch (error) {
  logger.error(`❌ Invalid BACKEND_WEBHOOK_URL: ${config.BACKEND_WEBHOOK_URL}`);
  process.exit(1);
}

logger.info('📋 Bot configuration loaded successfully');
logger.info(`🎯 Target Group: ${config.TARGET_GROUP_ID}`);
logger.info(`🔗 Webhook URL: ${config.BACKEND_WEBHOOK_URL}`);
logger.info(`🔌 RPC Port: ${config.RPC_PORT}`);
