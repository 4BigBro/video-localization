import { promises as fs } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { logger } from './logger.js';

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    logger.error(`Failed to create directory: ${dirPath}`, error);
    throw error;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    logger.error(`Failed to get file size: ${filePath}`, error);
    throw error;
  }
}

export function getTempPath(originalPath: string, suffix: string): string {
  const dir = dirname(originalPath);
  const name = basename(originalPath, extname(originalPath));
  const ext = extname(originalPath);
  return join(dir, `${name}_${suffix}${ext}`);
}

export function getOutputPath(inputPath: string, suffix: string, newExtension?: string): string {
  const dir = dirname(inputPath);
  const name = basename(inputPath, extname(inputPath));
  const ext = newExtension || extname(inputPath);
  return join(dir, `${name}_${suffix}${ext}`);
}

export async function cleanupFiles(filePaths: string[]): Promise<void> {
  const cleanup = filePaths.map(async (filePath) => {
    try {
      if (await fileExists(filePath)) {
        await fs.unlink(filePath);
        logger.debug(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup file: ${filePath}`, error);
    }
  });
  
  await Promise.all(cleanup);
}

export function validateVideoFile(filePath: string): boolean {
  const validExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
  const ext = extname(filePath).toLowerCase();
  return validExtensions.includes(ext);
}

export function validateAudioFile(filePath: string): boolean {
  const validExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'];
  const ext = extname(filePath).toLowerCase();
  return validExtensions.includes(ext);
}