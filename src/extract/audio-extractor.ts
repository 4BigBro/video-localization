import { spawn } from 'child_process';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { fileExists, getOutputPath, ensureDirectoryExists } from '../utils/file-utils.js';
import { AudioFile, VideoFile } from '../types/index.js';

export class AudioExtractor {
  private ffmpegPath: string;

  constructor(ffmpegPath: string = 'ffmpeg') {
    this.ffmpegPath = ffmpegPath;
  }

  async extractAudio(
    videoPath: string,
    outputPath?: string,
    options: {
      format?: 'wav' | 'mp3' | 'flac';
      sampleRate?: number;
      channels?: number;
      quality?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<AudioFile> {
    const {
      format = 'wav',
      sampleRate = 16000,
      channels = 1,
      quality = 'high',
    } = options;

    if (!(await fileExists(videoPath))) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const output = outputPath || getOutputPath(videoPath, 'audio', `.${format}`);
    await ensureDirectoryExists(join(output, '..'));

    logger.info(`Extracting audio from ${videoPath} to ${output}`);

    const args = [
      '-i', videoPath,
      '-vn', // No video
      '-ar', sampleRate.toString(),
      '-ac', channels.toString(),
      '-f', format,
    ];

    // Add quality settings
    if (format === 'mp3') {
      const qualityMap = { high: '0', medium: '2', low: '5' };
      args.push('-q:a', qualityMap[quality]);
    } else if (format === 'wav') {
      args.push('-acodec', 'pcm_s16le');
    }

    args.push('-y', output); // Overwrite output file

    try {
      await this.runFFmpeg(args);
      
      const audioInfo = await this.getAudioInfo(output);
      logger.info(`Audio extraction completed: ${output}`);
      
      return {
        path: output,
        duration: audioInfo.duration,
        format,
        sampleRate,
        channels,
      };
    } catch (error) {
      logger.error(`Audio extraction failed: ${error}`);
      throw error;
    }
  }

  async getVideoInfo(videoPath: string): Promise<VideoFile> {
    if (!(await fileExists(videoPath))) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const args = [
      '-i', videoPath,
      '-f', 'null',
      '-'
    ];

    try {
      const output = await this.runFFmpeg(args, true);
      const duration = this.parseDuration(output);
      const format = this.parseFormat(output);
      
      const stats = await import('fs').then(fs => fs.promises.stat(videoPath));
      
      return {
        path: videoPath,
        duration,
        format,
        size: stats.size,
      };
    } catch (error) {
      logger.error(`Failed to get video info: ${error}`);
      throw error;
    }
  }

  private async getAudioInfo(audioPath: string): Promise<{ duration: number; format: string }> {
    const args = [
      '-i', audioPath,
      '-f', 'null',
      '-'
    ];

    try {
      const output = await this.runFFmpeg(args, true);
      const duration = this.parseDuration(output);
      const format = this.parseFormat(output);
      
      return { duration, format };
    } catch (error) {
      logger.error(`Failed to get audio info: ${error}`);
      throw error;
    }
  }

  private runFFmpeg(args: string[], captureOutput = false): Promise<string> {
    return new Promise((resolve, reject) => {
      logger.debug(`Running ffmpeg with args: ${args.join(' ')}`);
      
      const ffmpeg = spawn(this.ffmpegPath, args);
      let stdout = '';
      let stderr = '';

      ffmpeg.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(captureOutput ? stderr : stdout);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });
    });
  }

  private parseDuration(ffmpegOutput: string): number {
    const match = ffmpegOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (!match) {
      throw new Error('Could not parse duration from ffmpeg output');
    }
    
    const [, hours, minutes, seconds, centiseconds] = match;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
  }

  private parseFormat(ffmpegOutput: string): string {
    const match = ffmpegOutput.match(/Input #0, (\w+),/);
    return match ? match[1] : 'unknown';
  }
}