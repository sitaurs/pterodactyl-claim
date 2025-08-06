import fs from 'fs/promises';
import path from 'path';
import lockfile from 'proper-lockfile';
import { ClaimRecord, ClaimStatus } from '@wa-ptero-claim/shared-types';
import { logger } from '../utils/logger';
import { dataDir } from '../config';
import { generateUUID } from '../utils/crypto';

export class ClaimsRepository {
  private readonly filePath: string;
  private readonly lockFilePath: string;

  constructor() {
    this.filePath = path.join(dataDir, 'claims.json');
    this.lockFilePath = `${this.filePath}.lock`;
  }

  // Ensure data directory and file exist
  private async ensureFileExists(): Promise<void> {
    try {
      await fs.mkdir(dataDir, { recursive: true });
      
      try {
        await fs.access(this.filePath);
      } catch {
        // File doesn't exist, create empty array
        await fs.writeFile(this.filePath, JSON.stringify([], null, 2), 'utf8');
        logger.info('Created new claims.json file');
      }
    } catch (error) {
      logger.error('Failed to ensure claims file exists', { error });
      throw error;
    }
  }

  // Read claims with file locking
  private async readClaims(): Promise<ClaimRecord[]> {
    await this.ensureFileExists();
    
    let release: (() => Promise<void>) | null = null;
    
    try {
      // Acquire lock
      release = await lockfile.lock(this.filePath, {
        stale: 10000, // 10 seconds
        retries: 3
      });
      
      const data = await fs.readFile(this.filePath, 'utf8');
      const claims = JSON.parse(data) as ClaimRecord[];
      
      return Array.isArray(claims) ? claims : [];
    } catch (error) {
      logger.error('Failed to read claims file', { error });
      return [];
    } finally {
      if (release) {
        await release();
      }
    }
  }

  // Write claims with atomic write and file locking
  private async writeClaims(claims: ClaimRecord[]): Promise<void> {
    await this.ensureFileExists();
    
    let release: (() => Promise<void>) | null = null;
    
    try {
      // Acquire lock
      release = await lockfile.lock(this.filePath, {
        stale: 10000,
        retries: 3
      });
      
      // Atomic write: write to temp file first, then rename
      const tempPath = `${this.filePath}.tmp`;
      const data = JSON.stringify(claims, null, 2);
      
      await fs.writeFile(tempPath, data, 'utf8');
      await fs.rename(tempPath, this.filePath);
      
      logger.debug('Successfully wrote claims file', { count: claims.length });
    } catch (error) {
      logger.error('Failed to write claims file', { error });
      throw error;
    } finally {
      if (release) {
        await release();
      }
    }
  }

  // Create new claim record
  async createClaim(data: {
    wa_jid: string;
    template: string;
    ptero_username: string;
  }): Promise<ClaimRecord> {
    const claims = await this.readClaims();
    
    const now = new Date().toISOString();
    const newClaim: ClaimRecord = {
      claim_id: generateUUID(),
      wa_jid: data.wa_jid,
      status: 'creating',
      template: data.template,
      ptero_username: data.ptero_username,
      created_at: now,
      updated_at: now
    };
    
    claims.push(newClaim);
    await this.writeClaims(claims);
    
    logger.info('Created new claim', { 
      claim_id: newClaim.claim_id,
      wa_jid: data.wa_jid,
      template: data.template 
    });
    
    return newClaim;
  }

  // Find claim by ID
  async findClaimById(claimId: string): Promise<ClaimRecord | null> {
    const claims = await this.readClaims();
    return claims.find(claim => claim.claim_id === claimId) || null;
  }

  // Find claim by WA JID
  async findClaimByJID(waJid: string): Promise<ClaimRecord | null> {
    const claims = await this.readClaims();
    return claims.find(claim => claim.wa_jid === waJid) || null;
  }

  // Find active claim by WA JID
  async findActiveClaimByJID(waJid: string): Promise<ClaimRecord | null> {
    const claims = await this.readClaims();
    return claims.find(claim => 
      claim.wa_jid === waJid && 
      (claim.status === 'creating' || claim.status === 'active')
    ) || null;
  }

  // Update claim
  async updateClaim(claimId: string, updates: Partial<ClaimRecord>): Promise<ClaimRecord | null> {
    const claims = await this.readClaims();
    const index = claims.findIndex(claim => claim.claim_id === claimId);
    
    if (index === -1) {
      logger.warn('Claim not found for update', { claim_id: claimId });
      return null;
    }
    
    const updatedClaim = {
      ...claims[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    claims[index] = updatedClaim;
    await this.writeClaims(claims);
    
    logger.info('Updated claim', { 
      claim_id: claimId,
      status: updatedClaim.status,
      updates: Object.keys(updates)
    });
    
    return updatedClaim;
  }

  // Update claim status
  async updateClaimStatus(
    claimId: string, 
    status: ClaimStatus, 
    message?: string
  ): Promise<ClaimRecord | null> {
    const updates: Partial<ClaimRecord> = {
      status,
      last_event_at: new Date().toISOString()
    };
    
    if (message) {
      if (status === 'failed') {
        updates.failure_reason = message;
      }
    }
    
    return this.updateClaim(claimId, updates);
  }

  // Set deletion schedule
  async scheduleForDeletion(
    claimId: string, 
    deleteJobId: string,
    scheduledAt: Date
  ): Promise<ClaimRecord | null> {
    return this.updateClaim(claimId, {
      status: 'deleting',
      delete_job_id: deleteJobId,
      deletion_scheduled_at: scheduledAt.toISOString()
    });
  }

  // Cancel deletion schedule
  async cancelDeletion(claimId: string): Promise<ClaimRecord | null> {
    return this.updateClaim(claimId, {
      status: 'active',
      delete_job_id: undefined,
      deletion_scheduled_at: undefined
    });
  }

  // Get claims scheduled for deletion
  async getScheduledForDeletion(): Promise<ClaimRecord[]> {
    const claims = await this.readClaims();
    return claims.filter(claim => 
      claim.status === 'deleting' && 
      claim.deletion_scheduled_at
    );
  }

  // Get failed claims
  async getFailedClaims(): Promise<ClaimRecord[]> {
    const claims = await this.readClaims();
    return claims.filter(claim => claim.status === 'failed');
  }

  // Clean up old claims (older than X days)
  async cleanupOldClaims(olderThanDays: number = 30): Promise<number> {
    const claims = await this.readClaims();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const initialCount = claims.length;
    const filteredClaims = claims.filter(claim => {
      const claimDate = new Date(claim.created_at);
      const shouldKeep = claimDate > cutoffDate || 
                        claim.status === 'active' || 
                        claim.status === 'creating';
      return shouldKeep;
    });
    
    const removedCount = initialCount - filteredClaims.length;
    
    if (removedCount > 0) {
      await this.writeClaims(filteredClaims);
      logger.info('Cleaned up old claims', { 
        removed: removedCount, 
        remaining: filteredClaims.length 
      });
    }
    
    return removedCount;
  }

  // Get statistics
  async getStats(): Promise<{
    total: number;
    byStatus: Record<ClaimStatus, number>;
    activeServers: number;
  }> {
    const claims = await this.readClaims();
    
    const stats = {
      total: claims.length,
      byStatus: {
        creating: 0,
        active: 0,
        failed: 0,
        deleting: 0,
        deleted: 0
      } as Record<ClaimStatus, number>,
      activeServers: 0
    };
    
    claims.forEach(claim => {
      stats.byStatus[claim.status]++;
      if (claim.status === 'active') {
        stats.activeServers++;
      }
    });
    
    return stats;
  }
}
