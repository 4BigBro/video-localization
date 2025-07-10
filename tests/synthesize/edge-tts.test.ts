import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdgeTTS } from '../../src/synthesize/edge-tts.js';
import * as fileUtils from '../../src/utils/file-utils.js';

vi.mock('../../src/utils/file-utils.js');
vi.mock('../../src/utils/logger.js');
vi.mock('child_process');

describe('EdgeTTS', () => {
  let edgeTTS: EdgeTTS;
  const mockEnsureDirectoryExists = vi.mocked(fileUtils.ensureDirectoryExists);

  beforeEach(() => {
    vi.resetAllMocks();
    edgeTTS = new EdgeTTS();
    mockEnsureDirectoryExists.mockResolvedValue(undefined);
  });

  describe('synthesizeText', () => {
    it('should throw error for empty text', async () => {
      await expect(edgeTTS.synthesizeText('', '/output/test.wav'))
        .rejects
        .toThrow('Text cannot be empty');
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(edgeTTS.synthesizeText('   ', '/output/test.wav'))
        .rejects
        .toThrow('Text cannot be empty');
    });

    it('should create output directory', async () => {
      // Mock successful execution
      const mockSpawn = vi.fn().mockImplementation(() => ({
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      }));
      
      vi.doMock('child_process', () => ({ spawn: mockSpawn }));

      await edgeTTS.synthesizeText('Hello world', '/output/test.wav');
      
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith('/output');
    });

    it('should use default voice and settings', async () => {
      const result = await edgeTTS.synthesizeText('Hello world', '/output/test.wav');
      
      expect(result).toBeTypeOf('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should use custom voice and settings', async () => {
      const options = {
        voice: 'zh-CN-YunxiNeural',
        rate: '+20%',
        volume: '+10%',
        pitch: '+5Hz',
        outputFormat: 'mp3' as const,
      };
      
      const result = await edgeTTS.synthesizeText('Hello world', '/output/test.mp3', options);
      
      expect(result).toBeTypeOf('number');
    });
  });

  describe('synthesizeSegments', () => {
    const mockSegments = [
      { startTime: 0, endTime: 2, text: 'Hello' },
      { startTime: 2, endTime: 4, text: 'World' },
    ];

    it('should process all segments', async () => {
      const result = await edgeTTS.synthesizeSegments(mockSegments, '/output');
      
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello');
      expect(result[1].text).toBe('World');
      expect(result[0].audioPath).toContain('segment_0000.wav');
      expect(result[1].audioPath).toContain('segment_0001.wav');
    });

    it('should create output directory for segments', async () => {
      await edgeTTS.synthesizeSegments(mockSegments, '/output');
      
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith('/output');
    });

    it('should handle empty segments array', async () => {
      const result = await edgeTTS.synthesizeSegments([], '/output');
      
      expect(result).toHaveLength(0);
    });
  });

  describe('SSML generation', () => {
    it('should create valid SSML', () => {
      const edgeTTSInstance = new EdgeTTS();
      const ssml = (edgeTTSInstance as any).createSSML(
        'Hello world',
        'zh-CN-XiaoxiaoNeural',
        '+10%',
        '+5%',
        '+2Hz'
      );

      expect(ssml).toContain('<speak version="1.0"');
      expect(ssml).toContain('xmlns="http://www.w3.org/2001/10/synthesis"');
      expect(ssml).toContain('xml:lang="zh-CN"');
      expect(ssml).toContain('<voice name="zh-CN-XiaoxiaoNeural">');
      expect(ssml).toContain('<prosody rate="+10%" volume="+5%" pitch="+2Hz">');
      expect(ssml).toContain('Hello world');
    });

    it('should escape special XML characters', () => {
      const edgeTTSInstance = new EdgeTTS();
      const ssml = (edgeTTSInstance as any).createSSML(
        'Text with <special> & "quoted" characters',
        'zh-CN-XiaoxiaoNeural',
        '+0%',
        '+0%',
        '+0Hz'
      );

      expect(ssml).toContain('&lt;special&gt;');
      expect(ssml).toContain('&amp;');
      expect(ssml).toContain('&quot;quoted&quot;');
    });
  });

  describe('voice listing', () => {
    it('should parse voices list correctly', async () => {
      const mockOutput = `
Name: zh-CN-XiaoxiaoNeural
Name: zh-CN-YunxiNeural
Name: en-US-JennyNeural
      `;

      const edgeTTSInstance = new EdgeTTS();
      const voices = (edgeTTSInstance as any).parseVoicesList(mockOutput);

      expect(voices).toEqual([
        'zh-CN-XiaoxiaoNeural',
        'zh-CN-YunxiNeural',
        'en-US-JennyNeural',
      ]);
    });

    it('should filter voices by language', async () => {
      const mockVoices = [
        'zh-CN-XiaoxiaoNeural',
        'zh-CN-YunxiNeural',
        'en-US-JennyNeural',
      ];

      // Mock the listVoices method to return predefined voices
      vi.spyOn(edgeTTS, 'listVoices').mockResolvedValue(mockVoices);

      const chineseVoices = await edgeTTS.listVoices('zh-CN');
      expect(chineseVoices).toEqual([
        'zh-CN-XiaoxiaoNeural',
        'zh-CN-YunxiNeural',
      ]);
    });
  });
});