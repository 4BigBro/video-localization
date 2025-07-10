import { logger } from '../utils/logger.js';
import { TranslationResult, SubtitleSegment } from '../types/index.js';

export interface ClaudeTranslatorOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
}

export class ClaudeTranslator {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private baseUrl: string;

  constructor(options: ClaudeTranslatorOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'claude-3-haiku-20240307';
    this.maxTokens = options.maxTokens || 4096;
    this.temperature = options.temperature || 0.3;
    this.baseUrl = options.baseUrl || 'https://api.anthropic.com/v1';
  }

  async translateSegments(
    segments: SubtitleSegment[],
    targetLanguage: string = 'Chinese'
  ): Promise<SubtitleSegment[]> {
    logger.info(`Translating ${segments.length} segments to ${targetLanguage} using Claude`);

    const translatedSegments: SubtitleSegment[] = [];
    
    // Process segments in batches to avoid API limits
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
    logger.info(`Translating text to ${targetLanguage} using Claude`);

    try {
      const prompt = this.buildTranslationPrompt(text, targetLanguage);
      
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      const translatedText = result.content[0]?.text || '';
      
      return {
        originalText: text,
        translatedText: translatedText.trim(),
        confidence: 0.9, // Claude typically has high confidence
      };
    } catch (error) {
      logger.error(`Claude translation failed: ${error}`);
      throw error;
    }
  }

  private async translateBatch(
    segments: SubtitleSegment[],
    targetLanguage: string
  ): Promise<SubtitleSegment[]> {
    const texts = segments.map(segment => segment.text);
    const batchText = texts.join('\n---\n');
    
    try {
      const translationResult = await this.translateText(batchText, targetLanguage);
      const translatedTexts = translationResult.translatedText.split('\n---\n');
      
      return segments.map((segment, index) => ({
        ...segment,
        text: translatedTexts[index]?.trim() || segment.text,
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

  private buildTranslationPrompt(text: string, targetLanguage: string): string {
    return `Please translate the following text to ${targetLanguage}. 

Requirements:
- Maintain the original meaning and tone
- Keep the translation natural and fluent
- If there are multiple segments separated by "---", translate each segment separately and maintain the same separator
- Only return the translated text, no explanations or additional content

Text to translate:
${text}`;
  }
}