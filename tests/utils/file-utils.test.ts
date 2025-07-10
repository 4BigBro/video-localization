import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fileUtils from '../../src/utils/file-utils.js';
import * as fs from 'fs/promises';

vi.mock('fs/promises');
vi.mock('../../src/utils/logger.js');

describe('file-utils', () => {
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await fileUtils.ensureDirectoryExists('/test/directory');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/directory', { recursive: true });
    });

    it('should handle directory creation errors', async () => {
      const error = new Error('Permission denied');
      mockFs.mkdir.mockRejectedValue(error);

      await expect(fileUtils.ensureDirectoryExists('/test/directory'))
        .rejects
        .toThrow('Permission denied');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const exists = await fileUtils.fileExists('/test/file.txt');

      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false if file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const exists = await fileUtils.fileExists('/test/nonexistent.txt');

      expect(exists).toBe(false);
    });
  });

  describe('getFileSize', () => {
    it('should return file size', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);

      const size = await fileUtils.getFileSize('/test/file.txt');

      expect(size).toBe(1024);
      expect(mockFs.stat).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should handle stat errors', async () => {
      const error = new Error('File not found');
      mockFs.stat.mockRejectedValue(error);

      await expect(fileUtils.getFileSize('/test/nonexistent.txt'))
        .rejects
        .toThrow('File not found');
    });
  });

  describe('getTempPath', () => {
    it('should generate temp path with suffix', () => {
      const tempPath = fileUtils.getTempPath('/input/video.mp4', 'temp');

      expect(tempPath).toBe('/input/video_temp.mp4');
    });

    it('should handle paths without extension', () => {
      const tempPath = fileUtils.getTempPath('/input/video', 'temp');

      expect(tempPath).toBe('/input/video_temp');
    });

    it('should handle nested directories', () => {
      const tempPath = fileUtils.getTempPath('/path/to/deep/video.mp4', 'processed');

      expect(tempPath).toBe('/path/to/deep/video_processed.mp4');
    });
  });

  describe('getOutputPath', () => {
    it('should generate output path with suffix', () => {
      const outputPath = fileUtils.getOutputPath('/input/video.mp4', 'output');

      expect(outputPath).toBe('/input/video_output.mp4');
    });

    it('should use new extension when provided', () => {
      const outputPath = fileUtils.getOutputPath('/input/video.mp4', 'audio', '.wav');

      expect(outputPath).toBe('/input/video_audio.wav');
    });

    it('should handle files without extension', () => {
      const outputPath = fileUtils.getOutputPath('/input/video', 'converted', '.mp4');

      expect(outputPath).toBe('/input/video_converted.mp4');
    });
  });

  describe('cleanupFiles', () => {
    it('should delete existing files', async () => {
      mockFs.unlink.mockResolvedValue(undefined);
      vi.spyOn(fileUtils, 'fileExists').mockResolvedValue(true);

      await fileUtils.cleanupFiles(['/temp/file1.txt', '/temp/file2.txt']);

      expect(mockFs.unlink).toHaveBeenCalledTimes(2);
      expect(mockFs.unlink).toHaveBeenCalledWith('/temp/file1.txt');
      expect(mockFs.unlink).toHaveBeenCalledWith('/temp/file2.txt');
    });

    it('should skip non-existent files', async () => {
      vi.spyOn(fileUtils, 'fileExists')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await fileUtils.cleanupFiles(['/temp/exists.txt', '/temp/missing.txt']);

      expect(mockFs.unlink).toHaveBeenCalledTimes(1);
      expect(mockFs.unlink).toHaveBeenCalledWith('/temp/exists.txt');
    });

    it('should handle deletion errors gracefully', async () => {
      const error = new Error('Permission denied');
      mockFs.unlink.mockRejectedValue(error);
      vi.spyOn(fileUtils, 'fileExists').mockResolvedValue(true);

      // Should not throw error
      await expect(fileUtils.cleanupFiles(['/temp/file.txt']))
        .resolves
        .toBeUndefined();
    });

    it('should handle empty file list', async () => {
      await fileUtils.cleanupFiles([]);

      expect(mockFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('validateVideoFile', () => {
    it('should return true for valid video extensions', () => {
      expect(fileUtils.validateVideoFile('/test/video.mp4')).toBe(true);
      expect(fileUtils.validateVideoFile('/test/video.avi')).toBe(true);
      expect(fileUtils.validateVideoFile('/test/video.mov')).toBe(true);
      expect(fileUtils.validateVideoFile('/test/video.mkv')).toBe(true);
      expect(fileUtils.validateVideoFile('/test/video.webm')).toBe(true);
    });

    it('should return false for invalid extensions', () => {
      expect(fileUtils.validateVideoFile('/test/audio.mp3')).toBe(false);
      expect(fileUtils.validateVideoFile('/test/image.jpg')).toBe(false);
      expect(fileUtils.validateVideoFile('/test/document.pdf')).toBe(false);
      expect(fileUtils.validateVideoFile('/test/file')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(fileUtils.validateVideoFile('/test/video.MP4')).toBe(true);
      expect(fileUtils.validateVideoFile('/test/video.AVI')).toBe(true);
      expect(fileUtils.validateVideoFile('/test/video.MkV')).toBe(true);
    });
  });

  describe('validateAudioFile', () => {
    it('should return true for valid audio extensions', () => {
      expect(fileUtils.validateAudioFile('/test/audio.mp3')).toBe(true);
      expect(fileUtils.validateAudioFile('/test/audio.wav')).toBe(true);
      expect(fileUtils.validateAudioFile('/test/audio.m4a')).toBe(true);
      expect(fileUtils.validateAudioFile('/test/audio.aac')).toBe(true);
      expect(fileUtils.validateAudioFile('/test/audio.flac')).toBe(true);
    });

    it('should return false for invalid extensions', () => {
      expect(fileUtils.validateAudioFile('/test/video.mp4')).toBe(false);
      expect(fileUtils.validateAudioFile('/test/image.jpg')).toBe(false);
      expect(fileUtils.validateAudioFile('/test/document.pdf')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(fileUtils.validateAudioFile('/test/audio.MP3')).toBe(true);
      expect(fileUtils.validateAudioFile('/test/audio.WAV')).toBe(true);
      expect(fileUtils.validateAudioFile('/test/audio.M4A')).toBe(true);
    });
  });
});