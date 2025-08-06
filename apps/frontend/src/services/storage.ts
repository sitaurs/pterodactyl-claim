import { useEffect, useRef } from 'react';
import { FrontendClaimState, FrontendState } from '@wa-ptero-claim/shared-types';

const STORAGE_KEY = 'wa-ptero-claim-state';

export class LocalStorageService {
  // Save claim state to localStorage
  static saveClaimState(state: FrontendClaimState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save claim state to localStorage:', error);
    }
  }

  // Load claim state from localStorage
  static loadClaimState(): FrontendClaimState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const state = JSON.parse(stored) as FrontendClaimState;
      
      // Validate state structure
      if (!state.state || !Object.values(['IDLE', 'SUBMITTING', 'PROCESSING', 'SUCCESS', 'ERROR']).includes(state.state)) {
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to load claim state from localStorage:', error);
      return null;
    }
  }

  // Clear claim state from localStorage
  static clearClaimState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear claim state from localStorage:', error);
    }
  }

  // Check if there's a resumable claim
  static hasResumableClaim(): boolean {
    const state = this.loadClaimState();
    return state?.state === 'PROCESSING' && !!state.claimId;
  }
}

// Custom hook for localStorage state management
export function useLocalStorageState() {
  const hasResumableClaim = useRef(false);

  useEffect(() => {
    hasResumableClaim.current = LocalStorageService.hasResumableClaim();
  }, []);

  return {
    saveClaimState: LocalStorageService.saveClaimState,
    loadClaimState: LocalStorageService.loadClaimState,
    clearClaimState: LocalStorageService.clearClaimState,
    hasResumableClaim: hasResumableClaim.current
  };
}

export default LocalStorageService;
