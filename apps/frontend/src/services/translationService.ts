import { apiClient } from './apiClient';

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedSourceLanguage?: string;
  confidence?: number;
}

export interface LegalTermsResponse {
  language: string;
  terms: Record<string, {
    term: string;
    definition: string;
  }>;
}

export interface LanguageDetectionResponse {
  detectedLanguage: string;
  isSupported: boolean;
}

class TranslationService {
  /**
   * Translate text to target language
   */
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const response = await apiClient.post('/translation/translate', request);
      return response.data.data;
    } catch (error) {
      console.error('Translation failed:', error);
      throw new Error('Translation service unavailable');
    }
  }

  /**
   * Translate document analysis
   */
  async translateAnalysis(analysisId: string, targetLanguage: string): Promise<any> {
    try {
      const response = await apiClient.post(`/translation/analysis/${analysisId}`, {
        targetLanguage,
      });
      return response.data.data;
    } catch (error) {
      console.error('Analysis translation failed:', error);
      throw new Error('Analysis translation failed');
    }
  }

  /**
   * Get legal terms dictionary for a language
   */
  async getLegalTerms(language: string): Promise<LegalTermsResponse> {
    try {
      const response = await apiClient.get('/translation/legal-terms', {
        params: { language },
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch legal terms:', error);
      throw new Error('Failed to fetch legal terms');
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResponse> {
    try {
      const response = await apiClient.post('/translation/detect-language', {
        text,
      });
      return response.data.data;
    } catch (error) {
      console.error('Language detection failed:', error);
      throw new Error('Language detection failed');
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      const response = await apiClient.get('/translation/supported-languages');
      return response.data.data.languages;
    } catch (error) {
      console.error('Failed to get supported languages:', error);
      throw new Error('Failed to get supported languages');
    }
  }

  /**
   * Check if browser language is supported
   */
  getBrowserLanguage(): string {
    if (typeof window !== 'undefined') {
      const browserLang = navigator.language || navigator.languages?.[0] || 'en';
      // Extract language code (e.g., 'en-US' -> 'en')
      return browserLang.split('-')[0];
    }
    return 'en';
  }

  /**
   * Get user's preferred language from localStorage
   */
  getStoredLanguage(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferredLanguage');
    }
    return null;
  }

  /**
   * Store user's preferred language
   */
  setStoredLanguage(language: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLanguage', language);
    }
  }
}

export const translationService = new TranslationService();