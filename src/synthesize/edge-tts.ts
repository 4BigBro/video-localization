import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { fileExists, getOutputPath, ensureDirectoryExists } from '../utils/file-utils.js';
import { SubtitleSegment, TTSResult } from '../types/index.js';

export interface EdgeTTSOptions {
  voice?: string;
  rate?: string;
  volume?: string;
  pitch?: string;
  outputFormat?: 'mp3' | 'wav';
}

export class EdgeTTS {
  private defaultVoice: string;

  constructor(defaultVoice: string = 'zh-CN-XiaoxiaoNeural') {
    this.defaultVoice = defaultVoice;
  }

  async synthesizeSegments(
    segments: SubtitleSegment[],
    outputDir: string,
    options: EdgeTTSOptions = {}
  ): Promise<TTSResult[]> {
    await ensureDirectoryExists(outputDir);
    logger.info(`Synthesizing ${segments.length} segments using EdgeTTS`);

    const {
      voice = this.defaultVoice,
      rate = '+0%',
      volume = '+0%',
      pitch = '+0Hz',
      outputFormat = 'wav',
    } = options;

    const results: TTSResult[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const outputPath = join(outputDir, `segment_${i.toString().padStart(4, '0')}.${outputFormat}`);
      
      try {
        logger.debug(`Synthesizing segment ${i + 1}/${segments.length}: ${segment.text.slice(0, 50)}...`);
        
        const duration = await this.synthesizeText(segment.text, outputPath, {
          voice,
          rate,
          volume,
          pitch,
          outputFormat,
        });

        results.push({
          audioPath: outputPath,
          duration,
          text: segment.text,
        });
      } catch (error) {
        logger.error(`Failed to synthesize segment ${i}: ${error}`);
        throw error;
      }
    }

    logger.info(`EdgeTTS synthesis completed for ${results.length} segments`);
    return results;
  }

  async synthesizeText(
    text: string,
    outputPath: string,
    options: EdgeTTSOptions = {}
  ): Promise<number> {
    const {
      voice = this.defaultVoice,
      rate = '+0%',
      volume = '+0%',
      pitch = '+0Hz',
      outputFormat = 'wav',
    } = options;

    if (!text.trim()) {
      throw new Error('Text cannot be empty');
    }

    await ensureDirectoryExists(join(outputPath, '..'));

    try {
      // Create SSML for better control
      const ssml = this.createSSML(text, voice, rate, volume, pitch);
      
      // Use edge-tts command line tool
      const args = [
        '--text', ssml,
        '--write-media', outputPath,
        '--write-subtitles', outputPath.replace(`.${outputFormat}`, '.vtt'),
      ];

      await this.runEdgeTTS(args);
      
      // Get duration from the generated file
      const duration = await this.getAudioDuration(outputPath);
      
      logger.debug(`Synthesized text to ${outputPath}, duration: ${duration}s`);
      return duration;
    } catch (error) {
      logger.error(`EdgeTTS synthesis failed: ${error}`);
      throw error;
    }
  }

  async listVoices(language?: string): Promise<string[]> {
    try {
      const args = ['--list-voices'];
      if (language) {
        args.push('--text', 'hello'); // Required parameter
      }

      const output = await this.runEdgeTTS(args, true);
      const voices = this.parseVoicesList(output);
      
      if (language) {
        return voices.filter(voice => voice.toLowerCase().includes(language.toLowerCase()));
      }
      
      return voices;
    } catch (error) {
      logger.error(`Failed to list EdgeTTS voices: ${error}`);
      throw error;
    }
  }

  private createSSML(text: string, voice: string, rate: string, volume: string, pitch: string): string {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
      <voice name="${voice}">
        <prosody rate="${rate}" volume="${volume}" pitch="${pitch}">
          ${escapedText}
        </prosody>
      </voice>
    </speak>`;
  }

  private runEdgeTTS(args: string[], captureOutput = false): Promise<string> {
    return new Promise((resolve, reject) => {
      logger.debug(`Running edge-tts with args: ${args.join(' ')}`);
      
      const edgeTTS = spawn('edge-tts', args);
      let stdout = '';
      let stderr = '';

      edgeTTS.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      edgeTTS.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      edgeTTS.on('close', (code) => {
        if (code === 0) {
          resolve(captureOutput ? stdout : stderr);
        } else {
          reject(new Error(`edge-tts process exited with code ${code}: ${stderr}`));
        }
      });

      edgeTTS.on('error', (error) => {
        reject(new Error(`edge-tts process error: ${error.message}`));
      });
    });
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    // Use ffprobe to get audio duration
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

  private parseVoicesList(output: string): string[] {
    const lines = output.split('\n');
    const voices: string[] = [];
    
    for (const line of lines) {
      // Parse voice name from edge-tts output format
      const match = line.match(/Name: (.+)/);
      if (match) {
        voices.push(match[1]);
      }
    }
    
    return voices;
  }
}