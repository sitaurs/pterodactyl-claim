import { FrontendClaimState, ClaimRequest, ClaimResponse, ClaimStatusResponse } from '@wa-ptero-claim/shared-types';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// API response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export class ApiService {
  // Submit claim request
  static async submitClaim(claimData: ClaimRequest): Promise<ClaimResponse> {
    const response = await api.post('/api/claims', claimData);
    return response.data;
  }

  // Get claim status
  static async getClaimStatus(claimId: string, claimToken?: string): Promise<ClaimStatusResponse> {
    const params = claimToken ? { token: claimToken } : {};
    const response = await api.get(`/api/claims/${claimId}/status`, { params });
    return response.data;
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await api.get('/health');
    return response.data;
  }
}

export default ApiService;
