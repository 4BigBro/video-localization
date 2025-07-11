import { spawn } from 'child_process';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { fileExists, ensureDirectoryExists } from '../utils/file-utils.js';
import { AudioFile, TranscriptionResult, SubtitleSegment } from '../types/index.js';

export interface WhisperOptions {
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  outputFormat: 'json' | 'srt' | 'vtt' | 'txt';
  whisperPath?: string;
}

export class WhisperTranscriber {
  private whisperPath: string;

  constructor(whisperPath: string = 'whisper') {
    this.whisperPath = whisperPath;
  }

  async transcribe(
    audioFile: AudioFile,
    options: WhisperOptions = {
      model: 'base',
      outputFormat: 'json',
    }
  ): Promise<TranscriptionResult> {
    if (!(await fileExists(audioFile.path))) {
      throw new Error(`Audio file not found: ${audioFile.path}`);
    }

    const outputDir = join(audioFile.path, '..', 'transcription');
    await ensureDirectoryExists(outputDir);

    logger.info(`Transcribing audio file: ${audioFile.path}`);

    const args = [
      audioFile.path,
      '--model', options.model,
      '--output_format', options.outputFormat,
      '--output_dir', outputDir,
    ];

    if (options.language) {
      args.push('--language', options.language);
    }

    try {
      await this.runWhisper(args);
      
      const outputFile = this.getOutputFileName(audioFile.path, outputDir, options.outputFormat);
      const transcriptionData = await this.parseTranscriptionOutput(outputFile, options.outputFormat);
      
      logger.info(`Transcription completed: ${outputFile}`);
      
      return {
        segments: transcriptionData.segments,
        language: transcriptionData.language || 'unknown',
        confidence: transcriptionData.confidence || 0.5,
      };
    } catch (error) {
      logger.error(`Transcription failed: ${error}`);
      throw error;
    }
  }

  private async runWhisper(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug(`Running whisper with args: ${args.join(' ')}`);
      
      const whisper = spawn(this.whisperPath, args);
      let stderr = '';

      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.debug(`Whisper output: ${data.toString().trim()}`);
      });

      whisper.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Whisper process exited with code ${code}: ${stderr}`));
        }
      });

      whisper.on('error', (error) => {
        reject(new Error(`Whisper process error: ${error.message}`));
      });
    });
  }

  private getOutputFileName(inputPath: string, outputDir: string, format: string): string {
    const basename = inputPath.split('/').pop()?.split('.')[0] || 'output';
    return join(outputDir, `${basename}.${format}`);
  }

  private async parseTranscriptionOutput(
    outputFile: string,
    format: string
  ): Promise<{ segments: SubtitleSegment[]; language?: string; confidence?: number }> {
    const content = await import('fs').then(fs => fs.promises.readFile(outputFile, 'utf8'));
    
    switch (format) {
      case 'json':
        return this.parseJsonOutput(content);
      case 'srt':
        return this.parseSrtOutput(content);
      case 'vtt':
        return this.parseVttOutput(content);
      case 'txt':
        return this.parseTxtOutput(content);
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  private parseJsonOutput(content: string): { segments: SubtitleSegment[]; language?: string; confidence?: number } {
    try {
      const data = JSON.parse(content);
      const segments: SubtitleSegment[] = data.segments?.map((segment: any) => ({
        startTime: segment.start,
        endTime: segment.end,
        text: segment.text.trim(),
        speaker: segment.speaker,
      })) || [];

      return {
        segments,
        language: data.language,
        confidence: data.confidence,
      };
    } catch (error) {
      throw new Error(`Failed to parse JSON transcription output: ${error}`);
    }
  }

  private parseSrtOutput(content: string): { segments: SubtitleSegment[] } {
    const segments: SubtitleSegment[] = [];
    const srtBlocks = content.split('\n\n').filter(block => block.trim());

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

    return { segments };
  }

  private parseVttOutput(content: string): { segments: SubtitleSegment[] } {
    const segments: SubtitleSegment[] = [];
    const lines = content.split('\n');
    
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

    return { segments };
  }

  private parseTxtOutput(content: string): { segments: SubtitleSegment[] } {
    return {
      segments: [{
        startTime: 0,
        endTime: 0,
        text: content,
      }],
    };
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