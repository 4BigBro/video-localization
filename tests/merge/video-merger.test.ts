import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoMerger } from '../../src/merge/video-merger.js';
import * as fileUtils from '../../src/utils/file-utils.js';

vi.mock('../../src/utils/file-utils.js');
vi.mock('../../src/utils/logger.js');
vi.mock('child_process');
vi.mock('fs/promises');

describe('VideoMerger', () => {
  let videoMerger: VideoMerger;
  const mockEnsureDirectoryExists = vi.mocked(fileUtils.ensureDirectoryExists);
  const mockCleanupFiles = vi.mocked(fileUtils.cleanupFiles);

  beforeEach(() => {
    vi.resetAllMocks();
    videoMerger = new VideoMerger();
    mockEnsureDirectoryExists.mockResolvedValue(undefined);
    mockCleanupFiles.mockResolvedValue(undefined);
  });

  describe('mergeVideoWithAudio', () => {
    const mockTTSResults = [
      { audioPath: '/audio/segment_0000.wav', duration: 2.5, text: 'Hello' },
      { audioPath: '/audio/segment_0001.wav', duration: 3.0, text: 'World' },
    ];

    const mockSegments = [
      { startTime: 0, endTime: 2.5, text: 'Hello' },
      { startTime: 2.5, endTime: 5.5, text: 'World' },
    ];

    it('should return success result for successful merge', async () => {
      // Mock successful FFmpeg execution
      const mockSpawn = vi.fn().mockImplementation(() => ({
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      }));
      
      vi.doMock('child_process', () => ({ spawn: mockSpawn }));

      const result = await videoMerger.mergeVideoWithAudio(
        '/input/video.mp4',
        mockTTSResults,
        mockSegments,
        '/output/video.mp4'
      );

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/output/video.mp4');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should validate TTS results and segments count match', async () => {
      const mismatchedSegments = [mockSegments[0]]; // Only one segment

      const result = await videoMerger.mergeVideoWithAudio(
        '/input/video.mp4',
        mockTTSResults, // Two TTS results
        mismatchedSegments, // One segment
        '/output/video.mp4'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('TTS results and segments count mismatch');
    });

    it('should handle FFmpeg errors gracefully', async () => {
      // Mock FFmpeg failure
      const mockSpawn = vi.fn().mockImplementation(() => ({
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10); // Exit code 1 = error
          }
        }),
      }));
      
      vi.doMock('child_process', () => ({ spawn: mockSpawn }));

      const result = await videoMerger.mergeVideoWithAudio(
        '/input/video.mp4',
        mockTTSResults,
        mockSegments,
        '/output/video.mp4'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should clean up intermediate files by default', async () => {
      await videoMerger.mergeVideoWithAudio(
        '/input/video.mp4',
        mockTTSResults,
        mockSegments,
        '/output/video.mp4'
      );

      expect(mockCleanupFiles).toHaveBeenCalled();
    });

    it('should keep intermediate files when requested', async () => {
      const result = await videoMerger.mergeVideoWithAudio(
        '/input/video.mp4',
        mockTTSResults,
        mockSegments,
        '/output/video.mp4',
        { keepIntermediateFiles: true }
      );

      expect(result.intermediateFiles).toBeDefined();
      expect(result.intermediateFiles.length).toBeGreaterThan(0);
    });
  });

  describe('subtitle generation', () => {
    const mockSegments = [
      { startTime: 0, endTime: 2.5, text: 'Hello world' },
      { startTime: 3.0, endTime: 5.5, text: 'This is a test' },
    ];

    it('should generate ASS subtitle format', () => {
      const videoMergerInstance = new VideoMerger();
      const ass = (videoMergerInstance as any).generateASSSubtitles(mockSegments);

      expect(ass).toContain('[Script Info]');
      expect(ass).toContain('[V4+ Styles]');
      expect(ass).toContain('[Events]');
      expect(ass).toContain('Hello world');
      expect(ass).toContain('This is a test');
    });

    it('should format ASS time correctly', () => {
      const videoMergerInstance = new VideoMerger();
      const formatTime = (videoMergerInstance as any).formatASSTime;

      expect(formatTime(65.5)).toBe('1:01:05.50');
      expect(formatTime(3661.25)).toBe('1:01:01.25');
      expect(formatTime(0)).toBe('0:00:00.00');
    });

    it('should apply custom subtitle styles', () => {
      const videoMergerInstance = new VideoMerger();
      const customStyle = {
        fontName: 'SimHei',
        fontSize: 24,
        primaryColor: '&H00FF0000',
        bold: true,
      };

      const ass = (videoMergerInstance as any).generateASSSubtitles(mockSegments, customStyle);

      expect(ass).toContain('SimHei');
      expect(ass).toContain('24');
      expect(ass).toContain('&H00FF0000');
      expect(ass).toContain(',1,'); // Bold = 1
    });

    it('should escape special characters in subtitle text', () => {
      const segmentsWithSpecialChars = [
        { startTime: 0, endTime: 2, text: 'Line 1\nLine 2' },
      ];

      const videoMergerInstance = new VideoMerger();
      const ass = (videoMergerInstance as any).generateASSSubtitles(segmentsWithSpecialChars);

      expect(ass).toContain('Line 1\\NLine 2');
    });
  });

  describe('audio filter complex', () => {
    const mockTTSResults = [
      { audioPath: '/audio/1.wav', duration: 2, text: 'First' },
      { audioPath: '/audio/2.wav', duration: 3, text: 'Second' },
    ];

    const mockSegments = [
      { startTime: 0, endTime: 2, text: 'First' },
      { startTime: 5, endTime: 8, text: 'Second' }, // 5 second delay
    ];

    it('should build correct filter complex for audio timing', () => {
      const videoMergerInstance = new VideoMerger();
      const filterComplex = (videoMergerInstance as any).buildAudioFilterComplex(
        mockTTSResults,
        mockSegments
      );

      expect(filterComplex).toContain('adelay=5000|5000'); // 5 second delay in milliseconds
      expect(filterComplex).toContain('amix=inputs=2');
    });

    it('should handle segments without delay', () => {
      const segmentsNoDelay = [
        { startTime: 0, endTime: 2, text: 'First' },
        { startTime: 2, endTime: 5, text: 'Second' },
      ];

      const videoMergerInstance = new VideoMerger();
      const filterComplex = (videoMergerInstance as any).buildAudioFilterComplex(
        mockTTSResults,
        segmentsNoDelay
      );

      expect(filterComplex).not.toContain('adelay');
      expect(filterComplex).toContain('amix=inputs=2');
    });
  });

  describe('quality settings', () => {
    it('should return high quality settings', () => {
      const videoMergerInstance = new VideoMerger();
      const settings = (videoMergerInstance as any).getQualitySettings('high');

      expect(settings.video).toContain('-crf');
      expect(settings.video).toContain('18');
      expect(settings.audio).toContain('192k');
    });

    it('should return medium quality settings', () => {
      const videoMergerInstance = new VideoMerger();
      const settings = (videoMergerInstance as any).getQualitySettings('medium');

      expect(settings.video).toContain('23');
      expect(settings.audio).toContain('128k');
    });

    it('should return low quality settings', () => {
      const videoMergerInstance = new VideoMerger();
      const settings = (videoMergerInstance as any).getQualitySettings('low');

      expect(settings.video).toContain('28');
      expect(settings.audio).toContain('96k');
    });

    it('should default to medium quality for unknown settings', () => {
      const videoMergerInstance = new VideoMerger();
      const settings = (videoMergerInstance as any).getQualitySettings('unknown');

      expect(settings.video).toContain('23');
      expect(settings.audio).toContain('128k');
    });
  });
});