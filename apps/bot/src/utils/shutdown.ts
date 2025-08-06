import { logger } from './logger';

// Graceful shutdown handler
export function gracefulShutdown(cleanupCallback: () => Promise<void>) {
  const handleShutdown = async (signal: string) => {
    logger.info(`📡 Received ${signal}, starting graceful shutdown...`);
    
    try {
      await cleanupCallback();
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Listen for shutdown signals
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  
  // Handle Windows-specific signals
  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => handleShutdown('SIGBREAK'));
  }
}
