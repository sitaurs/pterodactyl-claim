import { config } from './config';
import { WhatsAppBot } from './bot';
import { RpcServer } from './rpc';
import { logger } from './utils/logger';
import { gracefulShutdown } from './utils/shutdown';

async function main() {
  try {
    logger.info('🚀 Starting WhatsApp Bot for Pterodactyl Claims...');
    
    // Initialize RPC Server
    const rpcServer = new RpcServer(config.RPC_PORT);
    await rpcServer.start();
    
    // Initialize WhatsApp Bot
    const bot = new WhatsAppBot(config);
    await bot.initialize();
    
    // Connect RPC to Bot
    rpcServer.setBot(bot);
    
    logger.info(`✅ WhatsApp Bot started successfully`);
    logger.info(`📱 Monitoring group: ${config.TARGET_GROUP_ID}`);
    logger.info(`🔌 RPC Server listening on port: ${config.RPC_PORT}`);
    
    // Setup graceful shutdown
    gracefulShutdown(async () => {
      logger.info('🛑 Shutting down WhatsApp Bot...');
      await rpcServer.stop();
      await bot.disconnect();
      logger.info('✅ WhatsApp Bot shut down gracefully');
    });
    
  } catch (error) {
    logger.error('❌ Failed to start WhatsApp Bot:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch((error) => {
  logger.error('❌ Fatal error in main:', error);
  process.exit(1);
});
