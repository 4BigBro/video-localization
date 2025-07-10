import { createReadStream } from 'fs';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/file-utils.js';
import { AudioFile, TranscriptionResult, SubtitleSegment } from '../types/index.js';

export interface OpenAITranscriberOptions {
  apiKey: string;
  model?: 'whisper-1';
  language?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export class OpenAITranscriber {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async transcribe(
    audioFile: AudioFile,
    options: Omit<OpenAITranscriberOptions, 'apiKey'> = {}
  ): Promise<TranscriptionResult> {
    if (!(await fileExists(audioFile.path))) {
      throw new Error(`Audio file not found: ${audioFile.path}`);
    }

    const {
      model = 'whisper-1',
      language,
      responseFormat = 'verbose_json',
      temperature = 0,
    } = options;

    logger.info(`Transcribing audio file using OpenAI: ${audioFile.path}`);

    try {
      const formData = new FormData();
      
      // Read file as stream
      const fileStream = createReadStream(audioFile.path);
      const fileBlob = new Blob([fileStream] as any, { type: 'audio/wav' });
      
      formData.append('file', fileBlob, audioFile.path.split('/').pop());
      formData.append('model', model);
      formData.append('response_format', responseFormat);
      formData.append('temperature', temperature.toString());
      
      if (language) {
        formData.append('language', language);
      }

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      logger.info(`OpenAI transcription completed`);
      
      return this.parseOpenAIResponse(result, responseFormat);
    } catch (error) {
      logger.error(`OpenAI transcription failed: ${error}`);
      throw error;
    }
  }

  private parseOpenAIResponse(
    response: any,
    responseFormat: string
  ): TranscriptionResult {
    switch (responseFormat) {
      case 'verbose_json':
        return this.parseVerboseJsonResponse(response);
      case 'json':
        return this.parseJsonResponse(response);
      case 'text':
        return this.parseTextResponse(response);
      case 'srt':
        return this.parseSrtResponse(response);
      case 'vtt':
        return this.parseVttResponse(response);
      default:
        throw new Error(`Unsupported response format: ${responseFormat}`);
    }
  }

  private parseVerboseJsonResponse(response: any): TranscriptionResult {
    const segments: SubtitleSegment[] = response.segments?.map((segment: any) => ({
      startTime: segment.start,
      endTime: segment.end,
      text: segment.text.trim(),
      speaker: segment.speaker,
    })) || [];

    return {
      segments,
      language: response.language || 'unknown',
      confidence: this.calculateAverageConfidence(response.segments),
    };
  }

  private parseJsonResponse(response: any): TranscriptionResult {
    return {
      segments: [{
        startTime: 0,
        endTime: 0,
        text: response.text || '',
      }],
      language: 'unknown',
      confidence: 0.5,
    };
  }

  private parseTextResponse(response: string): TranscriptionResult {
    return {
      segments: [{
        startTime: 0,
        endTime: 0,
        text: response,
      }],
      language: 'unknown',
      confidence: 0.5,
    };
  }

  private parseSrtResponse(response: string): TranscriptionResult {
    const segments: SubtitleSegment[] = [];
    const srtBlocks = response.split('\n\n').filter(block => block.trim());

    for (const block of srtBlocks) {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
        if (timeMatch) {
          const startTime = this.parseTimeString(timeMatch[1]);
          const endTime = this.parseTimeString(timeMatch[2]);
          const text = lines.slice(2).join('\n');
          
          segments.push({
            startTime,
            endTime,
            text,
          });
        }
      }
    }

    return {
      segments,
      language: 'unknown',
      confidence: 0.5,
    };
  }

  private parseVttResponse(response: string): TranscriptionResult {
    const segments: SubtitleSegment[] = [];
    const lines = response.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);
      
      if (timeMatch && i + 1 < lines.length) {
        const startTime = this.parseTimeString(timeMatch[1].replace('.', ','));
        const endTime = this.parseTimeString(timeMatch[2].replace('.', ','));
        const text = lines[i + 1];
        
        segments.push({
          startTime,
          endTime,
          text,
        });
      }
    }

    return {
      segments,
      language: 'unknown',
      confidence: 0.5,
    };
  }

  private calculateAverageConfidence(segments: any[]): number {
    if (!segments || segments.length === 0) return 0.5;
    
    const totalConfidence = segments.reduce((sum, segment) => {
      return sum + (segment.confidence || 0.5);
    }, 0);
    
    return totalConfidence / segments.length;
  }

  private parseTimeString(timeStr: string): number {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    
    const [, hours, minutes, seconds, milliseconds] = match;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
  }
}