import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { CreateClaimJobData, DeleteServerJobData } from '@wa-ptero-claim/shared-types';
import { config, gracePeriodHours } from '../config';
import { logger } from '../utils/logger';
import { ClaimsRepository } from '../repositories/ClaimsRepository';
import { pterodactylService } from '../services/PterodactylService';
import { healthCheckService } from '../services/HealthCheckService';
import { botRPCService } from '../services/BotRPCService';
import { alertService } from '../services/AlertService';

// Redis connection for BullMQ
const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100
});

const claimsRepo = new ClaimsRepository();

// Create Claim Worker
export const createClaimWorker = new Worker(
  'create-claim',
  async (job: Job<CreateClaimJobData>) => {
    const { claimId } = job.data;
    
    logger.info('Starting create claim job', { 
      job_id: job.id,
      claim_id: claimId 
    });

    try {
      // Get claim record
      const claim = await claimsRepo.findClaimById(claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Check if already processed (idempotency)
      if (claim.status !== 'creating') {
        logger.info('Claim already processed, skipping', { 
          claim_id: claimId,
          status: claim.status 
        });
        return { status: 'already_processed', claim_id: claimId };
      }

      // Get template
      const template = pterodactylService.getTemplate(claim.template);
      if (!template) {
        await handleClaimFailure(claim, 'EGG_INVALID', `Template '${claim.template}' not found`);
        return { status: 'failed', reason: 'template_not_found' };
      }

      // Allocate server with fallback
      const serverName = `${claim.ptero_username}-${claim.template}`;
      const description = `Auto-claimed ${claim.template} server for ${claim.ptero_username}`;

      logger.info('Allocating server with Pterodactyl', { 
        claim_id: claimId,
        server_name: serverName,
        template: claim.template 
      });

      const allocation = await pterodactylService.allocateServerWithFallback({
        waJid: claim.wa_jid,
        username: claim.ptero_username!,
        template: claim.template,
        serverName,
        description
      });

      // Update claim with server details
      await claimsRepo.updateClaim(claimId, {
        user_id: allocation.user.id,
        server_id: allocation.server.id,
        allocation_id: allocation.allocation.id,
        ptero_panel_url: config.PT_APP_BASE_URL
      });

      logger.info('Server created, waiting for installation', { 
        claim_id: claimId,
        server_id: allocation.server.id,
        user_id: allocation.user.id 
      });

      // Wait for server installation and perform health check
      const healthCheckResult = await waitForServerAndHealthCheck(
        allocation.server.id,
        allocation.allocation.ip,
        allocation.allocation.port,
        allocation.allocation.ip_alias,
        template.healthcheck
      );

      if (!healthCheckResult.success) {
        await handleClaimFailure(
          claim, 
          'HEALTHCHECK_TIMEOUT', 
          `Health check failed: ${healthCheckResult.message}`
        );
        return { status: 'failed', reason: 'healthcheck_failed' };
      }

      // Mark as active
      await claimsRepo.updateClaimStatus(claimId, 'active');
      await claimsRepo.updateClaim(claimId, {
        last_healthcheck_at: new Date().toISOString()
      });

      // Send credentials to user
      await botRPCService.sendServerCredentials(claim.wa_jid, {
        panelUrl: config.PT_APP_BASE_URL,
        username: allocation.user.username,
        password: allocation.password,
        serverName,
        allocationIp: allocation.allocation.ip,
        allocationPort: allocation.allocation.port
      });

      logger.info('Claim completed successfully', { 
        claim_id: claimId,
        total_time_ms: Date.now() - new Date(claim.created_at).getTime()
      });

      return { 
        status: 'success', 
        claim_id: claimId,
        server_id: allocation.server.id 
      };

    } catch (error) {
      logger.error('Create claim job failed', { 
        job_id: job.id,
        claim_id: claimId,
        error: error.message 
      });

      const claim = await claimsRepo.findClaimById(claimId);
      if (claim) {
        const failureCode = determineFailureCode(error.message);
        await handleClaimFailure(claim, failureCode, error.message);
      }

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2, // Process 2 claims concurrently
    removeOnComplete: 10,
    removeOnFail: 50
  }
);

// Delete Server Worker
export const deleteServerWorker = new Worker(
  'delete-server',
  async (job: Job<DeleteServerJobData>) => {
    const { claimId } = job.data;
    
    logger.info('Starting delete server job', { 
      job_id: job.id,
      claim_id: claimId 
    });

    try {
      // Get claim record
      const claim = await claimsRepo.findClaimById(claimId);
      if (!claim) {
        logger.warn('Claim not found for deletion', { claim_id: claimId });
        return { status: 'not_found', claim_id: claimId };
      }

      // Check if deletion was cancelled (user rejoined)
      if (claim.status !== 'deleting') {
        logger.info('Deletion cancelled, user rejoined', { 
          claim_id: claimId,
          status: claim.status 
        });
        return { status: 'cancelled', claim_id: claimId };
      }

      // Delete server if exists
      if (claim.server_id) {
        logger.info('Deleting Pterodactyl server', { 
          claim_id: claimId,
          server_id: claim.server_id 
        });
        
        await pterodactylService.deleteServer(claim.server_id);
      }

      // Delete user if exists and empty
      if (claim.user_id) {
        logger.info('Checking if user can be deleted', { 
          claim_id: claimId,
          user_id: claim.user_id 
        });
        
        await pterodactylService.deleteUserIfEmpty(claim.user_id);
      }

      // Mark claim as deleted
      await claimsRepo.updateClaimStatus(claimId, 'deleted');
      await claimsRepo.updateClaim(claimId, {
        delete_job_id: undefined,
        deletion_scheduled_at: undefined
      });

      logger.info('Server deletion completed', { claim_id: claimId });

      return { status: 'success', claim_id: claimId };

    } catch (error) {
      logger.error('Delete server job failed', { 
        job_id: job.id,
        claim_id: claimId,
        error: error.message 
      });

      // Alert about deletion failure
      const claim = await claimsRepo.findClaimById(claimId);
      if (claim) {
        await alertService.sendFailureAlert({
          claimId: claim.claim_id,
          waJid: claim.wa_jid,
          template: claim.template,
          nodeId: undefined,
          allocationId: claim.allocation_id,
          failureCode: 'API_DOWN',
          failureReason: `Deletion failed: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1, // Process deletions sequentially
    removeOnComplete: 10,
    removeOnFail: 50
  }
);

// Wait for server installation and perform health check
async function waitForServerAndHealthCheck(
  serverId: number,
  allocationIp: string,
  allocationPort: number,
  allocationAlias?: string,
  healthCheckConfig?: any
): Promise<{ success: boolean; message: string }> {
  const maxWaitMinutes = 10;
  const checkIntervalSec = 30;
  const maxChecks = (maxWaitMinutes * 60) / checkIntervalSec;
  
  logger.info('Waiting for server installation', { 
    server_id: serverId,
    max_wait_minutes: maxWaitMinutes 
  });

  // Wait for installation to complete
  for (let i = 0; i < maxChecks; i++) {
    try {
      const status = await pterodactylService.getServerStatus(serverId);
      
      logger.debug('Server status check', { 
        server_id: serverId,
        status: status.status,
        suspended: status.suspended,
        installing: status.installing,
        check: i + 1 
      });

      if (status.suspended) {
        return { 
          success: false, 
          message: 'Server is suspended' 
        };
      }

      if (!status.installing && status.status === 'offline') {
        // Installation complete, now do health check
        logger.info('Installation complete, performing health check', { 
          server_id: serverId 
        });

        const healthResult = await healthCheckService.checkServerHealth(
          allocationIp,
          allocationPort,
          allocationAlias,
          healthCheckConfig
        );

        return healthResult;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkIntervalSec * 1000));
      
    } catch (error) {
      logger.error('Error checking server status', { 
        server_id: serverId,
        error: error.message 
      });
    }
  }

  return { 
    success: false, 
    message: `Installation timeout after ${maxWaitMinutes} minutes` 
  };
}

// Handle claim failure
async function handleClaimFailure(
  claim: any,
  failureCode: string,
  failureReason: string
): Promise<void> {
  // Update claim status
  await claimsRepo.updateClaim(claim.claim_id, {
    status: 'failed',
    failure_code: failureCode,
    failure_reason: failureReason
  });

  // Send alert
  await alertService.sendFailureAlert({
    claimId: claim.claim_id,
    waJid: claim.wa_jid,
    template: claim.template,
    nodeId: undefined,
    allocationId: claim.allocation_id,
    failureCode: failureCode as any,
    failureReason,
    timestamp: new Date().toISOString()
  });

  logger.error('Claim failed', { 
    claim_id: claim.claim_id,
    failure_code: failureCode,
    failure_reason: failureReason 
  });
}

// Determine failure code from error message
function determineFailureCode(errorMessage: string): string {
  if (errorMessage.includes('NO_ALLOC')) return 'NO_ALLOC';
  if (errorMessage.includes('Template') && errorMessage.includes('not found')) return 'EGG_INVALID';
  if (errorMessage.includes('BOT_TIMEOUT')) return 'BOT_TIMEOUT';
  if (errorMessage.includes('Connection') || errorMessage.includes('timeout')) return 'API_DOWN';
  if (errorMessage.includes('Health check')) return 'HEALTHCHECK_TIMEOUT';
  return 'UNKNOWN';
}

// Worker error handlers
createClaimWorker.on('failed', (job, err) => {
  logger.error('Create claim worker job failed', { 
    job_id: job?.id,
    error: err.message 
  });
});

deleteServerWorker.on('failed', (job, err) => {
  logger.error('Delete server worker job failed', { 
    job_id: job?.id,
    error: err.message 
  });
});

logger.info('BullMQ workers initialized');
