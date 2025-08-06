import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { FailureCode } from '@wa-ptero-claim/shared-types';

export interface AlertData {
  claimId: string;
  waJid: string;
  template?: string;
  nodeId?: number;
  allocationId?: number;
  failureCode: FailureCode;
  failureReason: string;
  timestamp: string;
}

export class AlertService {
  // Send failure alert
  async sendFailureAlert(data: AlertData): Promise<void> {
    const title = `🚨 [${config.ALERT_ENV}] Claim Failed (${data.failureCode})`;
    
    const fields = [
      { name: 'Claim ID', value: data.claimId, inline: true },
      { name: 'WA JID', value: this.maskJID(data.waJid), inline: true },
      { name: 'Error Code', value: data.failureCode, inline: true },
      { name: 'Error Reason', value: data.failureReason, inline: false },
      { name: 'Timestamp', value: data.timestamp, inline: true }
    ];

    if (data.template) {
      fields.push({ name: 'Template', value: data.template, inline: true });
    }

    if (data.nodeId) {
      fields.push({ name: 'Node ID', value: data.nodeId.toString(), inline: true });
    }

    if (data.allocationId) {
      fields.push({ name: 'Allocation ID', value: data.allocationId.toString(), inline: true });
    }

    const color = this.getAlertColor(data.failureCode);

    if (config.DISCORD_WEBHOOK_URL) {
      await this.sendDiscordAlert(title, fields, color);
    } else if (config.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert(title, fields, color);
    } else {
      logger.warn('No webhook URL configured for alerts', data);
    }
  }

  // Send Discord webhook
  private async sendDiscordAlert(
    title: string, 
    fields: Array<{name: string, value: string, inline: boolean}>,
    color: number
  ): Promise<void> {
    try {
      const payload = {
        embeds: [{
          title,
          fields,
          color,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'WA-Ptero-Claim Alert System'
          }
        }]
      };

      await axios.post(config.DISCORD_WEBHOOK_URL!, payload, {
        timeout: 10000
      });

      logger.info('Discord alert sent successfully');
    } catch (error) {
      logger.error('Failed to send Discord alert', { 
        error: error.message,
        title 
      });
    }
  }

  // Send Slack webhook
  private async sendSlackAlert(
    title: string,
    fields: Array<{name: string, value: string, inline: boolean}>,
    color: number
  ): Promise<void> {
    try {
      const slackFields = fields.map(field => ({
        title: field.name,
        value: field.value,
        short: field.inline
      }));

      const payload = {
        attachments: [{
          color: color === 0xff0000 ? 'danger' : 'warning',
          title,
          fields: slackFields,
          ts: Math.floor(Date.now() / 1000),
          footer: 'WA-Ptero-Claim Alert System'
        }]
      };

      await axios.post(config.SLACK_WEBHOOK_URL!, payload, {
        timeout: 10000
      });

      logger.info('Slack alert sent successfully');
    } catch (error) {
      logger.error('Failed to send Slack alert', { 
        error: error.message,
        title 
      });
    }
  }

  // Get alert color based on failure code
  private getAlertColor(failureCode: FailureCode): number {
    switch (failureCode) {
      case 'NO_ALLOC':
      case 'NODE_FULL':
        return 0xff9900; // Orange - resource issues
      case 'API_DOWN':
      case 'BOT_TIMEOUT':
        return 0xff0000; // Red - service issues
      case 'EGG_INVALID':
      case 'USER_EXISTS':
        return 0xffff00; // Yellow - configuration issues
      case 'HEALTHCHECK_TIMEOUT':
        return 0xff6600; // Dark orange - server issues
      default:
        return 0x999999; // Gray - unknown
    }
  }

  // Mask sensitive parts of JID for privacy
  private maskJID(jid: string): string {
    if (jid.length <= 8) return jid;
    
    const parts = jid.split('@');
    if (parts.length !== 2) return jid;
    
    const number = parts[0];
    const domain = parts[1];
    
    if (number.length <= 4) return jid;
    
    const masked = number.substring(0, 4) + '*'.repeat(number.length - 4);
    return `${masked}@${domain}`;
  }

  // Send general notification (for operational events)
  async sendNotification(
    level: 'info' | 'warning' | 'error',
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    const emoji = level === 'error' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
    const fullTitle = `${emoji} [${config.ALERT_ENV}] ${title}`;
    
    const fields = [
      { name: 'Message', value: message, inline: false },
      { name: 'Environment', value: config.ALERT_ENV, inline: true },
      { name: 'Timestamp', value: new Date().toISOString(), inline: true }
    ];

    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        fields.push({
          name: key,
          value: String(value),
          inline: true
        });
      });
    }

    const color = level === 'error' ? 0xff0000 : level === 'warning' ? 0xff9900 : 0x00ff00;

    if (config.DISCORD_WEBHOOK_URL) {
      await this.sendDiscordAlert(fullTitle, fields, color);
    } else if (config.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert(fullTitle, fields, color);
    }
  }

  // Send startup notification
  async sendStartupNotification(): Promise<void> {
    await this.sendNotification(
      'info',
      'Backend Started',
      'WA-Ptero-Claim backend service has started successfully',
      {
        'Node Environment': config.NODE_ENV,
        'Port': config.PORT
      }
    );
  }

  // Send queue metrics notification
  async sendQueueMetrics(metrics: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }): Promise<void> {
    if (metrics.failed > 10) { // Only alert if failed jobs exceed threshold
      await this.sendNotification(
        'warning',
        'High Queue Failure Rate',
        `Queue has ${metrics.failed} failed jobs`,
        metrics
      );
    }
  }
}

export const alertService = new AlertService();
