import { logger } from '../utils/logger.js';
import { TranslationResult, SubtitleSegment } from '../types/index.js';

export interface DeepLTranslatorOptions {
  apiKey: string;
  baseUrl?: string;
  formality?: 'default' | 'more' | 'less';
}

export class DeepLTranslator {
  private apiKey: string;
  private baseUrl: string;
  private formality: string;

  constructor(options: DeepLTranslatorOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.deepl.com/v2';
    this.formality = options.formality || 'default';
  }

  async translateSegments(
    segments: SubtitleSegment[],
    targetLanguage: string = 'ZH'
  ): Promise<SubtitleSegment[]> {
    logger.info(`Translating ${segments.length} segments to ${targetLanguage} using DeepL`);

    const translatedSegments: SubtitleSegment[] = [];
    
    // Process segments in batches
    const batchSize = 50; // DeepL allows larger batches
    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = segments.slice(i, i + batchSize);
      const translatedBatch = await this.translateBatch(batch, targetLanguage);
      translatedSegments.push(...translatedBatch);
      
      // Add small delay to avoid rate limiting
      if (i + batchSize < segments.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info(`Translation completed for ${translatedSegments.length} segments`);
    return translatedSegments;
  }

  async translateText(text: string, targetLanguage: string = 'ZH'): Promise<TranslationResult> {
    logger.info(`Translating text to ${targetLanguage} using DeepL`);

    try {
      const formData = new URLSearchParams();
      formData.append('text', text);
      formData.append('target_lang', targetLanguage);
      
      if (this.formality !== 'default') {
        formData.append('formality', this.formality);
      }

      const response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepL API error: ${response.status} ${errorText}`);
      }

      const result = await response.json() as any;
      const translatedText = result.translations[0]?.text || '';
      
      return {
        originalText: text,
        translatedText: translatedText.trim(),
        confidence: 0.9, // DeepL typically has high confidence
      };
    } catch (error) {
      logger.error(`DeepL translation failed: ${error}`);
      throw error;
    }
  }

  private async translateBatch(
    segments: SubtitleSegment[],
    targetLanguage: string
  ): Promise<SubtitleSegment[]> {
    const texts = segments.map(segment => segment.text);
    
    try {
      const formData = new URLSearchParams();
      texts.forEach(text => formData.append('text', text));
      formData.append('target_lang', targetLanguage);
      
      if (this.formality !== 'default') {
        formData.append('formality', this.formality);
      }

      const response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepL API error: ${response.status} ${errorText}`);
      }

      const result = await response.json() as any;
      const translations = result.translations || [];
      
      return segments.map((segment, index) => ({
        ...segment,
        text: translations[index]?.text?.trim() || segment.text,
      }));
    } catch (error) {
      logger.warn(`Batch translation failed, falling back to individual translation: ${error}`);
      
      // Fallback to individual translation
      const translatedSegments: SubtitleSegment[] = [];
      for (const segment of segments) {
        try {
          const result = await this.translateText(segment.text, targetLanguage);
          translatedSegments.push({
            ...segment,
            text: result.translatedText,
          });
        } catch (individualError) {
          logger.warn(`Individual translation failed for segment: ${segment.text}`, individualError);
          translatedSegments.push(segment); // Keep original text
        }
      }
      
      return translatedSegments;
    }
  }

  async getUsage(): Promise<{ character_count: number; character_limit: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/usage`, {
        method: 'GET',
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepL API error: ${response.status} ${errorText}`);
      }

      return await response.json() as { character_count: number; character_limit: number };
    } catch (error) {
      logger.error(`Failed to get DeepL usage: ${error}`);
      throw error;
    }
  }
}