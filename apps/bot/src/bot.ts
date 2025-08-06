import makeWASocket, { 
  ConnectionState, 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket,
  proto,
  GroupMetadata,
  GroupParticipant,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import axios from 'axios';
import { BotConfig, WhatsAppWebhookPayload } from '@wa-ptero-claim/shared-types';
import { logger } from './utils/logger';
import path from 'path';

export class WhatsAppBot {
  private socket: WASocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private readonly authStateDir = path.join(process.cwd(), 'auth_info');
  
  constructor(private config: BotConfig) {}

  async initialize(): Promise<void> {
    try {
      logger.info('🔄 Initializing WhatsApp connection...');
      
      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(this.authStateDir);
      
      // Create WhatsApp socket
      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: {
          level: 'silent', // Suppress Baileys logs
          child: () => ({
            level: 'silent',
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {},
            trace: () => {},
            fatal: () => {}
          }),
          info: () => {},
          error: () => {},
          warn: () => {},
          debug: () => {},
          trace: () => {},
          fatal: () => {}
        }
      });

      // Setup event handlers
      this.setupEventHandlers(saveCreds);
      
    } catch (error) {
      logger.error('❌ Failed to initialize WhatsApp connection:', error);
      throw error;
    }
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Connection updates
    this.socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('📱 QR Code generated, scan with WhatsApp:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        logger.warn('🔌 Connection closed due to:', lastDisconnect?.error);
        
        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          logger.info(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.initialize(), 5000);
        } else {
          logger.error('❌ Max reconnection attempts reached or logged out');
          this.isConnected = false;
        }
      } else if (connection === 'open') {
        logger.info('✅ WhatsApp connection opened successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Verify target group exists
        await this.verifyTargetGroup();
      }
    });

    // Save credentials on update
    this.socket.ev.on('creds.update', saveCreds);

    // Group participant updates (join/leave events)
    this.socket.ev.on('group-participants.update', async (update) => {
      await this.handleGroupParticipantUpdate(update);
    });

    // Handle messages (optional - for debugging)
    this.socket.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.key.fromMe && msg.key.remoteJid === this.config.TARGET_GROUP_ID) {
        logger.debug('📨 New message in target group:', {
          from: msg.key.participant,
          message: msg.message?.conversation || 'Non-text message'
        });
      }
    });
  }

  private async verifyTargetGroup(): Promise<void> {
    try {
      if (!this.socket) return;
      
      const groupMetadata = await this.socket.groupMetadata(this.config.TARGET_GROUP_ID);
      logger.info(`✅ Connected to target group: ${groupMetadata.subject} (${groupMetadata.participants.length} members)`);
    } catch (error) {
      logger.error(`❌ Failed to verify target group ${this.config.TARGET_GROUP_ID}:`, error);
      logger.error('🔍 Make sure the bot is added to the group and the group ID is correct');
    }
  }

  private async handleGroupParticipantUpdate(update: BaileysEventMap['group-participants.update']): Promise<void> {
    try {
      // Only handle updates for our target group
      if (update.id !== this.config.TARGET_GROUP_ID) {
        return;
      }

      logger.info(`👥 Group participant update in target group:`, {
        action: update.action,
        participants: update.participants,
        groupId: update.id
      });

      // Send webhook for each participant
      for (const participant of update.participants) {
        const payload: WhatsAppWebhookPayload = {
          action: update.action === 'add' ? 'join' : 'leave',
          wa_jid: participant,
          group_id: update.id,
          timestamp: new Date().toISOString()
        };

        await this.sendWebhook(payload);
      }

    } catch (error) {
      logger.error('❌ Error handling group participant update:', error);
    }
  }

  private async sendWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      const response = await axios.post(
        `${this.config.BACKEND_WEBHOOK_URL}/webhook/whatsapp`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.INTERNAL_SECRET}`
          },
          timeout: 10000
        }
      );

      logger.info(`✅ Webhook sent successfully:`, {
        action: payload.action,
        wa_jid: payload.wa_jid,
        status: response.status
      });

    } catch (error) {
      logger.error('❌ Failed to send webhook:', error);
      
      // Log response details if available
      if (axios.isAxiosError(error) && error.response) {
        logger.error('📄 Webhook response details:', {
          status: error.response.status,
          data: error.response.data
        });
      }
    }
  }

  async checkMembership(waJid: string): Promise<boolean> {
    try {
      if (!this.socket || !this.isConnected) {
        logger.warn('⚠️ WhatsApp not connected, cannot check membership');
        return false;
      }

      const groupMetadata = await this.socket.groupMetadata(this.config.TARGET_GROUP_ID);
      const isMember = groupMetadata.participants.some(
        (participant: GroupParticipant) => participant.id === waJid
      );

      logger.debug(`🔍 Membership check:`, {
        wa_jid: waJid,
        group_id: this.config.TARGET_GROUP_ID,
        is_member: isMember
      });

      return isMember;

    } catch (error) {
      logger.error('❌ Error checking membership:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      logger.info('🔌 Disconnecting WhatsApp socket...');
      await this.socket.logout();
      this.socket = null;
      this.isConnected = false;
    }
  }

  get connectionStatus(): boolean {
    return this.isConnected;
  }
}
