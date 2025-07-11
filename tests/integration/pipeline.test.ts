import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoLocalizationPipeline } from '../../src/cli/pipeline.js';
import * as fileUtils from '../../src/utils/file-utils.js';

vi.mock('../../src/utils/file-utils.js');
vi.mock('../../src/utils/logger.js');
vi.mock('../../src/cli/config.js');

describe('VideoLocalizationPipeline Integration', () => {
  let pipeline: VideoLocalizationPipeline;
  const mockFileExists = vi.mocked(fileUtils.fileExists);
  const mockEnsureDirectoryExists = vi.mocked(fileUtils.ensureDirectoryExists);

  beforeEach(() => {
    vi.resetAllMocks();
    pipeline = new VideoLocalizationPipeline();
    mockFileExists.mockResolvedValue(true);
    mockEnsureDirectoryExists.mockResolvedValue(undefined);
    
    // Mock config loading
    vi.doMock('../../src/cli/config.js', () => ({
      loadConfig: vi.fn().mockResolvedValue({
        apiKeys: {
          openai: 'test-openai-key',
          deepl: 'test-deepl-key',
        },
        defaults: {
          ttsProvider: 'edge',
          transcriptionProvider: 'whisper',
          translationProvider: 'openai',
          audioQuality: 'high',
        },
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('process', () => {
    const mockOptions = {
      inputVideo: '/input/test.mp4',
      outputVideo: '/output/test_localized.mp4',
      targetLanguage: 'Chinese',
      ttsProvider: 'edge' as const,
      transcriptionProvider: 'whisper' as const,
      translationProvider: 'openai' as const,
      keepIntermediateFiles: false,
      audioQuality: 'high' as const,
    };

    it('should emit progress events during processing', async () => {
      const progressEvents: any[] = [];
      const stageCompleteEvents: string[] = [];

      pipeline.on('progress', (update) => {
        progressEvents.push(update);
      });

      pipeline.on('stage-complete', (stage) => {
        stageCompleteEvents.push(stage);
      });

      // Mock all the processing stages to succeed quickly
      vi.mock('../../src/extract/index.js', () => ({
        AudioExtractor: vi.fn().mockImplementation(() => ({
          extractAudio: vi.fn().mockResolvedValue({
            path: '/temp/audio.wav',
            duration: 120,
            format: 'wav',
            sampleRate: 16000,
            channels: 1,
          }),
        })),
      }));

      await pipeline.process(mockOptions);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(stageCompleteEvents).toContain('Audio Extraction');
    });

    it('should handle processing errors gracefully', async () => {
      // Mock audio extraction to fail
      vi.doMock('../../src/extract/index.js', () => ({
        AudioExtractor: vi.fn().mockImplementation(() => ({
          extractAudio: vi.fn().mockRejectedValue(new Error('FFmpeg not found')),
        })),
      }));

      const result = await pipeline.process(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('FFmpeg not found');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should validate configuration for required API keys', async () => {
      // Mock config without required API keys
      vi.doMock('../../src/cli/config.js', () => ({
        loadConfig: vi.fn().mockResolvedValue({
          apiKeys: {},
          defaults: {
            translationProvider: 'openai',
          },
        }),
      }));

      const result = await pipeline.process(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API key not configured');
    });

    it('should support different provider combinations', async () => {
      const edgeOptions = {
        ...mockOptions,
        ttsProvider: 'edge' as const,
        transcriptionProvider: 'whisper' as const,
        translationProvider: 'openai' as const,
      };

      // Should not throw configuration errors
      const result = await pipeline.process(edgeOptions);
      
      // Even if processing fails due to missing tools, configuration should be valid
      expect(result.error).not.toContain('API key not configured');
    });
  });

  describe('stage processing', () => {
    it('should perform transcription with whisper', async () => {
      const audioFile = {
        path: '/temp/audio.wav',
        duration: 120,
        format: 'wav',
        sampleRate: 16000,
        channels: 1,
      };

      const mockOptions = {
        transcriptionProvider: 'whisper' as const,
      };

      // Mock successful transcription
      vi.doMock('../../src/transcribe/index.js', () => ({
        WhisperTranscriber: vi.fn().mockImplementation(() => ({
          transcribe: vi.fn().mockResolvedValue({
            segments: [
              { startTime: 0, endTime: 2, text: 'Hello world' },
              { startTime: 2, endTime: 4, text: 'How are you' },
            ],
            language: 'en',
            confidence: 0.95,
          }),
        })),
      }));

      const result = await (pipeline as any).performTranscription(audioFile, mockOptions);

      expect(result.segments).toHaveLength(2);
      expect(result.language).toBe('en');
      expect(result.confidence).toBe(0.95);
    });

    it('should perform translation with openai', async () => {
      const segments = [
        { startTime: 0, endTime: 2, text: 'Hello world' },
        { startTime: 2, endTime: 4, text: 'How are you' },
      ];

      const mockOptions = {
        translationProvider: 'openai' as const,
        targetLanguage: 'Chinese',
      };

      // Mock successful translation
      vi.doMock('../../src/translate/index.js', () => ({
        OpenAITranslator: vi.fn().mockImplementation(() => ({
          translateSegments: vi.fn().mockResolvedValue([
            { startTime: 0, endTime: 2, text: '你好世界' },
            { startTime: 2, endTime: 4, text: '你好吗' },
          ]),
        })),
      }));

      const result = await (pipeline as any).performTranslation(segments, mockOptions);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('你好世界');
      expect(result[1].text).toBe('你好吗');
    });

    it('should perform voice synthesis with edge tts', async () => {
      const segments = [
        { startTime: 0, endTime: 2, text: '你好世界' },
        { startTime: 2, endTime: 4, text: '你好吗' },
      ];

      const mockOptions = {
        ttsProvider: 'edge' as const,
      };

      // Mock successful TTS
      vi.doMock('../../src/synthesize/index.js', () => ({
        EdgeTTS: vi.fn().mockImplementation(() => ({
          synthesizeSegments: vi.fn().mockResolvedValue([
            { audioPath: '/temp/segment_0000.wav', duration: 2, text: '你好世界' },
            { audioPath: '/temp/segment_0001.wav', duration: 2, text: '你好吗' },
          ]),
        })),
      }));

      const result = await (pipeline as any).performVoiceSynthesis(
        segments,
        '/temp/tts',
        mockOptions
      );

      expect(result).toHaveLength(2);
      expect(result[0].audioPath).toBe('/temp/segment_0000.wav');
      expect(result[1].audioPath).toBe('/temp/segment_0001.wav');
    });
  });

  describe('error scenarios', () => {
    it('should handle unsupported transcription provider', async () => {
      const audioFile = { path: '/temp/audio.wav' };
      const mockOptions = { transcriptionProvider: 'unsupported' as any };

      await expect((pipeline as any).performTranscription(audioFile, mockOptions))
        .rejects
        .toThrow('Unsupported transcription provider: unsupported');
    });

    it('should handle unsupported translation provider', async () => {
      const segments = [{ startTime: 0, endTime: 2, text: 'Hello' }];
      const mockOptions = { translationProvider: 'unsupported' as any };

      await expect((pipeline as any).performTranslation(segments, mockOptions))
        .rejects
        .toThrow('Unsupported translation provider: unsupported');
    });

    it('should handle unsupported TTS provider', async () => {
      const segments = [{ startTime: 0, endTime: 2, text: '你好' }];
      const mockOptions = { ttsProvider: 'unsupported' as any };

      await expect((pipeline as any).performVoiceSynthesis(segments, '/temp', mockOptions))
        .rejects
        .toThrow('Unsupported TTS provider: unsupported');
    });
  });
});