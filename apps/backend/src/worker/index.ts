import { config, validateConfig } from '../config';
import { logger } from '../utils/logger';
import { alertService } from '../services/AlertService';
import { createClaimWorker, deleteServerWorker } from '../workers';
import { getQueueStats, cleanupOldJobs } from '../queue';

// Validate configuration on startup
try {
  validateConfig();
  logger.info('Worker configuration validated successfully');
} catch (error) {
  logger.error('Worker configuration validation failed', { error: error.message });
  process.exit(1);
}

// Start workers
logger.info('Starting BullMQ workers', {
  environment: config.NODE_ENV,
  redis_url: config.REDIS_URL,
  queue_prefix: config.QUEUE_PREFIX
});

// Graceful shutdown handling
async function gracefulShutdown(): Promise<void> {
  logger.info('Starting graceful worker shutdown');
  
  try {
    // Close workers
    await Promise.all([
      createClaimWorker.close(),
      deleteServerWorker.close()
    ]);
    
    logger.info('All workers closed gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during worker shutdown', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason: any, promise) => {
  logger.error('Unhandled promise rejection in worker', { 
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
  logger.error('Uncaught exception in worker', {
    error: error.message,
    stack: error.stack
  });
  
  // Exit gracefully
  process.exit(1);
});

// Periodic maintenance tasks
const MAINTENANCE_INTERVAL = 60 * 60 * 1000; // 1 hour

setInterval(async () => {
  try {
    logger.debug('Running periodic maintenance');
    
    // Cleanup old jobs
    await cleanupOldJobs();
    
    // Send queue metrics if needed
    const stats = await getQueueStats();
    await alertService.sendQueueMetrics({
      waiting: stats.createClaim.waiting + stats.deleteServer.waiting,
      active: stats.createClaim.active + stats.deleteServer.active,
      completed: stats.createClaim.completed + stats.deleteServer.completed,
      failed: stats.createClaim.failed + stats.deleteServer.failed
    });
    
  } catch (error) {
    logger.error('Error during periodic maintenance', { error: error.message });
  }
}, MAINTENANCE_INTERVAL);

logger.info('Worker process started successfully');

// Send startup notification in production
if (config.NODE_ENV === 'production') {
  alertService.sendNotification(
    'info',
    'Worker Started',
    'WA-Ptero-Claim worker process has started successfully',
    {
      'Environment': config.NODE_ENV,
      'Queue Prefix': config.QUEUE_PREFIX
    }
  ).catch(error => {
    logger.error('Failed to send worker startup notification', { error: error.message });
  });
}

// Keep process alive
process.stdin.resume();
