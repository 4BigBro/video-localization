import { EventEmitter } from 'events';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { ProgressTracker } from '../utils/progress.js';
import { ensureDirectoryExists } from '../utils/file-utils.js';
import { AudioExtractor } from '../extract/index.js';
import { WhisperTranscriber, OpenAITranscriber } from '../transcribe/index.js';
import { OpenAITranslator, DeepLTranslator } from '../translate/index.js';
import { EdgeTTS, OpenAITTS } from '../synthesize/index.js';
import { VideoMerger } from '../merge/index.js';
import { ProcessingOptions, ProcessingResult } from '../types/index.js';
import { loadConfig } from './config.js';

export class VideoLocalizationPipeline extends EventEmitter {
  private progressTracker: ProgressTracker;
  private config: any;

  constructor() {
    super();
    
    const stages = [
      'Audio Extraction',
      'Transcription',
      'Translation',
      'Voice Synthesis',
      'Video Merging',
    ];
    
    this.progressTracker = new ProgressTracker(stages);
    this.setupProgressTracking();
  }

  async process(options: ProcessingOptions): Promise<ProcessingResult> {
    const startTime = Date.now();
    let intermediateFiles: string[] = [];

    try {
      logger.info('Starting video localization pipeline');
      
      // Load configuration
      this.config = await loadConfig();
      
      // Create temp directory
      const tempDir = join(process.cwd(), 'temp', Date.now().toString());
      await ensureDirectoryExists(tempDir);

      // Stage 1: Extract Audio
      this.progressTracker.startStage('Audio Extraction');
      const audioExtractor = new AudioExtractor();
      const audioFile = await audioExtractor.extractAudio(
        options.inputVideo,
        join(tempDir, 'extracted_audio.wav'),
        { quality: options.audioQuality }
      );
      intermediateFiles.push(audioFile.path);
      this.progressTracker.completeStage();
      this.emit('stage-complete', 'Audio Extraction');

      // Stage 2: Transcription
      this.progressTracker.startStage('Transcription');
      const transcriptionResult = await this.performTranscription(audioFile, options);
      this.progressTracker.completeStage();
      this.emit('stage-complete', 'Transcription');

      // Stage 3: Translation
      this.progressTracker.startStage('Translation');
      const translatedSegments = await this.performTranslation(
        transcriptionResult.segments,
        options
      );
      this.progressTracker.completeStage();
      this.emit('stage-complete', 'Translation');

      // Stage 4: Voice Synthesis
      this.progressTracker.startStage('Voice Synthesis');
      const ttsResults = await this.performVoiceSynthesis(
        translatedSegments,
        join(tempDir, 'tts'),
        options
      );
      intermediateFiles.push(...ttsResults.map(r => r.audioPath));
      this.progressTracker.completeStage();
      this.emit('stage-complete', 'Voice Synthesis');

      // Stage 5: Video Merging
      this.progressTracker.startStage('Video Merging');
      const videoMerger = new VideoMerger();
      const mergeResult = await videoMerger.mergeVideoWithAudio(
        options.inputVideo,
        ttsResults,
        translatedSegments,
        options.outputVideo,
        {
          quality: options.audioQuality,
          keepIntermediateFiles: options.keepIntermediateFiles,
        }
      );
      
      if (!mergeResult.success) {
        throw new Error(mergeResult.error || 'Video merging failed');
      }
      
      intermediateFiles.push(...mergeResult.intermediateFiles);
      this.progressTracker.completeStage();
      this.emit('stage-complete', 'Video Merging');

      const processingTime = Date.now() - startTime;
      logger.info(`Pipeline completed successfully in ${processingTime}ms`);

      return {
        success: true,
        outputPath: options.outputVideo,
        processingTime,
        intermediateFiles: options.keepIntermediateFiles ? intermediateFiles : [],
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Pipeline failed: ${error}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        intermediateFiles: [],
      };
    }
  }

  private async performTranscription(audioFile: any, options: ProcessingOptions) {
    const provider = options.transcriptionProvider;
    
    this.progressTracker.updateStage(10, `Initializing ${provider} transcriber`);

    if (provider === 'whisper') {
      const transcriber = new WhisperTranscriber();
      this.progressTracker.updateStage(30, 'Running Whisper transcription');
      
      return await transcriber.transcribe(audioFile, {
        model: 'base',
        outputFormat: 'json',
      });
    } else if (provider === 'openai') {
      const apiKey = this.config?.apiKeys?.openai;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      const transcriber = new OpenAITranscriber(apiKey);
      this.progressTracker.updateStage(30, 'Running OpenAI transcription');
      
      return await transcriber.transcribe(audioFile, {
        model: 'whisper-1',
        responseFormat: 'verbose_json',
      });
    } else {
      throw new Error(`Unsupported transcription provider: ${provider}`);
    }
  }

  private async performTranslation(segments: any[], options: ProcessingOptions) {
    const provider = options.translationProvider;
    
    this.progressTracker.updateStage(10, `Initializing ${provider} translator`);

    if (provider === 'openai') {
      const apiKey = this.config?.apiKeys?.openai;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      const translatorOptions: any = { apiKey };
      if (this.config?.baseUrls?.openai) {
        translatorOptions.baseUrl = this.config.baseUrls.openai;
      }
      
      const translator = new OpenAITranslator(translatorOptions);
      this.progressTracker.updateStage(30, 'Translating with OpenAI');
      
      return await translator.translateSegments(segments, options.targetLanguage);
    } else if (provider === 'deepl') {
      const apiKey = this.config?.apiKeys?.deepl;
      if (!apiKey) {
        throw new Error('DeepL API key not configured');
      }
      
      const translatorOptions: any = { apiKey };
      if (this.config?.baseUrls?.deepl) {
        translatorOptions.baseUrl = this.config.baseUrls.deepl;
      }
      
      const translator = new DeepLTranslator(translatorOptions);
      this.progressTracker.updateStage(30, 'Translating with DeepL');
      
      return await translator.translateSegments(segments, 'ZH');
    } else {
      throw new Error(`Unsupported translation provider: ${provider}`);
    }
  }

  private async performVoiceSynthesis(
    segments: any[],
    outputDir: string,
    options: ProcessingOptions
  ) {
    const provider = options.ttsProvider;
    
    this.progressTracker.updateStage(10, `Initializing ${provider} TTS`);

    if (provider === 'edge') {
      const edgeTTS = new EdgeTTS();
      this.progressTracker.updateStage(30, 'Synthesizing with EdgeTTS');
      
      return await edgeTTS.synthesizeSegments(segments, outputDir, {
        voice: 'zh-CN-XiaoxiaoNeural',
        outputFormat: 'wav',
      });
    } else if (provider === 'openai') {
      const apiKey = this.config?.apiKeys?.openai;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      const openaiTTS = new OpenAITTS(apiKey);
      this.progressTracker.updateStage(30, 'Synthesizing with OpenAI TTS');
      
      return await openaiTTS.synthesizeSegments(segments, outputDir, {
        model: 'tts-1',
        voice: 'alloy',
        responseFormat: 'wav',
      });
    } else {
      throw new Error(`Unsupported TTS provider: ${provider}`);
    }
  }

  private setupProgressTracking() {
    this.progressTracker.on('progress', (update) => {
      this.emit('progress', update);
    });
  }
}