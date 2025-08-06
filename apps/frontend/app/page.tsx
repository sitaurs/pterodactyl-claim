'use client';

import { useState, useEffect } from 'react';
import { ClaimForm } from '@/components/ClaimForm';
import { StatusDisplay } from '@/components/StatusDisplay';

// Temporary types - will be replaced with proper shared types
interface ClaimRequest {
  username: string;
  password: string;
  wa_number_e164: string;
  template: 'nodejs' | 'python';
}

interface FrontendState {
  state: 'IDLE' | 'SUBMITTING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  claimId?: string;
  claimToken?: string;
  error?: string;
  lastPolled?: string;
  timeoutReached?: boolean;
}

// Mock API service for now
const mockApiService = {
  async submitClaim(data: ClaimRequest) {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      claim_id: `claim_${Date.now()}`,
      claim_token: `token_${Math.random().toString(36).substr(2, 9)}`
    };
  },
  
  async getClaimStatus(claimId: string, token?: string) {
    // Simulate status check
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statuses = ['creating', 'creating', 'creating', 'active'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      status: randomStatus,
      message: randomStatus === 'active' ? 'Server is ready!' : 'Creating server...',
      server_details: randomStatus === 'active' ? {
        panel_url: 'https://panel.example.com',
        username: 'user123',
        allocation_ip: '192.168.1.100',
        allocation_port: 25565
      } : undefined
    };
  }
};

export default function Home() {
  const [claimState, setClaimState] = useState<FrontendState>({
    state: 'IDLE'
  });
  const [pollAttempts, setPollAttempts] = useState(0);
  const [isPolling, setIsPolling] = useState(false);

  // Mock polling logic
  useEffect(() => {
    if (claimState.state === 'PROCESSING' && claimState.claimId && !isPolling) {
      setIsPolling(true);
      const interval = setInterval(async () => {
        try {
          const status = await mockApiService.getClaimStatus(claimState.claimId!, claimState.claimToken);
          setPollAttempts(prev => prev + 1);
          
          if (status.status === 'active') {
            setClaimState(prev => ({ ...prev, state: 'SUCCESS' }));
            setIsPolling(false);
            clearInterval(interval);
          } else if (pollAttempts >= 10) { // Shorter timeout for demo
            setClaimState(prev => ({ 
              ...prev, 
              state: 'ERROR',
              error: 'Demo timeout reached'
            }));
            setIsPolling(false);
            clearInterval(interval);
          }
        } catch (error) {
          setClaimState(prev => ({ 
            ...prev, 
            state: 'ERROR',
            error: 'Failed to check status'
          }));
          setIsPolling(false);
          clearInterval(interval);
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [claimState.state, claimState.claimId, isPolling, pollAttempts]);

  const handleSubmitClaim = async (data: ClaimRequest) => {
    try {
      setClaimState({ state: 'SUBMITTING' });
      
      const response = await mockApiService.submitClaim(data);
      
      setClaimState({
        state: 'PROCESSING',
        claimId: response.claim_id,
        claimToken: response.claim_token
      });
      setPollAttempts(0);
      
    } catch (error: any) {
      setClaimState({
        state: 'ERROR',
        error: error.message || 'Failed to submit claim'
      });
    }
  };

  const handleReset = () => {
    setClaimState({ state: 'IDLE' });
    setPollAttempts(0);
    setIsPolling(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {claimState.state === 'IDLE' ? (
          <ClaimForm 
            onSubmit={handleSubmitClaim}
            isSubmitting={claimState.state === 'SUBMITTING'}
          />
        ) : (
          <StatusDisplay
            claimId={claimState.claimId || ''}
            isPolling={isPolling}
            pollAttempts={pollAttempts}
            error={claimState.error}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
