import net from 'net';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface HealthCheckResult {
  success: boolean;
  message: string;
  retries: number;
  totalTimeMs: number;
}

export class HealthCheckService {
  // Perform TCP health check with retries
  async checkTCP(
    host: string, 
    port: number, 
    timeoutSec: number = 5,
    retries: number = 3,
    retryDelaySec: number = 2
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const success = await this.singleTCPCheck(host, port, timeoutSec);
        
        if (success) {
          const totalTimeMs = Date.now() - startTime;
          logger.info('Health check passed', { 
            host, 
            port, 
            attempt, 
            totalTimeMs 
          });
          
          return {
            success: true,
            message: `TCP connection successful on attempt ${attempt}`,
            retries: attempt,
            totalTimeMs
          };
        }
      } catch (error) {
        logger.warn('Health check attempt failed', { 
          host, 
          port, 
          attempt, 
          error: error.message 
        });
      }
      
      // Wait before retry (except for last attempt)
      if (attempt < retries) {
        await this.delay(retryDelaySec * 1000);
      }
    }
    
    const totalTimeMs = Date.now() - startTime;
    const message = `TCP connection failed after ${retries} attempts`;
    
    logger.error('Health check failed', { 
      host, 
      port, 
      retries, 
      totalTimeMs 
    });
    
    return {
      success: false,
      message,
      retries,
      totalTimeMs
    };
  }

  // Single TCP connection attempt
  private async singleTCPCheck(
    host: string, 
    port: number, 
    timeoutSec: number
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeoutMs = timeoutSec * 1000;
      
      let isResolved = false;
      
      const cleanup = () => {
        if (!socket.destroyed) {
          socket.destroy();
        }
      };
      
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(new Error(`Connection timeout after ${timeoutSec}s`));
        }
      }, timeoutMs);
      
      socket.on('connect', () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve(true);
        }
      });
      
      socket.on('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          cleanup();
          reject(error);
        }
      });
      
      socket.connect(port, host);
    });
  }

  // Get health check host (with override support)
  getHealthCheckHost(allocationIp: string, allocationAlias?: string): string {
    // Use override if configured
    if (config.HEALTHCHECK_HOST_OVERRIDE) {
      return config.HEALTHCHECK_HOST_OVERRIDE;
    }
    
    // Prefer alias over IP
    return allocationAlias || allocationIp;
  }

  // Delay utility
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check with stabilization window
  async checkServerHealth(
    allocationIp: string,
    allocationPort: number,
    allocationAlias?: string,
    healthCheckConfig?: {
      timeoutSec: number;
      retries: number;
      retryDelaySec: number;
    }
  ): Promise<HealthCheckResult> {
    const host = this.getHealthCheckHost(allocationIp, allocationAlias);
    const config = healthCheckConfig || {
      timeoutSec: 5,
      retries: 3,
      retryDelaySec: 2
    };
    
    logger.info('Starting server health check', {
      host,
      port: allocationPort,
      config
    });
    
    return this.checkTCP(
      host,
      allocationPort,
      config.timeoutSec,
      config.retries,
      config.retryDelaySec
    );
  }
}

export const healthCheckService = new HealthCheckService();
