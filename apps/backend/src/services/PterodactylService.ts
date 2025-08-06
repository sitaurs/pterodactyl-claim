import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  PterodactylUser, 
  PterodactylServer, 
  PterodactylAllocation,
  ServerTemplate,
  ResourceConfig 
} from '@wa-ptero-claim/shared-types';
import { config, getFallbackNodeIds } from '../config';
import { logger } from '../utils/logger';
import { generateEmailFromJID, generateRandomPassword } from '../utils/crypto';
import fs from 'fs/promises';
import path from 'path';

export class PterodactylService {
  private client: AxiosInstance;
  private templates: Record<string, ServerTemplate> = {};
  private resourceConfig: ResourceConfig | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.PT_APP_BASE_URL,
      headers: {
        'Authorization': `Bearer ${config.PT_APP_API_KEY}`,
        'Accept': 'Application/vnd.pterodactyl.v1+json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error('Pterodactyl API error', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data
        });
        throw error;
      }
    );

    this.loadTemplates();
    this.loadResourceConfig();
  }

  // Load templates configuration
  private async loadTemplates(): Promise<void> {
    try {
      const templatesPath = path.join(process.cwd(), '../../config/templates.json');
      const data = await fs.readFile(templatesPath, 'utf8');
      this.templates = JSON.parse(data);
      logger.info('Loaded server templates', { templates: Object.keys(this.templates) });
    } catch (error) {
      logger.error('Failed to load templates', { error });
      throw new Error('Could not load server templates configuration');
    }
  }

  // Load resource configuration
  private async loadResourceConfig(): Promise<void> {
    try {
      const resourcePath = path.join(process.cwd(), '../../config/resources.js');
      delete require.cache[require.resolve(resourcePath)];
      this.resourceConfig = require(resourcePath);
      logger.info('Loaded resource configuration', { config: this.resourceConfig });
    } catch (error) {
      logger.error('Failed to load resource config', { error });
      throw new Error('Could not load resource configuration');
    }
  }

  // Get template by name
  getTemplate(templateName: string): ServerTemplate | null {
    return this.templates[templateName] || null;
  }

  // Create or reuse Pterodactyl user
  async createOrReuseUser(waJid: string, username: string): Promise<{
    user: PterodactylUser;
    password: string;
    isNew: boolean;
  }> {
    try {
      // First, try to find existing user by external_id
      const existingUser = await this.findUserByExternalId(waJid);
      
      if (existingUser) {
        logger.info('Reusing existing Pterodactyl user', { 
          user_id: existingUser.id,
          username: existingUser.username 
        });
        
        // Generate new password for existing user
        const password = generateRandomPassword();
        await this.updateUserPassword(existingUser.id, password);
        
        return {
          user: existingUser,
          password,
          isNew: false
        };
      }

      // Create new user
      const password = generateRandomPassword();
      const email = generateEmailFromJID(waJid);
      
      const userData = {
        username,
        email,
        first_name: username,
        last_name: 'User',
        password,
        root_admin: false,
        language: 'en',
        external_id: waJid
      };

      const response = await this.client.post('/api/application/users', userData);
      const user = response.data.attributes as PterodactylUser;

      logger.info('Created new Pterodactyl user', { 
        user_id: user.id,
        username: user.username,
        email: user.email 
      });

      return {
        user,
        password,
        isNew: true
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        
        if (status === 422) {
          // Validation error - probably username/email conflict
          throw new Error(`User creation failed: ${JSON.stringify(data)}`);
        }
      }
      
      logger.error('Failed to create/reuse user', { error, waJid, username });
      throw new Error('Failed to create Pterodactyl user');
    }
  }

  // Find user by external_id
  private async findUserByExternalId(externalId: string): Promise<PterodactylUser | null> {
    try {
      const response = await this.client.get(`/api/application/users?filter[external_id]=${externalId}`);
      const users = response.data.data;
      
      if (users && users.length > 0) {
        return users[0].attributes as PterodactylUser;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to find user by external_id', { error, externalId });
      return null;
    }
  }

  // Update user password
  private async updateUserPassword(userId: number, password: string): Promise<void> {
    try {
      await this.client.patch(`/api/application/users/${userId}`, { password });
      logger.debug('Updated user password', { user_id: userId });
    } catch (error) {
      logger.error('Failed to update user password', { error, userId });
      throw error;
    }
  }

  // Find available allocation
  async findAvailableAllocation(nodeId: number): Promise<PterodactylAllocation | null> {
    try {
      const response = await this.client.get(`/api/application/nodes/${nodeId}/allocations`);
      const allocations = response.data.data;
      
      const available = allocations.find((alloc: any) => 
        !alloc.attributes.assigned
      );
      
      if (available) {
        return available.attributes as PterodactylAllocation;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to find available allocation', { error, nodeId });
      return null;
    }
  }

  // Create server
  async createServer(data: {
    name: string;
    description: string;
    userId: number;
    eggId: number;
    dockerImage: string;
    startup: string;
    environment: Record<string, string>;
    allocation: PterodactylAllocation;
    nodeId: number;
  }): Promise<PterodactylServer> {
    if (!this.resourceConfig) {
      throw new Error('Resource configuration not loaded');
    }

    const serverData = {
      name: data.name,
      description: data.description,
      user: data.userId,
      egg: data.eggId,
      docker_image: data.dockerImage,
      startup: data.startup,
      environment: {
        ...data.environment,
        SERVER_PORT: data.allocation.port.toString() // Inject allocated port
      },
      limits: {
        memory: this.resourceConfig.memory,
        swap: this.resourceConfig.swap,
        disk: this.resourceConfig.disk,
        io: this.resourceConfig.io,
        cpu: this.resourceConfig.cpu
      },
      feature_limits: {
        databases: this.resourceConfig.databases,
        allocations: this.resourceConfig.allocations,
        backups: this.resourceConfig.backups
      },
      allocation: {
        default: data.allocation.id
      }
    };

    try {
      const response = await this.client.post('/api/application/servers', serverData);
      const server = response.data.attributes as PterodactylServer;

      logger.info('Created Pterodactyl server', {
        server_id: server.id,
        name: server.name,
        user_id: data.userId,
        allocation_port: data.allocation.port
      });

      return server;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        
        if (status === 422) {
          throw new Error(`Server creation failed: ${JSON.stringify(data)}`);
        }
      }
      
      logger.error('Failed to create server', { error, serverData });
      throw new Error('Failed to create Pterodactyl server');
    }
  }

  // Get server status
  async getServerStatus(serverId: number): Promise<{
    status: string | null;
    suspended: boolean;
    installing: boolean;
  }> {
    try {
      const response = await this.client.get(`/api/application/servers/${serverId}`);
      const server = response.data.attributes;
      
      return {
        status: server.status,
        suspended: server.suspended,
        installing: server.installing || false
      };
    } catch (error) {
      logger.error('Failed to get server status', { error, serverId });
      throw error;
    }
  }

  // Delete server
  async deleteServer(serverId: number): Promise<void> {
    try {
      await this.client.delete(`/api/application/servers/${serverId}`);
      logger.info('Deleted Pterodactyl server', { server_id: serverId });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.warn('Server already deleted or not found', { server_id: serverId });
        return;
      }
      
      logger.error('Failed to delete server', { error, serverId });
      throw error;
    }
  }

  // Delete user (only if they have no servers)
  async deleteUserIfEmpty(userId: number): Promise<void> {
    try {
      // Check if user has any servers
      const response = await this.client.get(`/api/application/users/${userId}?include=servers`);
      const user = response.data.attributes;
      
      if (!user.relationships?.servers?.data || user.relationships.servers.data.length === 0) {
        await this.client.delete(`/api/application/users/${userId}`);
        logger.info('Deleted empty Pterodactyl user', { user_id: userId });
      } else {
        logger.info('User has servers, not deleting', { 
          user_id: userId,
          server_count: user.relationships.servers.data.length 
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.warn('User already deleted or not found', { user_id: userId });
        return;
      }
      
      logger.error('Failed to delete user', { error, userId });
      throw error;
    }
  }

  // Try to allocate server with node fallback
  async allocateServerWithFallback(data: {
    waJid: string;
    username: string;
    template: string;
    serverName: string;
    description: string;
  }): Promise<{
    user: PterodactylUser;
    server: PterodactylServer;
    allocation: PterodactylAllocation;
    password: string;
    nodeId: number;
  }> {
    const template = this.getTemplate(data.template);
    if (!template) {
      throw new Error(`Template '${data.template}' not found`);
    }

    // Create or reuse user first
    const { user, password } = await this.createOrReuseUser(data.waJid, data.username);

    // Try primary node first, then fallbacks
    const nodeIds = [config.PT_NODE_ID, ...getFallbackNodeIds()];
    
    for (const nodeId of nodeIds) {
      try {
        logger.debug('Trying node for allocation', { nodeId });
        
        const allocation = await this.findAvailableAllocation(nodeId);
        if (!allocation) {
          logger.warn('No available allocations on node', { nodeId });
          continue;
        }

        const server = await this.createServer({
          name: data.serverName,
          description: data.description,
          userId: user.id,
          eggId: template.eggId,
          dockerImage: template.dockerImage,
          startup: template.startupCommand,
          environment: template.environment,
          allocation,
          nodeId
        });

        logger.info('Successfully allocated server', {
          server_id: server.id,
          user_id: user.id,
          node_id: nodeId,
          allocation_port: allocation.port
        });

        return {
          user,
          server,
          allocation,
          password,
          nodeId
        };
        
      } catch (error) {
        logger.warn('Failed to allocate on node, trying next', { nodeId, error: error.message });
        continue;
      }
    }

    throw new Error('NO_ALLOC: All nodes are full or unavailable');
  }

  /**
   * Get server information from Pterodactyl
   */
  async getServerInfo(serverId: number): Promise<PterodactylServer> {
    try {
      const response = await this.client.get(`/api/application/servers/${serverId}`);
      return response.data.attributes as PterodactylServer;
    } catch (error) {
      logger.error('Failed to get server info', { serverId, error });
      throw new Error(`Failed to get server info for ${serverId}`);
    }
  }

  /**
   * Update server startup command
   */
  async updateServerStartup(serverId: number, startup: string): Promise<void> {
    try {
      await this.client.patch(`/api/application/servers/${serverId}/startup`, {
        startup,
        environment: {}
      });
      logger.info('Server startup updated', { serverId, startup });
    } catch (error) {
      logger.error('Failed to update server startup', { serverId, error });
      throw new Error(`Failed to update startup for server ${serverId}`);
    }
  }

  /**
   * Execute power action on server
   */
  async powerAction(serverId: number, action: string): Promise<void> {
    try {
      await this.client.post(`/api/application/servers/${serverId}/power`, { 
        signal: action 
      });
      logger.info('Power action executed', { serverId, action });
    } catch (error) {
      logger.error('Failed to execute power action', { serverId, action, error });
      throw new Error(`Failed to execute ${action} on server ${serverId}`);
    }
  }

  /**
   * Suspend server
   */
  async suspendServer(serverId: number): Promise<void> {
    try {
      await this.client.post(`/api/application/servers/${serverId}/suspend`);
      logger.info('Server suspended', { serverId });
    } catch (error) {
      logger.error('Failed to suspend server', { serverId, error });
      throw new Error(`Failed to suspend server ${serverId}`);
    }
  }

  /**
   * Unsuspend server
   */
  async unsuspendServer(serverId: number): Promise<void> {
    try {
      await this.client.post(`/api/application/servers/${serverId}/unsuspend`);
      logger.info('Server unsuspended', { serverId });
    } catch (error) {
      logger.error('Failed to unsuspend server', { serverId, error });
      throw new Error(`Failed to unsuspend server ${serverId}`);
    }
  }
  }
}

export const pterodactylService = new PterodactylService();