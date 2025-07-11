import { createWriteStream } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { ensureDirectoryExists } from '../utils/file-utils.js';
import { SubtitleSegment, TTSResult } from '../types/index.js';

export interface OpenAITTSOptions {
  apiKey: string;
  model?: 'tts-1' | 'tts-1-hd';
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  baseUrl?: string;
}

export class OpenAITTS {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async synthesizeSegments(
    segments: SubtitleSegment[],
    outputDir: string,
    options: Omit<OpenAITTSOptions, 'apiKey'> = {}
  ): Promise<TTSResult[]> {
    await ensureDirectoryExists(outputDir);
    logger.info(`Synthesizing ${segments.length} segments using OpenAI TTS`);

    const {
      model = 'tts-1',
      voice = 'alloy',
      speed = 1.0,
      responseFormat = 'wav',
    } = options;

    const results: TTSResult[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const outputPath = join(outputDir, `segment_${i.toString().padStart(4, '0')}.${responseFormat}`);
      
      try {
        logger.debug(`Synthesizing segment ${i + 1}/${segments.length}: ${segment.text.slice(0, 50)}...`);
        
        const duration = await this.synthesizeText(segment.text, outputPath, {
          model,
          voice,
          speed,
          responseFormat,
        });

        results.push({
          audioPath: outputPath,
          duration,
          text: segment.text,
        });

        // Add small delay to avoid rate limiting
        if (i + 1 < segments.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error(`Failed to synthesize segment ${i}: ${error}`);
        throw error;
      }
    }

    logger.info(`OpenAI TTS synthesis completed for ${results.length} segments`);
    return results;
  }

  async synthesizeText(
    text: string,
    outputPath: string,
    options: Omit<OpenAITTSOptions, 'apiKey'> = {}
  ): Promise<number> {
    const {
      model = 'tts-1',
      voice = 'alloy',
      speed = 1.0,
      responseFormat = 'wav',
    } = options;

    if (!text.trim()) {
      throw new Error('Text cannot be empty');
    }

    if (text.length > 4096) {
      throw new Error('Text is too long (max 4096 characters)');
    }

    await ensureDirectoryExists(join(outputPath, '..'));

    try {
      logger.debug(`Calling OpenAI TTS API for text: ${text.slice(0, 50)}...`);

      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          speed,
          response_format: responseFormat,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI TTS API error: ${response.status} ${errorText}`);
      }

      // Stream the response to file
      const fileStream = createWriteStream(outputPath);
      
      if (!response.body) {
        throw new Error('No response body received from OpenAI TTS API');
      }

      const reader = response.body.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fileStream.write(value);
        }
      } finally {
        fileStream.end();
      }

      // Wait for file to be written
      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', () => resolve());
        fileStream.on('error', reject);
      });

      // Get duration from the generated file
      const duration = await this.getAudioDuration(outputPath);
      
      logger.debug(`Synthesized text to ${outputPath}, duration: ${duration}s`);
      return duration;
    } catch (error) {
      logger.error(`OpenAI TTS synthesis failed: ${error}`);
      throw error;
    }
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    // Use ffprobe to get audio duration
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        audioPath,
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          resolve(isNaN(duration) ? 0 : duration);
        } else {
          reject(new Error(`ffprobe failed with code ${code}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`ffprobe error: ${error.message}`));
      });
    });
  }

  async estimateCost(segments: SubtitleSegment[], model: 'tts-1' | 'tts-1-hd' = 'tts-1'): Promise<number> {
    const totalCharacters = segments.reduce((sum, segment) => sum + segment.text.length, 0);
    
    // OpenAI pricing (as of 2024)
    const pricePerThousandChars = model === 'tts-1' ? 0.015 : 0.030;
    
    return (totalCharacters / 1000) * pricePerThousandChars;
  }
}