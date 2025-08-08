/**
 * Utility functions for formatting WhatsApp JIDs and phone numbers
 */

export function formatJid(phoneNumber: string): string {
  // Remove all non-numeric characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Remove leading zeros
  const withoutLeadingZeros = cleanNumber.replace(/^0+/, '');
  
  // Add WhatsApp suffix
  return `${withoutLeadingZeros}@s.whatsapp.net`;
}

export function formatPhoneToE164(phoneNumber: string): string {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // If starts with 62 (Indonesia), add +
  if (cleanNumber.startsWith('62')) {
    return `+${cleanNumber}`;
  }
  
  // If starts with 8 (Indonesia without country code), add +62
  if (cleanNumber.startsWith('8')) {
    return `+62${cleanNumber}`;
  }
  
  // If starts with 0 (Indonesia local), replace with +62
  if (cleanNumber.startsWith('0')) {
    return `+62${cleanNumber.substring(1)}`;
  }
  
  // Otherwise, add + if not present
  return phoneNumber.startsWith('+') ? phoneNumber : `+${cleanNumber}`;
}

export function normalizePhoneNumber(phoneNumber: string): string {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Remove leading zeros
  let normalized = cleanNumber.replace(/^0+/, '');
  
  // If it doesn't start with country code, assume Indonesia (62)
  if (!normalized.startsWith('62') && normalized.length >= 8) {
    normalized = `62${normalized}`;
  }
  
  return normalized;
}

export function isValidWhatsAppJid(jid: string): boolean {
  const jidPattern = /^\d+@s\.whatsapp\.net$/;
  return jidPattern.test(jid);
}

export function extractPhoneFromJid(jid: string): string {
  return jid.replace('@s.whatsapp.net', '');
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us');
}

export function isBroadcastJid(jid: string): boolean {
  return jid.endsWith('@broadcast');
}

// Legacy compatibility - keep existing phoneToJID function
export function phoneToJID(phoneNumber: string): string {
  return formatJid(phoneNumber);
}
