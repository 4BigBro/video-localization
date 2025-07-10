import { logger } from '../utils/logger.js';
import { TranslationResult, SubtitleSegment } from '../types/index.js';

export interface OpenAITranslatorOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
}

export class OpenAITranslator {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private baseUrl: string;

  constructor(options: OpenAITranslatorOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'gpt-3.5-turbo';
    this.maxTokens = options.maxTokens || 4096;
    this.temperature = options.temperature || 0.3;
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
  }

  async translateSegments(
    segments: SubtitleSegment[],
    targetLanguage: string = 'Chinese'
  ): Promise<SubtitleSegment[]> {
    logger.info(`Translating ${segments.length} segments to ${targetLanguage} using OpenAI`);

    const translatedSegments: SubtitleSegment[] = [];
    
    // Process segments in batches
    const batchSize = 10;
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

  async translateText(text: string, targetLanguage: string = 'Chinese'): Promise<TranslationResult> {
    logger.info(`Translating text to ${targetLanguage} using OpenAI`);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the given text to ${targetLanguage}. Maintain the original meaning and tone. Only return the translated text, no explanations.`,
            },
            {
              role: 'user',
              content: text,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      const translatedText = result.choices[0]?.message?.content || '';
      
      return {
        originalText: text,
        translatedText: translatedText.trim(),
        confidence: 0.85, // OpenAI typically has good confidence
      };
    } catch (error) {
      logger.error(`OpenAI translation failed: ${error}`);
      throw error;
    }
  }

  private async translateBatch(
    segments: SubtitleSegment[],
    targetLanguage: string
  ): Promise<SubtitleSegment[]> {
    const texts = segments.map((segment, index) => `${index + 1}. ${segment.text}`);
    const batchText = texts.join('\n');
    
    try {
      const translationResult = await this.translateText(batchText, targetLanguage);
      const translatedLines = translationResult.translatedText.split('\n');
      
      return segments.map((segment, index) => {
        const translatedLine = translatedLines[index];
        // Remove the number prefix if present
        const cleanText = translatedLine?.replace(/^\d+\.\s*/, '').trim() || segment.text;
        
        return {
          ...segment,
          text: cleanText,
        };
      });
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
}