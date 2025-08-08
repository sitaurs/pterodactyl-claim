// Core Domain Types
export interface ClaimRequest {
  username: string;
  password: string;
  wa_number_e164: string;
  template: 'nodejs' | 'python';
}

export interface ClaimResponse {
  claim_id: string;
  claim_token?: string; // For frontend security
}

export interface ClaimStatusResponse {
  status: ClaimStatus;
  message: string;
  server_details?: {
    panel_url?: string;
    username?: string;
    allocation_ip?: string;
    allocation_port?: number;
  };
}

export type ClaimStatus = 
  | 'creating' 
  | 'active' 
  | 'failed' 
  | 'deleting' 
  | 'deleted';

// Webhook Types
export interface WhatsAppWebhookPayload {
  action: 'join' | 'leave';
  wa_jid: string;
  group_id: string;
  timestamp: string; // ISO8601
}

// Bot RPC Types
export interface CheckMemberRequest {
  wa_jid: string;
}

export interface CheckMemberResponse {
  isMember: boolean;
  jid: string;
  groupId: string;
  checkedAt: string; // ISO8601
}

// Data Persistence Types
export interface ClaimRecord {
  claim_id: string;
  wa_jid: string;
  status: ClaimStatus;
  template: string;
  
  // Pterodactyl IDs
  user_id?: number;
  server_id?: number;
  allocation_id?: number;
  ptero_username?: string;
  
  // Grace period & deletion
  deletion_scheduled_at?: string; // ISO8601
  delete_job_id?: string;
  
  // Error handling
  failure_code?: FailureCode;
  failure_reason?: string;
  
  // Timestamps
  created_at: string; // ISO8601
  updated_at: string; // ISO8601
  last_event_at?: string; // ISO8601
  last_healthcheck_at?: string; // ISO8601
  
  // Optional metadata
  ptero_panel_url?: string;
}

export type FailureCode = 
  | 'NO_ALLOC'
  | 'EGG_INVALID' 
  | 'API_DOWN'
  | 'HEALTHCHECK_TIMEOUT'
  | 'BOT_TIMEOUT'
  | 'NODE_FULL'
  | 'USER_EXISTS'
  | 'UNKNOWN';

// Template Configuration Types
export interface ServerTemplate {
  eggId: number;
  dockerImage: string;
  startupCommand: string;
  environment: Record<string, string>;
  healthcheck: {
    type: 'tcp';
    portEnv: string;
    timeoutSec: number;
    retries: number;
    retryDelaySec: number;
  };
  useResourceConfig: boolean;
}

export interface ResourceConfig {
  memory: number;
  disk: number;
  cpu: number;
  swap: number;
  io: number;
  databases: number;
  allocations: number;
  backups: number;
  portRange: {
    start: number;
    end: number;
    currentlyUsed: number[];
    available: number;
  };
}

// Pterodactyl API Types
export interface PterodactylUser {
  id: number;
  external_id: string;
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  root_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface PterodactylServer {
  id: number;
  external_id?: string;
  uuid: string;
  identifier: string;
  name: string;
  description: string;
  status: string | null;
  suspended: boolean;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads?: string;
    oom_disabled?: boolean;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  user: number;
  node: number;
  allocation: number;
  nest: number;
  egg: number;
  created_at: string;
  updated_at: string;
}

export interface PterodactylAllocation {
  id: number;
  ip: string;
  ip_alias?: string;
  port: number;
  notes?: string;
  assigned: boolean;
}

// API Error Types
export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, any>;
}

// Job Queue Types
export interface CreateClaimJobData {
  claimId: string;
}

export interface DeleteServerJobData {
  claimId: string;
}

// Frontend State Types
export type FrontendState = 
  | 'IDLE'
  | 'SUBMITTING' 
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR';

export interface FrontendClaimState {
  state: FrontendState;
  claimId?: string;
  claimToken?: string;
  error?: string;
  lastPolled?: string;
  timeoutReached?: boolean;
}

// Environment Configuration Types
export interface BackendConfig {
  // Pterodactyl
  PT_APP_BASE_URL: string;
  PT_APP_API_KEY: string;
  PT_NODE_ID: number;
  PT_FALLBACK_NODE_IDS?: string; // comma-separated
  HEALTHCHECK_HOST_OVERRIDE?: string;
  
  // Default Resources
  DEFAULT_SERVER_MEMORY_MB: number;
  DEFAULT_SERVER_DISK_MB: number;
  DEFAULT_SERVER_CPU_PCT: number;
  
  // Queue & Redis
  REDIS_URL: string;
  QUEUE_PREFIX: string;
  
  // Security
  INTERNAL_SECRET: string;
  CORS_ALLOWED_ORIGIN: string;
  CLAIM_STATUS_REQUIRE_TOKEN: boolean;
  
  // Alerts
  DISCORD_WEBHOOK_URL?: string;
  SLACK_WEBHOOK_URL?: string;
  ALERT_ENV: string;
  
  // Server
  PORT: number;
  NODE_ENV: string;
}

export interface BotConfig {
  TARGET_GROUP_ID: string;
  BACKEND_WEBHOOK_URL: string;
  INTERNAL_SECRET: string;
  RPC_PORT: number;
  DATA_DIR?: string; // Optional data directory for auth storage
}

export interface FrontendConfig {
  NEXT_PUBLIC_API_BASE_URL: string;
}
