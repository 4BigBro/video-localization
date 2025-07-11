export interface VideoFile {
  path: string;
  duration: number;
  format: string;
  size: number;
}

export interface AudioFile {
  path: string;
  duration: number;
  format: string;
  sampleRate: number;
  channels: number;
}

export interface SubtitleSegment {
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

export interface TranscriptionResult {
  segments: SubtitleSegment[];
  language: string;
  confidence: number;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  confidence: number;
}

export interface TTSResult {
  audioPath: string;
  duration: number;
  text: string;
}

export interface ProcessingOptions {
  inputVideo: string;
  outputVideo: string;
  targetLanguage: string;
  ttsProvider: 'edge' | 'openai';
  transcriptionProvider: 'whisper' | 'openai';
  translationProvider: 'openai' | 'deepl';
  keepIntermediateFiles: boolean;
  audioQuality: 'high' | 'medium' | 'low';
}

export interface ProcessingResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  processingTime: number;
  intermediateFiles: string[];
}