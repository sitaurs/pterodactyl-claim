import express from 'express';
import { CheckMemberRequest, CheckMemberResponse } from '@wa-ptero-claim/shared-types';
import { WhatsAppBot } from './bot';
import { logger } from './utils/logger';

export class RpcServer {
  private app: express.Application;
  private server: any;
  private bot: WhatsAppBot | null = null;

  constructor(private port: number) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // Basic request logging
    this.app.use((req, res, next) => {
      logger.debug(`📡 RPC Request: ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const isConnected = this.bot?.connectionStatus || false;
      res.json({
        status: 'ok',
        whatsapp_connected: isConnected,
        timestamp: new Date().toISOString()
      });
    });

    // Check membership endpoint
    this.app.post('/check-member', async (req, res) => {
      try {
        const { wa_jid }: CheckMemberRequest = req.body;

        if (!wa_jid) {
          return res.status(400).json({
            error: 'Missing wa_jid parameter'
          });
        }

        if (!this.bot) {
          return res.status(503).json({
            error: 'WhatsApp bot not initialized'
          });
        }

        const isMember = await this.bot.checkMembership(wa_jid);

        const response: CheckMemberResponse = {
          isMember,
          jid: wa_jid,
          groupId: '',  // Will be filled by bot config
          checkedAt: new Date().toISOString()
        };

        res.json(response);

      } catch (error) {
        logger.error('❌ Error in check-member endpoint:', error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found'
      });
    });

    // Error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('❌ RPC Server error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    });
  }

  setBot(bot: WhatsAppBot): void {
    this.bot = bot;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          logger.info(`🔌 RPC Server started on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('🔌 RPC Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
