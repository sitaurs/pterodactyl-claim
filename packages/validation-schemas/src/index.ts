import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ClaimRequest, WhatsAppWebhookPayload, CheckMemberRequest } from '@wa-ptero-claim/shared-types';

// Initialize Ajv instance
const ajv = new Ajv({ 
  allErrors: true,
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: false
});

// Add format validation
addFormats(ajv);

// Claim Request Schema
export const claimRequestSchema: JSONSchemaType<ClaimRequest> = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 32,
      pattern: '^[a-zA-Z0-9_-]+$'
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128
    },
    wa_number_e164: {
      type: 'string',
      pattern: '^\\+[1-9]\\d{1,14}$'
    },
    template: {
      type: 'string',
      enum: ['nodejs', 'python']
    }
  },
  required: ['username', 'password', 'wa_number_e164', 'template'],
  additionalProperties: false
};

// WhatsApp Webhook Schema
export const webhookPayloadSchema: JSONSchemaType<WhatsAppWebhookPayload> = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['join', 'leave']
    },
    wa_jid: {
      type: 'string',
      pattern: '^\\d+@s\\.whatsapp\\.net$'
    },
    group_id: {
      type: 'string',
      pattern: '^\\d+@g\\.us$'
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    }
  },
  required: ['action', 'wa_jid', 'group_id', 'timestamp'],
  additionalProperties: false
};

// Check Member Request Schema
export const checkMemberRequestSchema: JSONSchemaType<CheckMemberRequest> = {
  type: 'object',
  properties: {
    wa_jid: {
      type: 'string',
      pattern: '^\\d+@s\\.whatsapp\\.net$'
    }
  },
  required: ['wa_jid'],
  additionalProperties: false
};

// Utility function to normalize E.164 to WhatsApp JID
export function normalizePhoneToJID(phone: string): string {
  // Remove + and country code normalization
  const cleaned = phone.replace(/^\+/, '');
  return `${cleaned}@s.whatsapp.net`;
}

// Utility function to validate and normalize claim request
export function validateAndNormalizeClaim(data: unknown): ClaimRequest | null {
  const validate = validateClaimRequest;
  
  if (!validate(data)) {
    return null;
  }
  
  // Normalize wa_number_e164 to JID for internal use
  const normalized: ClaimRequest = {
    ...data,
    wa_number_e164: data.wa_number_e164.trim(),
    username: data.username.trim().toLowerCase(),
    template: data.template
  };
  
  return normalized;
}

// Compiled validators for performance
export const validateClaimRequest: ValidateFunction<ClaimRequest> = ajv.compile(claimRequestSchema);
export const validateWebhookPayload: ValidateFunction<WhatsAppWebhookPayload> = ajv.compile(webhookPayloadSchema);
export const validateCheckMemberRequest: ValidateFunction<CheckMemberRequest> = ajv.compile(checkMemberRequestSchema);

// Error formatting utility
export function formatValidationErrors(errors: any[]): string {
  return errors
    .map(err => `${err.instancePath || err.schemaPath}: ${err.message}`)
    .join('; ');
}

// Export ajv instance for custom validators
export { ajv };
