import { useState, useEffect, useCallback } from 'react';
import { FrontendClaimState, ClaimStatusResponse } from '@wa-ptero-claim/shared-types';
import ApiService from '@/services/api';
import { LocalStorageService } from '@/services/storage';
import { toast } from 'react-hot-toast';

const POLLING_INTERVAL = parseInt(process.env.NEXT_PUBLIC_POLLING_INTERVAL_SEC || '5') * 1000;
const MAX_POLL_ATTEMPTS = parseInt(process.env.NEXT_PUBLIC_MAX_POLL_ATTEMPTS || '60');

export function useClaimState() {
  const [claimState, setClaimState] = useState<FrontendClaimState>({
    state: 'IDLE'
  });
  
  const [pollAttempts, setPollAttempts] = useState(0);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = LocalStorageService.loadClaimState();
    if (savedState) {
      setClaimState(savedState);
      
      // Resume polling if in PROCESSING state
      if (savedState.state === 'PROCESSING' && savedState.claimId) {
        startPolling(savedState.claimId, savedState.claimToken);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (claimState.state !== 'IDLE') {
      LocalStorageService.saveClaimState(claimState);
    } else {
      LocalStorageService.clearClaimState();
    }
  }, [claimState]);

  // Start polling for claim status
  const startPolling = useCallback((claimId: string, claimToken?: string) => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const poll = async () => {
      try {
        const status = await ApiService.getClaimStatus(claimId, claimToken);
        
        setClaimState(prev => ({
          ...prev,
          lastPolled: new Date().toISOString()
        }));

        // Handle different status responses
        if (status.status === 'active') {
          stopPolling();
          setClaimState(prev => ({
            ...prev,
            state: 'SUCCESS'
          }));
          toast.success('🎉 Server created successfully!');
          
        } else if (status.status === 'failed') {
          stopPolling();
          setClaimState(prev => ({
            ...prev,
            state: 'ERROR',
            error: status.message || 'Server creation failed'
          }));
          toast.error(`❌ Server creation failed: ${status.message}`);
          
        } else if (status.status === 'creating') {
          // Continue polling
          setPollAttempts(prev => prev + 1);
          
        } else {
          // Handle unexpected status
          console.warn('Unexpected claim status:', status.status);
        }

      } catch (error) {
        setPollAttempts(prev => prev + 1);
        console.error('Polling error:', error);
        
        // Stop polling after too many failed attempts
        if (pollAttempts >= MAX_POLL_ATTEMPTS) {
          stopPolling();
          setClaimState(prev => ({
            ...prev,
            state: 'ERROR',
            error: 'Polling timeout - please check status manually',
            timeoutReached: true
          }));
          toast.error('⏰ Polling timeout - please check your claim status manually');
        }
      }
    };

    const interval = setInterval(poll, POLLING_INTERVAL);
    setPollingInterval(interval);
  }, [pollingInterval, pollAttempts]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setPollAttempts(0);
  }, [pollingInterval]);

  // Submit new claim
  const submitClaim = useCallback(async (claimData: any) => {
    try {
      setClaimState({
        state: 'SUBMITTING'
      });

      const response = await ApiService.submitClaim(claimData);

      setClaimState({
        state: 'PROCESSING',
        claimId: response.claim_id,
        claimToken: response.claim_token
      });

      // Start polling for status updates
      startPolling(response.claim_id, response.claim_token);

      toast.success('✅ Claim submitted! Monitoring progress...');

    } catch (error: any) {
      setClaimState({
        state: 'ERROR',
        error: error.response?.data?.error || error.message || 'Failed to submit claim'
      });
      
      toast.error(`❌ ${error.response?.data?.error || 'Failed to submit claim'}`);
    }
  }, [startPolling]);

  // Reset claim state
  const resetClaim = useCallback(() => {
    stopPolling();
    setClaimState({ state: 'IDLE' });
    LocalStorageService.clearClaimState();
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return {
    claimState,
    submitClaim,
    resetClaim,
    isPolling: !!pollingInterval,
    pollAttempts
  };
}

export default useClaimState;
