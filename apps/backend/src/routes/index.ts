import { Router, Request, Response } from 'express';
import { 
  validateClaimRequest,
  validateWebhookPayload,
  formatValidationErrors,
  normalizePhoneToJID
} from '@wa-ptero-claim/validation-schemas';
import { ClaimRequest, WhatsAppWebhookPayload } from '@wa-ptero-claim/shared-types';
import { ClaimsRepository } from '../repositories/ClaimsRepository';
import { botRPCService } from '../services/BotRPCService';
import { addCreateClaimJob, addDeleteServerJob, cancelDeleteServerJob } from '../queue';
import { generateClaimToken } from '../utils/crypto';
import { phoneToJID, normalizePhoneNumber, formatJid } from '../utils/formatting';
import { gracePeriodHours } from '../config';
import { logger } from '../utils/logger';
import { 
  ipRateLimit, 
  jidRateLimit, 
  verifyHMACSignature, 
  verifyClaimToken 
} from '../middleware';

const router = Router();
const claimsRepo = new ClaimsRepository();

// POST /api/claim - Start new claim process
router.post('/claim', ipRateLimit, jidRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    if (!validateClaimRequest(req.body)) {
      const errors = formatValidationErrors(validateClaimRequest.errors || []);
      logger.warn('Invalid claim request', { errors, body: req.body });
      
      return res.status(400).json({
        error: 'Invalid request data',
        details: errors
      });
    }

    const data = req.body as ClaimRequest;
    const waJid = phoneToJID(data.wa_number_e164);

    logger.info('Processing claim request', {
      username: data.username,
      template: data.template,
      wa_jid: waJid
    });

    // Check membership via bot RPC
    let isMember = false;
    // Multiple admin number formats for bypass (different possible formats)
    const adminNumbers = [
      '6281358959349@s.whatsapp.net',  // Direct format
      '081358959349@s.whatsapp.net',   // With leading 0
      '81358959349@s.whatsapp.net'     // Without country code
    ];
    
    logger.info('JID check for admin bypass', { 
      incoming_jid: waJid, 
      admin_numbers: adminNumbers,
      is_admin: adminNumbers.includes(waJid)
    });
    
    if (adminNumbers.includes(waJid)) {
      logger.info('Admin number detected, bypassing group check', { wa_jid: waJid });
      isMember = true;
    } else {
      try {
        const memberCheck = await botRPCService.checkMember(waJid);
        isMember = memberCheck.isMember;
        
        logger.info('Member check completed', {
          wa_jid: waJid,
          is_member: isMember,
          group_id: memberCheck.groupId || ''
        });
      } catch (error) {
        logger.error('Failed to verify membership', { 
          wa_jid: waJid,
          error: error.message 
        });
        
        return res.status(500).json({
          error: 'Gagal memverifikasi keanggotaan grup. Silakan coba lagi.'
        });
      }
    }
    
    if (!isMember) {
      logger.warn('User not a member of target group', { wa_jid: waJid });
      
      return res.status(403).json({
        error: 'Nomor WhatsApp Anda tidak ditemukan dalam grup yang diperlukan untuk mengklaim server.'
      });
    }

    // Check for existing active claim
    const existingClaim = await claimsRepo.findActiveClaimByJID(waJid);
    if (existingClaim) {
      logger.warn('User already has active claim', { 
        wa_jid: waJid,
        existing_claim_id: existingClaim.claim_id,
        existing_status: existingClaim.status
      });
      
      return res.status(409).json({
        error: 'Anda sudah memiliki klaim server yang aktif.'
      });
    }

    // Create new claim record
    const newClaim = await claimsRepo.createClaim({
      wa_jid: waJid,
      template: data.template,
      ptero_username: data.username
    });

    // Generate claim token for frontend security
    const claimToken = generateClaimToken();
    
    // Add job to queue
    await addCreateClaimJob(newClaim.claim_id);

    logger.info('Claim created and queued', {
      claim_id: newClaim.claim_id,
      wa_jid: waJid,
      template: data.template
    });

    res.status(202).json({
      claim_id: newClaim.claim_id,
      claim_token: claimToken
    });

  } catch (error) {
    logger.error('Error processing claim request', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      error: 'Terjadi kesalahan internal server. Silakan coba lagi.'
    });
  }
});

// GET /api/claim/:id/status - Get claim status
router.get('/claim/:id/status', verifyClaimToken, async (req: Request, res: Response) => {
  try {
    const claimId = req.params.id;
    
    if (!claimId || claimId.length !== 36) { // UUID v4 length
      return res.status(400).json({
        error: 'Invalid claim ID format'
      });
    }

    const claim = await claimsRepo.findClaimById(claimId);
    
    if (!claim) {
      return res.status(404).json({
        error: 'Claim ID tidak ditemukan.'
      });
    }

    // Create response based on status
    const response: any = {
      status: claim.status,
      message: getStatusMessage(claim.status, claim.failure_reason)
    };

    // Add server details if active
    if (claim.status === 'active' && claim.ptero_panel_url) {
      response.server_details = {
        panel_url: claim.ptero_panel_url,
        username: claim.ptero_username
      };
    }

    logger.debug('Status check', {
      claim_id: claimId,
      status: claim.status
    });

    res.json(response);

  } catch (error) {
    logger.error('Error getting claim status', {
      claim_id: req.params.id,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Terjadi kesalahan saat mengambil status.'
    });
  }
});

// POST /api/whatsapp-webhook - Handle WhatsApp events
router.post('/whatsapp-webhook', verifyHMACSignature, async (req: Request, res: Response) => {
  try {
    // Validate webhook payload
    if (!validateWebhookPayload(req.body)) {
      const errors = formatValidationErrors(validateWebhookPayload.errors || []);
      logger.warn('Invalid webhook payload', { errors, body: req.body });
      
      return res.status(400).json({
        error: 'Invalid webhook payload',
        details: errors
      });
    }

    const payload = req.body as WhatsAppWebhookPayload;
    
    logger.info('Received WhatsApp webhook', {
      action: payload.action,
      wa_jid: payload.wa_jid,
      group_id: payload.group_id
    });

    if (payload.action === 'leave') {
      await handleUserLeave(payload.wa_jid);
    } else if (payload.action === 'join') {
      await handleUserJoin(payload.wa_jid);
    }

    res.status(204).send();

  } catch (error) {
    logger.error('Error processing webhook', {
      error: error.message,
      body: req.body
    });
    
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/health - Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = await claimsRepo.getStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Helper function to handle user leaving group
async function handleUserLeave(waJid: string): Promise<void> {
  const activeClaim = await claimsRepo.findActiveClaimByJID(waJid);
  
  if (!activeClaim) {
    logger.info('No active claim found for leaving user', { wa_jid: waJid });
    return;
  }

  logger.info('Scheduling server deletion for leaving user', {
    wa_jid: waJid,
    claim_id: activeClaim.claim_id,
    grace_period_hours: gracePeriodHours
  });

  // Schedule deletion job
  const deleteJobId = await addDeleteServerJob(activeClaim.claim_id, gracePeriodHours);
  const scheduledAt = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);

  // Update claim status
  await claimsRepo.scheduleForDeletion(activeClaim.claim_id, deleteJobId, scheduledAt);

  // Send warning notification
  try {
    await botRPCService.sendDeletionWarning(waJid, gracePeriodHours);
  } catch (error) {
    logger.error('Failed to send deletion warning', {
      wa_jid: waJid,
      error: error.message
    });
  }
}

// Helper function to handle user joining group
async function handleUserJoin(waJid: string): Promise<void> {
  const scheduledClaim = await claimsRepo.findClaimByJID(waJid);
  
  if (!scheduledClaim || scheduledClaim.status !== 'deleting') {
    logger.info('No scheduled deletion found for joining user', { wa_jid: waJid });
    return;
  }

  logger.info('Cancelling server deletion for rejoining user', {
    wa_jid: waJid,
    claim_id: scheduledClaim.claim_id,
    delete_job_id: scheduledClaim.delete_job_id
  });

  // Cancel deletion job
  if (scheduledClaim.delete_job_id) {
    const cancelled = await cancelDeleteServerJob(scheduledClaim.delete_job_id);
    
    if (cancelled) {
      // Update claim status back to active
      await claimsRepo.cancelDeletion(scheduledClaim.claim_id);
      
      // Send cancellation notification
      try {
        await botRPCService.sendDeletionCancelled(waJid);
      } catch (error) {
        logger.error('Failed to send deletion cancelled message', {
          wa_jid: waJid,
          error: error.message
        });
      }
    } else {
      logger.warn('Failed to cancel deletion job', {
        wa_jid: waJid,
        job_id: scheduledClaim.delete_job_id
      });
    }
  }
}

// Helper function to get user-friendly status messages
function getStatusMessage(status: string, failureReason?: string): string {
  switch (status) {
    case 'creating':
      return 'Sedang membuat server Anda...';
    case 'active':
      return 'Server Anda siap! Cek WhatsApp untuk detail login.';
    case 'failed':
      return failureReason || 'Pembuatan server gagal. Silakan coba lagi.';
    case 'deleting':
      return 'Server dijadwalkan untuk dihapus. Bergabung kembali ke grup untuk membatalkan.';
    case 'deleted':
      return 'Server telah dihapus.';
    default:
      return 'Status tidak diketahui.';
  }
}

export default router;
