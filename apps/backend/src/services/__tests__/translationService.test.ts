import { translationService } from '../translationService';

// Mock Google Cloud Translate
jest.mock('@google-cloud/translate/build/src/v2', () => {
  return {
    Translate: jest.fn().mockImplementation(() => ({
      translate: jest.fn(),
      detect: jest.fn(),
    })),
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TranslationService', () => {
  describe('getLegalTermTranslation', () => {
    it('returns correct translation for known legal term', () => {
      const result = translationService.getLegalTermTranslation('contract', 'es');
      
      expect(result).toEqual({
        term: 'Contrato',
        definition: 'Un acuerdo legalmente vinculante entre dos o más partes',
      });
    });

    it('returns null for unknown legal term', () => {
      const result = translationService.getLegalTermTranslation('unknown_term', 'es');
      
      expect(result).toBeNull();
    });

    it('returns null for unsupported language', () => {
      const result = translationService.getLegalTermTranslation('contract', 'unsupported');
      
      expect(result).toBeNull();
    });
  });

  describe('getLegalTermsForLanguage', () => {
    it('returns English terms for English language', () => {
      const result = translationService.getLegalTermsForLanguage('en');
      
      expect(result).toHaveProperty('contract');
      expect(result.contract).toEqual({
        term: 'Contract',
        definition: 'A legally binding agreement between two or more parties',
      });
    });

    it('returns translated terms for Spanish language', () => {
      const result = translationService.getLegalTermsForLanguage('es');
      
      expect(result).toHaveProperty('contract');
      expect(result.contract).toEqual({
        term: 'Contrato',
        definition: 'Un acuerdo legalmente vinculante entre dos o más partes',
      });
    });

    it('returns empty object for unsupported language', () => {
      const result = translationService.getLegalTermsForLanguage('unsupported');
      
      expect(result).toEqual({});
    });
  });

  describe('getSupportedLanguages', () => {
    it('returns array of supported language codes', () => {
      const result = translationService.getSupportedLanguages();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('en');
      expect(result).toContain('es');
      expect(result).toContain('fr');
      expect(result).toContain('de');
      expect(result).toContain('pt');
      expect(result).toContain('zh');
      expect(result).toContain('ja');
      expect(result).toContain('ko');
      expect(result).toContain('ar');
    });
  });

  describe('isLanguageSupported', () => {
    it('returns true for supported languages', () => {
      expect(translationService.isLanguageSupported('en')).toBe(true);
      expect(translationService.isLanguageSupported('es')).toBe(true);
      expect(translationService.isLanguageSupported('fr')).toBe(true);
    });

    it('returns false for unsupported languages', () => {
      expect(translationService.isLanguageSupported('unsupported')).toBe(false);
      expect(translationService.isLanguageSupported('xyz')).toBe(false);
    });
  });
});