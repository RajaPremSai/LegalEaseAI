// Shared utility functions

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const generateId = (): string => {
  return crypto.randomUUID();
};

export const isValidFileType = (mimeType: string): boolean => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  return allowedTypes.includes(mimeType);
};

export const calculateExpiryDate = (hours: number = 24): Date => {
  const now = new Date();
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const sanitizeFilename = (filename: string): string => {
  // Remove or replace invalid characters for file names
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .toLowerCase();
};

export const calculateExpirationDate = (hours: number = 24): Date => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

export const isExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};

export const validateJurisdiction = (jurisdiction: string): boolean => {
  // Basic validation for jurisdiction codes (ISO 3166-1 alpha-2 or common legal jurisdictions)
  const validJurisdictions = [
    'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT',
    'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'GR', 'PL', 'CZ', 'HU', 'SK', 'SI',
    'EE', 'LV', 'LT', 'LU', 'MT', 'CY', 'BG', 'RO', 'HR', 'JP', 'KR', 'SG',
    'HK', 'IN', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'ZA', 'NG', 'KE', 'EG',
    'IL', 'AE', 'SA', 'TR', 'RU', 'CN', 'TH', 'MY', 'ID', 'PH', 'VN', 'NZ'
  ];
  return validJurisdictions.includes(jurisdiction.toUpperCase());
};

export const getMimeTypeFromExtension = (filename: string): string | null => {
  const extension = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
  };
  return mimeTypes[extension || ''] || null;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const normalizeLanguageCode = (language: string): string => {
  // Normalize language codes to ISO 639-1 format
  const languageMap: Record<string, string> = {
    'english': 'en',
    'spanish': 'es',
    'french': 'fr',
    'german': 'de',
    'italian': 'it',
    'portuguese': 'pt',
    'dutch': 'nl',
    'russian': 'ru',
    'chinese': 'zh',
    'japanese': 'ja',
    'korean': 'ko',
    'arabic': 'ar',
  };
  
  const normalized = language.toLowerCase();
  return languageMap[normalized] || normalized.substring(0, 2);
};