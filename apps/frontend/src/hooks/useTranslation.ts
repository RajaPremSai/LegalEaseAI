import { useTranslation as useNextTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { translationService } from '../services/translationService';

export interface UseTranslationReturn {
  t: (key: string, options?: any) => string;
  i18n: any;
  ready: boolean;
  changeLanguage: (language: string) => Promise<void>;
  currentLanguage: string;
  supportedLanguages: string[];
  translateText: (text: string, targetLanguage?: string) => Promise<string>;
  detectLanguage: (text: string) => Promise<string>;
}

export const useTranslation = (namespace?: string): UseTranslationReturn => {
  const { t, i18n, ready } = useNextTranslation(namespace || 'common');
  const router = useRouter();
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);

  // Load supported languages on mount
  useEffect(() => {
    const loadSupportedLanguages = async () => {
      try {
        const languages = await translationService.getSupportedLanguages();
        setSupportedLanguages(languages);
      } catch (error) {
        console.error('Failed to load supported languages:', error);
        // Fallback to default languages
        setSupportedLanguages(['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar']);
      }
    };

    loadSupportedLanguages();
  }, []);

  const changeLanguage = useCallback(async (language: string) => {
    try {
      // Store user preference
      translationService.setStoredLanguage(language);
      
      // Change Next.js locale
      await router.push(router.pathname, router.asPath, { locale: language });
    } catch (error) {
      console.error('Failed to change language:', error);
      throw error;
    }
  }, [router]);

  const translateText = useCallback(async (text: string, targetLanguage?: string) => {
    try {
      const target = targetLanguage || router.locale || 'en';
      if (target === 'en') {
        return text; // No translation needed for English
      }

      const result = await translationService.translateText({
        text,
        targetLanguage: target,
      });
      
      return result.translatedText;
    } catch (error) {
      console.error('Text translation failed:', error);
      return text; // Return original text on error
    }
  }, [router.locale]);

  const detectLanguage = useCallback(async (text: string) => {
    try {
      const result = await translationService.detectLanguage(text);
      return result.detectedLanguage;
    } catch (error) {
      console.error('Language detection failed:', error);
      return 'en'; // Default to English on error
    }
  }, []);

  return {
    t,
    i18n,
    ready,
    changeLanguage,
    currentLanguage: router.locale || 'en',
    supportedLanguages,
    translateText,
    detectLanguage,
  };
};