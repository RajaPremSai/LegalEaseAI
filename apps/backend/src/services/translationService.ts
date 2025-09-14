import { Translate } from '@google-cloud/translate/build/src/v2';
import { logger } from '../utils/logger';

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

export interface LegalTermTranslation {
  term: string;
  definition: string;
  translations: Record<string, {
    term: string;
    definition: string;
  }>;
}

class TranslationService {
  private translate: Translate;
  private supportedLanguages = [
    'en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar'
  ];

  // Legal term database with translations
  private legalTermsDatabase: Record<string, LegalTermTranslation> = {
    'contract': {
      term: 'Contract',
      definition: 'A legally binding agreement between two or more parties',
      translations: {
        'es': {
          term: 'Contrato',
          definition: 'Un acuerdo legalmente vinculante entre dos o más partes'
        },
        'fr': {
          term: 'Contrat',
          definition: 'Un accord juridiquement contraignant entre deux ou plusieurs parties'
        },
        'de': {
          term: 'Vertrag',
          definition: 'Eine rechtlich bindende Vereinbarung zwischen zwei oder mehr Parteien'
        },
        'pt': {
          term: 'Contrato',
          definition: 'Um acordo legalmente vinculativo entre duas ou mais partes'
        },
        'zh': {
          term: '合同',
          definition: '两方或多方之间具有法律约束力的协议'
        },
        'ja': {
          term: '契約',
          definition: '二者以上の当事者間の法的拘束力のある合意'
        },
        'ko': {
          term: '계약',
          definition: '둘 이상의 당사자 간의 법적 구속력이 있는 합의'
        },
        'ar': {
          term: 'عقد',
          definition: 'اتفاقية ملزمة قانونياً بين طرفين أو أكثر'
        }
      }
    },
    'liability': {
      term: 'Liability',
      definition: 'Legal responsibility for one\'s acts or omissions',
      translations: {
        'es': {
          term: 'Responsabilidad',
          definition: 'Responsabilidad legal por los actos u omisiones propios'
        },
        'fr': {
          term: 'Responsabilité',
          definition: 'Responsabilité légale pour ses actes ou omissions'
        },
        'de': {
          term: 'Haftung',
          definition: 'Rechtliche Verantwortung für eigene Handlungen oder Unterlassungen'
        },
        'pt': {
          term: 'Responsabilidade',
          definition: 'Responsabilidade legal pelos próprios atos ou omissões'
        },
        'zh': {
          term: '责任',
          definition: '对自己的行为或不行为承担的法律责任'
        },
        'ja': {
          term: '責任',
          definition: '自分の行為または不作為に対する法的責任'
        },
        'ko': {
          term: '책임',
          definition: '자신의 행위나 부작위에 대한 법적 책임'
        },
        'ar': {
          term: 'مسؤولية',
          definition: 'المسؤولية القانونية عن أفعال الشخص أو إهماله'
        }
      }
    },
    'indemnification': {
      term: 'Indemnification',
      definition: 'Protection against loss or damage through compensation',
      translations: {
        'es': {
          term: 'Indemnización',
          definition: 'Protección contra pérdida o daño mediante compensación'
        },
        'fr': {
          term: 'Indemnisation',
          definition: 'Protection contre les pertes ou dommages par compensation'
        },
        'de': {
          term: 'Entschädigung',
          definition: 'Schutz vor Verlust oder Schaden durch Entschädigung'
        },
        'pt': {
          term: 'Indenização',
          definition: 'Proteção contra perda ou dano através de compensação'
        },
        'zh': {
          term: '赔偿',
          definition: '通过补偿来防止损失或损害'
        },
        'ja': {
          term: '補償',
          definition: '補償による損失や損害からの保護'
        },
        'ko': {
          term: '배상',
          definition: '보상을 통한 손실이나 손해로부터의 보호'
        },
        'ar': {
          term: 'تعويض',
          definition: 'الحماية من الخسارة أو الضرر من خلال التعويض'
        }
      }
    }
  };

  constructor() {
    this.translate = new Translate({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
  }

  /**
   * Translate text using Google Translate API
   */
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const { text, targetLanguage, sourceLanguage } = request;

      if (!this.supportedLanguages.includes(targetLanguage)) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      const options: any = {
        to: targetLanguage,
      };

      if (sourceLanguage) {
        options.from = sourceLanguage;
      }

      const [translation, metadata] = await this.translate.translate(text, options);

      return {
        translatedText: Array.isArray(translation) ? translation[0] : translation,
        detectedSourceLanguage: metadata?.data?.translations?.[0]?.detectedSourceLanguage,
      };
    } catch (error) {
      logger.error('Translation failed:', error);
      throw new Error('Translation service unavailable');
    }
  }

  /**
   * Translate document analysis results
   */
  async translateAnalysis(
    analysis: any,
    targetLanguage: string
  ): Promise<any> {
    try {
      if (targetLanguage === 'en') {
        return analysis; // No translation needed for English
      }

      const translatedAnalysis = { ...analysis };

      // Translate summary
      if (analysis.summary) {
        const summaryTranslation = await this.translateText({
          text: analysis.summary,
          targetLanguage,
        });
        translatedAnalysis.summary = summaryTranslation.translatedText;
      }

      // Translate recommendations
      if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
        translatedAnalysis.recommendations = await Promise.all(
          analysis.recommendations.map(async (rec: string) => {
            const translation = await this.translateText({
              text: rec,
              targetLanguage,
            });
            return translation.translatedText;
          })
        );
      }

      // Translate key terms with legal context
      if (analysis.keyTerms && Array.isArray(analysis.keyTerms)) {
        translatedAnalysis.keyTerms = await Promise.all(
          analysis.keyTerms.map(async (term: any) => {
            const translatedTerm = { ...term };
            
            // Check if we have a pre-translated legal term
            const legalTerm = this.getLegalTermTranslation(term.term, targetLanguage);
            if (legalTerm) {
              translatedTerm.term = legalTerm.term;
              translatedTerm.definition = legalTerm.definition;
            } else {
              // Fallback to Google Translate
              const termTranslation = await this.translateText({
                text: term.term,
                targetLanguage,
              });
              const definitionTranslation = await this.translateText({
                text: term.definition,
                targetLanguage,
              });
              
              translatedTerm.term = termTranslation.translatedText;
              translatedTerm.definition = definitionTranslation.translatedText;
            }
            
            return translatedTerm;
          })
        );
      }

      // Translate risks
      if (analysis.risks && Array.isArray(analysis.risks)) {
        translatedAnalysis.risks = await Promise.all(
          analysis.risks.map(async (risk: any) => {
            const translatedRisk = { ...risk };
            
            const descriptionTranslation = await this.translateText({
              text: risk.description,
              targetLanguage,
            });
            const recommendationTranslation = await this.translateText({
              text: risk.recommendation,
              targetLanguage,
            });
            
            translatedRisk.description = descriptionTranslation.translatedText;
            translatedRisk.recommendation = recommendationTranslation.translatedText;
            
            return translatedRisk;
          })
        );
      }

      return translatedAnalysis;
    } catch (error) {
      logger.error('Analysis translation failed:', error);
      throw new Error('Analysis translation failed');
    }
  }

  /**
   * Get legal term translation from database
   */
  getLegalTermTranslation(term: string, targetLanguage: string): { term: string; definition: string } | null {
    const normalizedTerm = term.toLowerCase().replace(/\s+/g, '_');
    const legalTerm = this.legalTermsDatabase[normalizedTerm];
    
    if (legalTerm && legalTerm.translations[targetLanguage]) {
      return legalTerm.translations[targetLanguage];
    }
    
    return null;
  }

  /**
   * Get all legal terms in a specific language
   */
  getLegalTermsForLanguage(language: string): Record<string, { term: string; definition: string }> {
    const terms: Record<string, { term: string; definition: string }> = {};
    
    Object.entries(this.legalTermsDatabase).forEach(([key, value]) => {
      if (language === 'en') {
        terms[key] = {
          term: value.term,
          definition: value.definition,
        };
      } else if (value.translations[language]) {
        terms[key] = value.translations[language];
      }
    });
    
    return terms;
  }

  /**
   * Detect document language
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      const [detection] = await this.translate.detect(text);
      const detections = Array.isArray(detection) ? detection : [detection];
      
      if (detections.length > 0 && detections[0].language) {
        return detections[0].language;
      }
      
      return 'en'; // Default to English
    } catch (error) {
      logger.error('Language detection failed:', error);
      return 'en'; // Default to English on error
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.supportedLanguages.includes(language);
  }
}

export const translationService = new TranslationService();