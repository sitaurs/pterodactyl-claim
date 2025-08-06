import axios, { AxiosInstance } from 'axios';
import { CheckMemberRequest, CheckMemberResponse } from '@wa-ptero-claim/shared-types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class BotRPCService {
  private client: AxiosInstance;
  
  constructor() {
    // Bot RPC runs on localhost with internal port
    const botRPCUrl = 'http://localhost:3002'; // Default bot RPC port
    
    this.client = axios.create({
      baseURL: botRPCUrl,
      timeout: 10000, // 10 second timeout for bot operations
      headers: {
        'X-Internal-Secret': config.INTERNAL_SECRET,
        'Content-Type': 'application/json'
      }
    });
  }

  // Check if user is member of target group
  async checkMember(waJid: string): Promise<CheckMemberResponse> {
    try {
      const request: CheckMemberRequest = { wa_jid: waJid };
      
      logger.debug('Checking member status via bot RPC', { wa_jid: waJid });
      
      const response = await this.client.post('/check-member', request);
      const result = response.data as CheckMemberResponse;
      
      logger.info('Member check completed', { 
        wa_jid: waJid,
        is_member: result.isMember,
        group_id: result.groupId 
      });
      
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 0;
        const message = error.response?.data?.error || error.message;
        
        logger.error('Bot RPC member check failed', {
          wa_jid: waJid,
          status,
          message,
          error: error.message
        });
        
        if (status === 404) {
          throw new Error('BOT_TIMEOUT: Bot service unavailable');
        } else if (status >= 500) {
          throw new Error('BOT_TIMEOUT: Bot service error');
        }
      }
      
      logger.error('Unexpected error in member check', { error, wa_jid: waJid });
      throw new Error('BOT_TIMEOUT: Failed to verify membership');
    }
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
