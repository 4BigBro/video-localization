import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { fileExists, getOutputPath, ensureDirectoryExists, cleanupFiles } from '../utils/file-utils.js';
import { SubtitleSegment, TTSResult, ProcessingResult } from '../types/index.js';

export interface VideoMergerOptions {
  ffmpegPath?: string;
  audioCodec?: string;
  videoCodec?: string;
  quality?: 'high' | 'medium' | 'low';
  subtitleStyle?: SubtitleStyle;
  keepIntermediateFiles?: boolean;
}

export interface SubtitleStyle {
  fontName?: string;
  fontSize?: number;
  primaryColor?: string;
  secondaryColor?: string;
  outlineColor?: string;
  backColor?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: number;
  marginL?: number;
  marginR?: number;
  marginV?: number;
}

export class VideoMerger {
  private ffmpegPath: string;

  constructor(ffmpegPath: string = 'ffmpeg') {
    this.ffmpegPath = ffmpegPath;
  }

  async mergeVideoWithAudio(
    originalVideoPath: string,
    ttsResults: TTSResult[],
    segments: SubtitleSegment[],
    outputPath: string,
    options: VideoMergerOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const intermediateFiles: string[] = [];

    try {
      logger.info(`Starting video merge process: ${originalVideoPath} -> ${outputPath}`);

      const {
        audioCodec = 'aac',
        videoCodec = 'copy',
        quality = 'high',
        subtitleStyle = {},
        keepIntermediateFiles = false,
      } = options;

      // Step 1: Concatenate TTS audio segments
      const mergedAudioPath = await this.concatenateAudio(ttsResults, segments, options);
      intermediateFiles.push(mergedAudioPath);

      // Step 2: Generate subtitle file
      const subtitlePath = await this.generateSubtitleFile(segments, options);
      intermediateFiles.push(subtitlePath);

      // Step 3: Merge video with new audio and subtitles
      await this.mergeComponents(
        originalVideoPath,
        mergedAudioPath,
        subtitlePath,
        outputPath,
        { audioCodec, videoCodec, quality, subtitleStyle }
      );

      const processingTime = Date.now() - startTime;
      logger.info(`Video merge completed in ${processingTime}ms: ${outputPath}`);

      // Cleanup intermediate files if requested
      if (!keepIntermediateFiles) {
        await cleanupFiles(intermediateFiles);
      }

      return {
        success: true,
        outputPath,
        processingTime,
        intermediateFiles: keepIntermediateFiles ? intermediateFiles : [],
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Video merge failed: ${error}`);

      // Cleanup on error
      await cleanupFiles(intermediateFiles);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        intermediateFiles: [],
      };
    }
  }

  private async concatenateAudio(
    ttsResults: TTSResult[],
    segments: SubtitleSegment[],
    options: VideoMergerOptions
  ): Promise<string> {
    if (ttsResults.length !== segments.length) {
      throw new Error('TTS results and segments count mismatch');
    }

    const outputDir = join(process.cwd(), 'temp', 'audio');
    await ensureDirectoryExists(outputDir);
    const outputPath = join(outputDir, `merged_audio_${Date.now()}.wav`);

    logger.info(`Concatenating ${ttsResults.length} audio segments`);

    // Create a complex filter for precise audio timing
    const filterComplex = this.buildAudioFilterComplex(ttsResults, segments);
    
    const args = [
      // Input files
      ...ttsResults.flatMap(result => ['-i', result.audioPath]),
      
      // Filter complex for timing
      '-filter_complex', filterComplex,
      
      // Output settings
      '-map', '[out]',
      '-acodec', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '2',
      
      // Overwrite output
      '-y', outputPath,
    ];

    await this.runFFmpeg(args);
    
    logger.debug(`Audio concatenation completed: ${outputPath}`);
    return outputPath;
  }

  private buildAudioFilterComplex(ttsResults: TTSResult[], segments: SubtitleSegment[]): string {
    const filters: string[] = [];
    const delays: string[] = [];

    // Calculate delays based on segment timing
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const delayMs = Math.round(segment.startTime * 1000);
      
      if (delayMs > 0) {
        delays.push(`[${i}:0]adelay=${delayMs}|${delayMs}[delayed${i}]`);
        filters.push(`delayed${i}`);
      } else {
        filters.push(`${i}:0`);
      }
    }

    // Combine all delayed audio streams
    const mixFilter = filters.length > 1 
      ? `[${filters.join('][')}]amix=inputs=${filters.length}:duration=longest[out]`
      : `[${filters[0]}]acopy[out]`;

    return [...delays, mixFilter].join(';');
  }

  private async generateSubtitleFile(
    segments: SubtitleSegment[],
    options: VideoMergerOptions
  ): Promise<string> {
    const outputDir = join(process.cwd(), 'temp', 'subtitles');
    await ensureDirectoryExists(outputDir);
    const outputPath = join(outputDir, `subtitles_${Date.now()}.ass`);

    logger.info(`Generating subtitle file with ${segments.length} segments`);

    const assContent = this.generateASSSubtitles(segments, options.subtitleStyle);
    await writeFile(outputPath, assContent, 'utf8');

    logger.debug(`Subtitle file generated: ${outputPath}`);
    return outputPath;
  }

  private generateASSSubtitles(segments: SubtitleSegment[], style: SubtitleStyle = {}): string {
    const {
      fontName = 'Arial',
      fontSize = 20,
      primaryColor = '&H00FFFFFF',
      secondaryColor = '&H000000FF',
      outlineColor = '&H00000000',
      backColor = '&H80000000',
      bold = false,
      italic = false,
      alignment = 2,
      marginL = 10,
      marginR = 10,
      marginV = 10,
    } = style;

    const header = `[Script Info]
Title: Video Localization Subtitles
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${secondaryColor},${outlineColor},${backColor},${bold ? 1 : 0},${italic ? 1 : 0},0,0,100,100,0,0,1,2,0,${alignment},${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events = segments.map(segment => {
      const startTime = this.formatASSTime(segment.startTime);
      const endTime = this.formatASSTime(segment.endTime);
      const text = segment.text.replace(/\n/g, '\\N');
      
      return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}`;
    }).join('\n');

    return header + events;
  }

  private formatASSTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centiseconds = Math.floor((seconds % 1) * 100);

    return `${hours.toString().padStart(1, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  private async mergeComponents(
    videoPath: string,
    audioPath: string,
    subtitlePath: string,
    outputPath: string,
    options: {
      audioCodec: string;
      videoCodec: string;
      quality: string;
      subtitleStyle?: SubtitleStyle;
    }
  ): Promise<void> {
    await ensureDirectoryExists(join(outputPath, '..'));

    logger.info(`Merging video components to: ${outputPath}`);

    const qualitySettings = this.getQualitySettings(options.quality);
    
    const args = [
      // Input video
      '-i', videoPath,
      // Input audio
      '-i', audioPath,
      
      // Video settings
      '-c:v', options.videoCodec,
      ...qualitySettings.video,
      
      // Audio settings
      '-c:a', options.audioCodec,
      ...qualitySettings.audio,
      
      // Subtitle settings
      '-vf', `ass=${subtitlePath}`,
      
      // Map streams
      '-map', '0:v:0', // Video from first input
      '-map', '1:a:0', // Audio from second input
      
      // Other settings
      '-shortest', // End when shortest stream ends
      '-y', outputPath, // Overwrite output
    ];

    await this.runFFmpeg(args);
    logger.debug(`Component merge completed: ${outputPath}`);
  }

  private getQualitySettings(quality: string): { video: string[]; audio: string[] } {
    switch (quality) {
      case 'high':
        return {
          video: ['-crf', '18', '-preset', 'slow'],
          audio: ['-b:a', '192k'],
        };
      case 'medium':
        return {
          video: ['-crf', '23', '-preset', 'medium'],
          audio: ['-b:a', '128k'],
        };
      case 'low':
        return {
          video: ['-crf', '28', '-preset', 'fast'],
          audio: ['-b:a', '96k'],
        };
      default:
        return {
          video: ['-crf', '23', '-preset', 'medium'],
          audio: ['-b:a', '128k'],
        };
    }
  }

  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug(`Running ffmpeg with args: ${args.join(' ')}`);
      
      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        // Log progress information
        const progressMatch = data.toString().match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        if (progressMatch) {
          logger.debug(`FFmpeg progress: ${progressMatch[1]}`);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });
    });
  }
}