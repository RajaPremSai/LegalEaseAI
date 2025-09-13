import {
  formatFileSize,
  generateId,
  isValidFileType,
  calculateExpiryDate,
  isValidUUID,
  sanitizeFilename,
  calculateExpirationDate,
  isExpired,
  validateJurisdiction,
  getMimeTypeFromExtension,
  truncateText,
  normalizeLanguageCode,
} from '../utils';

describe('Utility Functions', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2621440)).toBe('2.5 MB');
    });
  });

  describe('generateId', () => {
    it('should generate valid UUIDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(id1).not.toBe(id2);
    });
  });

  describe('isValidFileType', () => {
    it('should accept valid file types', () => {
      expect(isValidFileType('application/pdf')).toBe(true);
      expect(isValidFileType('application/msword')).toBe(true);
      expect(isValidFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect(isValidFileType('text/plain')).toBe(true);
    });

    it('should reject invalid file types', () => {
      expect(isValidFileType('image/jpeg')).toBe(false);
      expect(isValidFileType('application/zip')).toBe(false);
      expect(isValidFileType('text/html')).toBe(false);
    });
  });

  describe('calculateExpiryDate', () => {
    it('should calculate expiry date correctly', () => {
      const now = new Date();
      const expiry = calculateExpiryDate(24);
      const expectedTime = now.getTime() + 24 * 60 * 60 * 1000;
      
      expect(Math.abs(expiry.getTime() - expectedTime)).toBeLessThan(1000); // Within 1 second
    });

    it('should use default 24 hours', () => {
      const now = new Date();
      const expiry = calculateExpiryDate();
      const expectedTime = now.getTime() + 24 * 60 * 60 * 1000;
      
      expect(Math.abs(expiry.getTime() - expectedTime)).toBeLessThan(1000);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('invalid-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456-42661417400g')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFilename('file<name>.pdf')).toBe('file_name_.pdf');
      expect(sanitizeFilename('file:name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFilename('file name.pdf')).toBe('file_name.pdf');
    });

    it('should convert to lowercase', () => {
      expect(sanitizeFilename('MyFile.PDF')).toBe('myfile.pdf');
    });

    it('should handle multiple spaces', () => {
      expect(sanitizeFilename('my   file   name.pdf')).toBe('my_file_name.pdf');
    });
  });

  describe('calculateExpirationDate', () => {
    it('should calculate expiration date correctly', () => {
      const now = Date.now();
      const expiry = calculateExpirationDate(48);
      const expectedTime = now + 48 * 60 * 60 * 1000;
      
      expect(Math.abs(expiry.getTime() - expectedTime)).toBeLessThan(1000);
    });
  });

  describe('isExpired', () => {
    it('should detect expired dates', () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 1000);
      
      expect(isExpired(pastDate)).toBe(true);
      expect(isExpired(futureDate)).toBe(false);
    });
  });

  describe('validateJurisdiction', () => {
    it('should accept valid jurisdiction codes', () => {
      expect(validateJurisdiction('US')).toBe(true);
      expect(validateJurisdiction('CA')).toBe(true);
      expect(validateJurisdiction('GB')).toBe(true);
      expect(validateJurisdiction('us')).toBe(true); // Case insensitive
    });

    it('should reject invalid jurisdiction codes', () => {
      expect(validateJurisdiction('XX')).toBe(false);
      expect(validateJurisdiction('ZZ')).toBe(false);
      expect(validateJurisdiction('')).toBe(false);
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME types', () => {
      expect(getMimeTypeFromExtension('document.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('file.doc')).toBe('application/msword');
      expect(getMimeTypeFromExtension('text.txt')).toBe('text/plain');
    });

    it('should handle case insensitive extensions', () => {
      expect(getMimeTypeFromExtension('document.PDF')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('file.DOC')).toBe('application/msword');
    });

    it('should return null for unknown extensions', () => {
      expect(getMimeTypeFromExtension('file.xyz')).toBe(null);
      expect(getMimeTypeFromExtension('noextension')).toBe(null);
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated';
      expect(truncateText(longText, 20)).toBe('This is a very lo...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      expect(truncateText(shortText, 20)).toBe('Short text');
    });

    it('should handle exact length', () => {
      const text = 'Exactly twenty chars';
      expect(truncateText(text, 20)).toBe('Exactly twenty chars');
    });
  });

  describe('normalizeLanguageCode', () => {
    it('should normalize language names to codes', () => {
      expect(normalizeLanguageCode('English')).toBe('en');
      expect(normalizeLanguageCode('spanish')).toBe('es');
      expect(normalizeLanguageCode('FRENCH')).toBe('fr');
    });

    it('should handle existing language codes', () => {
      expect(normalizeLanguageCode('en')).toBe('en');
      expect(normalizeLanguageCode('es')).toBe('es');
    });

    it('should truncate unknown languages', () => {
      expect(normalizeLanguageCode('unknown')).toBe('un');
      expect(normalizeLanguageCode('xyz')).toBe('xy');
    });
  });
});