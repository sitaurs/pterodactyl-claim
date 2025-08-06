import crypto from 'crypto';
import { config } from '../config';

// Generate SHA-256 hash of WA JID for email
export function generateEmailFromJID(waJid: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(waJid)
    .digest('hex')
    .slice(0, 24); // Truncate to 24 characters
    
  return `${hash}@claim.example.com`;
}

// Generate secure random password (base64url safe)
export function generateRandomPassword(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  
  return result;
}

// Generate claim token for frontend security
export function generateClaimToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// HMAC signature verification for webhooks
export function createHMACSignature(payload: string, timestamp: string): string {
  const data = `${timestamp}.${payload}`;
  return crypto
    .createHmac('sha256', config.INTERNAL_SECRET)
    .update(data)
    .digest('hex');
}

export function verifyHMACSignature(
  payload: string, 
  timestamp: string, 
  signature: string
): boolean {
  const expectedSignature = createHMACSignature(payload, timestamp);
  
  try {
    // Use timingSafeEqual to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

// Verify timestamp window (anti-replay protection)
export function verifyTimestamp(timestamp: string, windowSeconds: number = 60): boolean {
  try {
    const timestampMs = new Date(timestamp).getTime();
    const nowMs = Date.now();
    const diffMs = Math.abs(nowMs - timestampMs);
    
    return diffMs <= (windowSeconds * 1000);
  } catch (error) {
    return false;
  }
}

// Generate UUID v4
export function generateUUID(): string {
  return crypto.randomUUID();
}

// Normalize phone number to WA JID format
export function phoneToJID(phone: string): string {
  const cleaned = phone.replace(/^\+/, '');
  return `${cleaned}@s.whatsapp.net`;
}

// Extract phone number from JID
export function jidToPhone(jid: string): string {
  return jid.replace('@s.whatsapp.net', '');
}

// Hash sensitive data for logging
export function hashForLogging(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex')
    .slice(0, 8);
}
