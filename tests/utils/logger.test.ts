import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel } from '../../src/utils/logger.js';
import * as fs from 'fs';

vi.mock('fs');

describe('Logger', () => {
  let logger: Logger;
  const mockCreateWriteStream = vi.mocked(fs.createWriteStream);
  const mockExistsSync = vi.mocked(fs.existsSync);
  const mockMkdirSync = vi.mocked(fs.mkdirSync);
  const mockConsoleLog = vi.spyOn(console, 'log');

  beforeEach(() => {
    vi.resetAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockCreateWriteStream.mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
    } as any);

    // Reset singleton instance
    (Logger as any).instance = undefined;
    logger = Logger.getInstance();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const logger1 = Logger.getInstance();
      const logger2 = Logger.getInstance();
      
      expect(logger1).toBe(logger2);
    });
  });

  describe('log level filtering', () => {
    it('should not log debug messages when level is INFO', () => {
      logger.setLogLevel(LogLevel.INFO);
      
      logger.debug('Debug message');
      
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should log info messages when level is INFO', () => {
      logger.setLogLevel(LogLevel.INFO);
      
      logger.info('Info message');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Info message')
      );
    });

    it('should log all messages when level is DEBUG', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(4);
    });

    it('should only log errors when level is ERROR', () => {
      logger.setLogLevel(LogLevel.ERROR);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Error message')
      );
    });
  });

  describe('log formatting', () => {
    it('should include timestamp in log messages', () => {
      logger.info('Test message');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test message/)
      );
    });

    it('should include log level in messages', () => {
      logger.warn('Warning message');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Warning message')
      );
    });

    it('should handle additional arguments', () => {
      const obj = { key: 'value' };
      logger.info('Message with object', obj);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Message with object'),
        obj
      );
    });
  });

  describe('file logging', () => {
    it('should create logs directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      
      Logger.getInstance();
      
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );
    });

    it('should write logs to file', () => {
      const mockWrite = vi.fn();
      mockCreateWriteStream.mockReturnValue({
        write: mockWrite,
        end: vi.fn(),
      } as any);

      const newLogger = Logger.getInstance();
      newLogger.info('Test message');
      
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Test message')
      );
    });

    it('should close log stream when close is called', () => {
      const mockEnd = vi.fn();
      mockCreateWriteStream.mockReturnValue({
        write: vi.fn(),
        end: mockEnd,
      } as any);

      const newLogger = Logger.getInstance();
      newLogger.close();
      
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      logger.setLogLevel(LogLevel.DEBUG);
    });

    it('should provide error method', () => {
      logger.error('Error message');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Error message')
      );
    });

    it('should provide warn method', () => {
      logger.warn('Warning message');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Warning message')
      );
    });

    it('should provide info method', () => {
      logger.info('Info message');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Info message')
      );
    });

    it('should provide debug method', () => {
      logger.debug('Debug message');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: Debug message')
      );
    });
  });
});