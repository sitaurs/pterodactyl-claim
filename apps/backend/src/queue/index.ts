import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { CreateClaimJobData, DeleteServerJobData } from '@wa-ptero-claim/shared-types';
import { config, gracePeriodHours } from '../config';
import { logger } from '../utils/logger';

// Redis connection for queues
const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100
});

// Create Claim Queue
export const createClaimQueue = new Queue<CreateClaimJobData>('create-claim', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 10,
    removeOnFail: 50
  }
});

// Delete Server Queue  
export const deleteServerQueue = new Queue<DeleteServerJobData>('delete-server', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 10,
    removeOnFail: 50
  }
});

// Add create claim job
export async function addCreateClaimJob(claimId: string): Promise<void> {
  try {
    const job = await createClaimQueue.add(
      'create-claim',
      { claimId },
      {
        jobId: claimId, // Use claim ID as job ID for idempotency
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    
    logger.info('Added create claim job to queue', { 
      claim_id: claimId,
      job_id: job.id 
    });
  } catch (error) {
    logger.error('Failed to add create claim job', { 
      claim_id: claimId,
      error: error.message 
    });
    throw error;
  }
}

// Add delete server job with delay
export async function addDeleteServerJob(
  claimId: string, 
  delayHours: number = gracePeriodHours
): Promise<string> {
  try {
    const delayMs = delayHours * 60 * 60 * 1000;
    const jobId = `delete-${claimId}-${Date.now()}`;
    
    const job = await deleteServerQueue.add(
      'delete-server',
      { claimId },
      {
        jobId,
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    
    logger.info('Added delete server job to queue', { 
      claim_id: claimId,
      job_id: job.id,
      delay_hours: delayHours,
      scheduled_at: new Date(Date.now() + delayMs).toISOString()
    });
    
    return job.id!;
  } catch (error) {
    logger.error('Failed to add delete server job', { 
      claim_id: claimId,
      error: error.message 
    });
    throw error;
  }
}

// Cancel delete server job
export async function cancelDeleteServerJob(jobId: string): Promise<boolean> {
  try {
    const job = await deleteServerQueue.getJob(jobId);
    
    if (!job) {
      logger.warn('Delete job not found for cancellation', { job_id: jobId });
      return false;
    }
    
    // Check if job is already active or completed
    if (await job.isActive()) {
      logger.warn('Cannot cancel active delete job', { job_id: jobId });
      return false;
    }
    
    if (await job.isCompleted()) {
      logger.warn('Cannot cancel completed delete job', { job_id: jobId });
      return false;
    }
    
    await job.remove();
    
    logger.info('Successfully cancelled delete server job', { job_id: jobId });
    return true;
  } catch (error) {
    logger.error('Failed to cancel delete server job', { 
      job_id: jobId,
      error: error.message 
    });
    return false;
  }
}

// Get queue statistics
export async function getQueueStats(): Promise<{
  createClaim: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  deleteServer: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}> {
  try {
    const [createStats, deleteStats] = await Promise.all([
      createClaimQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
      deleteServerQueue.getJobCounts('waiting', 'active', 'completed', 'failed')
    ]);
    
    return {
      createClaim: createStats,
      deleteServer: deleteStats
    };
  } catch (error) {
    logger.error('Failed to get queue stats', { error: error.message });
    return {
      createClaim: { waiting: 0, active: 0, completed: 0, failed: 0 },
      deleteServer: { waiting: 0, active: 0, completed: 0, failed: 0 }
    };
  }
}

// Clean up old jobs (maintenance)
export async function cleanupOldJobs(): Promise<void> {
  try {
    const olderThan = 24 * 60 * 60 * 1000; // 24 hours in ms
    
    await Promise.all([
      createClaimQueue.clean(olderThan, 10, 'completed'),
      createClaimQueue.clean(olderThan, 50, 'failed'),
      deleteServerQueue.clean(olderThan, 10, 'completed'),
      deleteServerQueue.clean(olderThan, 50, 'failed')
    ]);
    
    logger.info('Cleaned up old jobs from queues');
  } catch (error) {
    logger.error('Failed to cleanup old jobs', { error: error.message });
  }
}

// Pause/Resume queues for maintenance
export async function pauseQueues(): Promise<void> {
  await Promise.all([
    createClaimQueue.pause(),
    deleteServerQueue.pause()
  ]);
  logger.info('Paused all queues');
}

export async function resumeQueues(): Promise<void> {
  await Promise.all([
    createClaimQueue.resume(),
    deleteServerQueue.resume()
  ]);
  logger.info('Resumed all queues');
}

// Initialize queue event listeners
createClaimQueue.on('error', (error) => {
  logger.error('Create claim queue error', { error: error.message });
});

deleteServerQueue.on('error', (error) => {
  logger.error('Delete server queue error', { error: error.message });
});

createClaimQueue.on('stalled', (jobId) => {
  logger.warn('Create claim job stalled', { job_id: jobId });
});

deleteServerQueue.on('stalled', (jobId) => {
  logger.warn('Delete server job stalled', { job_id: jobId });
});

logger.info('Queue management initialized', {
  redis_url: config.REDIS_URL,
  prefix: config.QUEUE_PREFIX
});
