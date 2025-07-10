import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioExtractor } from '../../src/extract/audio-extractor.js';
import * as fileUtils from '../../src/utils/file-utils.js';

vi.mock('../../src/utils/file-utils.js');
vi.mock('../../src/utils/logger.js');

describe('AudioExtractor', () => {
  let audioExtractor: AudioExtractor;
  const mockFileExists = vi.mocked(fileUtils.fileExists);
  const mockEnsureDirectoryExists = vi.mocked(fileUtils.ensureDirectoryExists);
  const mockGetOutputPath = vi.mocked(fileUtils.getOutputPath);

  beforeEach(() => {
    vi.resetAllMocks();
    audioExtractor = new AudioExtractor();
    mockFileExists.mockResolvedValue(true);
    mockEnsureDirectoryExists.mockResolvedValue(undefined);
    mockGetOutputPath.mockReturnValue('/output/test_audio.wav');
  });

  describe('extractAudio', () => {
    it('should throw error if video file does not exist', async () => {
      mockFileExists.mockResolvedValue(false);
      
      await expect(audioExtractor.extractAudio('/nonexistent/video.mp4'))
        .rejects
        .toThrow('Video file not found: /nonexistent/video.mp4');
    });

    it('should use default options when none provided', async () => {
      mockFileExists.mockResolvedValue(true);
      mockGetOutputPath.mockReturnValue('/output/test_audio.wav');
      
      const result = await audioExtractor.extractAudio('/input/video.mp4');
      
      expect(result).toEqual({
        path: '/output/test_audio.wav',
        duration: expect.any(Number),
        format: 'wav',
        sampleRate: 16000,
        channels: 1,
      });
    });

    it('should create output directory if it does not exist', async () => {
      await audioExtractor.extractAudio('/input/video.mp4');
      
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith('/output');
    });

    it('should handle different audio formats', async () => {
      const options = {
        format: 'mp3' as const,
        sampleRate: 44100,
        channels: 2,
        quality: 'high' as const,
      };
      
      mockGetOutputPath.mockReturnValue('/output/test_audio.mp3');
      
      const result = await audioExtractor.extractAudio('/input/video.mp4', undefined, options);
      
      expect(result.format).toBe('mp3');
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
    });
  });

  describe('getVideoInfo', () => {
    it('should throw error if video file does not exist', async () => {
      mockFileExists.mockResolvedValue(false);
      
      await expect(audioExtractor.getVideoInfo('/nonexistent/video.mp4'))
        .rejects
        .toThrow('Video file not found: /nonexistent/video.mp4');
    });

    it('should return video information', async () => {
      mockFileExists.mockResolvedValue(true);
      
      const result = await audioExtractor.getVideoInfo('/input/video.mp4');
      
      expect(result).toEqual({
        path: '/input/video.mp4',
        duration: expect.any(Number),
        format: expect.any(String),
        size: expect.any(Number),
      });
    });
  });
});