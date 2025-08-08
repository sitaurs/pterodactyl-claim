import axios, { AxiosInstance } from 'axios';
import { CheckMemberRequest, CheckMemberResponse } from '@wa-ptero-claim/shared-types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class BotRPCService {
  private client: AxiosInstance;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second
  
  constructor() {
    // Bot RPC runs on localhost with internal port
    const botRPCUrl = 'http://localhost:3002'; // Default bot RPC port
    
    this.client = axios.create({
      baseURL: botRPCUrl,
      timeout: 15000, // Increased timeout to 15 seconds
      headers: {
        'X-Internal-Secret': config.INTERNAL_SECRET,
        'Content-Type': 'application/json'
      }
    });
  }

  // Check if user is member of target group with retry logic
  async checkMember(waJid: string): Promise<CheckMemberResponse> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const request: CheckMemberRequest = { wa_jid: waJid };
        
        logger.debug(`Checking member status via bot RPC (attempt ${attempt}/${this.maxRetries})`, { wa_jid: waJid });
        
        const response = await this.client.post('/check-member', request);
        const result = response.data as CheckMemberResponse;
        
        logger.info('Member check completed', { 
          wa_jid: waJid,
          is_member: result.isMember,
          group_id: result.groupId,
          attempt
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status ?? 0;
          const message = error.response?.data?.error || error.message;
          
          logger.warn(`Bot RPC member check failed (attempt ${attempt}/${this.maxRetries})`, {
            wa_jid: waJid,
            status,
            message,
            error: error.message
          });
          
          // Don't retry on certain error codes
          if (status === 403 || status === 401) {
            throw new Error('BOT_AUTH_ERROR: Authentication failed');
          }
          
          // If this is the last attempt, throw the error
          if (attempt === this.maxRetries) {
            if (status === 404 || status === 0) {
              throw new Error('BOT_TIMEOUT: Bot service unavailable');
            } else if (status >= 500) {
              throw new Error('BOT_TIMEOUT: Bot service error');
            }
          }
        } else {
          logger.warn(`Unexpected error in member check (attempt ${attempt}/${this.maxRetries})`, { 
            error: error.message, 
            wa_jid: waJid 
          });
        }
        
        // Wait before retry (except on last attempt)
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
    
    logger.error('All member check attempts failed', { wa_jid: waJid, maxRetries: this.maxRetries });
    throw new Error('BOT_TIMEOUT: Failed to verify membership after retries');
  }

  // Send notification message to user
  async sendMessage(waJid: string, message: string): Promise<void> {
    try {
      const payload = {
        wa_jid: waJid,
        message: message
      };
      
      logger.debug('Sending message via bot RPC', { wa_jid: waJid });
      
      await this.client.post('/send-message', payload);
      
      logger.info('Message sent successfully', { wa_jid: waJid });
    } catch (error) {
      logger.error('Failed to send message via bot', { 
        error: error.message,
        wa_jid: waJid 
      });
      // Don't throw error for message sending failures
      // This is not critical to the main flow
    }
  }

  // Send server credentials to user
  async sendServerCredentials(
    waJid: string, 
    serverDetails: {
      panelUrl: string;
      username: string;
      password: string;
      serverName: string;
      allocationIp: string;
      allocationPort: number;
    }
  ): Promise<void> {
    const message = `🎉 **Server Anda Siap!**

✅ Server: ${serverDetails.serverName}
🌐 Panel: ${serverDetails.panelUrl}
👤 Username: ${serverDetails.username}
🔑 Password: ${serverDetails.password}
📡 IP:Port: ${serverDetails.allocationIp}:${serverDetails.allocationPort}

⚠️ **PENTING:** Segera login dan ganti password Anda!
🔒 Jangan bagikan kredensial ini kepada siapa pun.

Selamat coding! 🚀`;

    await this.sendMessage(waJid, message);
  }

  // Send deletion warning
  async sendDeletionWarning(waJid: string, hoursRemaining: number): Promise<void> {
    const message = `⚠️ **Peringatan Penghapusan Server**

Kami mendeteksi Anda telah keluar dari grup. Server Anda akan dihapus dalam ${hoursRemaining} jam jika Anda tidak bergabung kembali.

📅 Jadwal hapus: ${new Date(Date.now() + hoursRemaining * 60 * 60 * 1000).toLocaleString('id-ID')}

🔄 Untuk membatalkan penghapusan, segera bergabung kembali ke grup.

💾 Pastikan Anda sudah mem-backup data penting dari server.`;

    await this.sendMessage(waJid, message);
  }

  // Send deletion cancelled message
  async sendDeletionCancelled(waJid: string): Promise<void> {
    const message = `✅ **Penghapusan Server Dibatalkan**

Selamat datang kembali! Penghapusan server Anda telah dibatalkan karena Anda bergabung kembali ke grup.

Server Anda kembali aktif dan siap digunakan. 🎉`;

    await this.sendMessage(waJid, message);
  }

  // Health check bot service
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch (error) {
      logger.warn('Bot RPC health check failed', { error: error.message });
      return false;
    }
  }
}

export const botRPCService = new BotRPCService();
