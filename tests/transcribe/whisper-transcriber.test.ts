import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhisperTranscriber } from '../../src/transcribe/whisper-transcriber.js';
import * as fileUtils from '../../src/utils/file-utils.js';

vi.mock('../../src/utils/file-utils.js');
vi.mock('../../src/utils/logger.js');

describe('WhisperTranscriber', () => {
  let transcriber: WhisperTranscriber;
  const mockFileExists = vi.mocked(fileUtils.fileExists);
  const mockEnsureDirectoryExists = vi.mocked(fileUtils.ensureDirectoryExists);

  beforeEach(() => {
    vi.resetAllMocks();
    transcriber = new WhisperTranscriber();
    mockFileExists.mockResolvedValue(true);
    mockEnsureDirectoryExists.mockResolvedValue(undefined);
  });

  describe('transcribe', () => {
    const mockAudioFile = {
      path: '/test/audio.wav',
      duration: 120,
      format: 'wav',
      sampleRate: 16000,
      channels: 1,
    };

    it('should throw error if audio file does not exist', async () => {
      mockFileExists.mockResolvedValue(false);
      
      await expect(transcriber.transcribe(mockAudioFile))
        .rejects
        .toThrow('Audio file not found: /test/audio.wav');
    });

    it('should use default options when none provided', async () => {
      const result = await transcriber.transcribe(mockAudioFile);
      
      expect(result).toEqual({
        segments: expect.any(Array),
        language: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it('should create transcription output directory', async () => {
      await transcriber.transcribe(mockAudioFile);
      
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith('/test/transcription');
    });

    it('should handle different whisper models', async () => {
      const options = {
        model: 'large' as const,
        language: 'en',
        outputFormat: 'json' as const,
      };
      
      const result = await transcriber.transcribe(mockAudioFile, options);
      
      expect(result.segments).toBeDefined();
      expect(result.language).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('time parsing', () => {
    it('should parse SRT time format correctly', () => {
      const transcriber = new WhisperTranscriber();
      // Access private method for testing
      const parseTimeString = (transcriber as any).parseTimeString.bind(transcriber);
      
      const result = parseTimeString('00:01:30,500');
      expect(result).toBe(90.5); // 1 minute 30.5 seconds
    });

    it('should parse VTT time format correctly', () => {
      const transcriber = new WhisperTranscriber();
      const parseTimeString = (transcriber as any).parseTimeString.bind(transcriber);
      
      const result = parseTimeString('00:01:30.500');
      expect(result).toBe(90.5); // 1 minute 30.5 seconds
    });
  });
});