import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeTranslator } from '../../src/translate/claude-translator.js';

vi.mock('../../src/utils/logger.js');

// Mock fetch globally
global.fetch = vi.fn();

describe('ClaudeTranslator', () => {
  let translator: ClaudeTranslator;
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    vi.resetAllMocks();
    translator = new ClaudeTranslator({
      apiKey: 'test-api-key',
    });
  });

  describe('translateText', () => {
    it('should translate text successfully', async () => {
      const mockResponse = {
        content: [{ text: '你好世界' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await translator.translateText('Hello world', 'Chinese');

      expect(result).toEqual({
        originalText: 'Hello world',
        translatedText: '你好世界',
        confidence: 0.9,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      } as Response);

      await expect(translator.translateText('Hello world'))
        .rejects
        .toThrow('Claude API error: 401 Unauthorized');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(translator.translateText('Hello world'))
        .rejects
        .toThrow('Network error');
    });
  });

  describe('translateSegments', () => {
    const mockSegments = [
      { startTime: 0, endTime: 2, text: 'Hello' },
      { startTime: 2, endTime: 4, text: 'World' },
    ];

    it('should translate segments in batches', async () => {
      const mockResponse = {
        content: [{ text: '你好\n---\n世界' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await translator.translateSegments(mockSegments, 'Chinese');

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('你好');
      expect(result[1].text).toBe('世界');
      expect(result[0].startTime).toBe(0);
      expect(result[1].endTime).toBe(4);
    });

    it('should handle large batches', async () => {
      const largeSegments = Array.from({ length: 25 }, (_, i) => ({
        startTime: i * 2,
        endTime: (i + 1) * 2,
        text: `Segment ${i + 1}`,
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: Array.from({ length: 10 }, (_, i) => `片段 ${i + 1}`).join('\n---\n') }],
        }),
      } as Response);

      const result = await translator.translateSegments(largeSegments, 'Chinese');

      expect(result).toHaveLength(25);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 25 segments / 10 batch size = 3 calls
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customTranslator = new ClaudeTranslator({
        apiKey: 'custom-key',
        model: 'claude-3-opus-20240229',
        maxTokens: 8192,
        temperature: 0.5,
        baseUrl: 'https://custom.api.com/v1',
      });

      expect(customTranslator['model']).toBe('claude-3-opus-20240229');
      expect(customTranslator['maxTokens']).toBe(8192);
      expect(customTranslator['temperature']).toBe(0.5);
      expect(customTranslator['baseUrl']).toBe('https://custom.api.com/v1');
    });
  });
});