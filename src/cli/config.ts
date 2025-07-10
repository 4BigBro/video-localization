import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/file-utils.js';

export interface Config {
  apiKeys: {
    claude?: string;
    openai?: string;
    deepl?: string;
  };
  defaults: {
    ttsProvider: 'edge' | 'openai';
    transcriptionProvider: 'whisper' | 'openai';
    translationProvider: 'claude' | 'openai' | 'deepl';
    audioQuality: 'high' | 'medium' | 'low';
  };
  ffmpeg: {
    path?: string;
    timeout: number;
  };
  whisper: {
    path?: string;
    model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  };
  edgeTts: {
    defaultVoice: string;
    rate: string;
    volume: string;
    pitch: string;
  };
}

const DEFAULT_CONFIG: Config = {
  apiKeys: {},
  defaults: {
    ttsProvider: 'edge',
    transcriptionProvider: 'whisper',
    translationProvider: 'claude',
    audioQuality: 'high',
  },
  ffmpeg: {
    timeout: 300000, // 5 minutes
  },
  whisper: {
    model: 'base',
  },
  edgeTts: {
    defaultVoice: 'zh-CN-XiaoxiaoNeural',
    rate: '+0%',
    volume: '+0%',
    pitch: '+0Hz',
  },
};

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();
  
  try {
    if (await fileExists(configPath)) {
      const configData = await fs.readFile(configPath, 'utf8');
      const userConfig = JSON.parse(configData);
      
      // Merge with defaults
      const config = mergeConfig(DEFAULT_CONFIG, userConfig);
      
      // Load environment variables
      loadEnvironmentVariables(config);
      
      logger.debug(`Configuration loaded from ${configPath}`);
      return config;
    } else {
      logger.info('No configuration file found, using defaults');
      const config = { ...DEFAULT_CONFIG };
      loadEnvironmentVariables(config);
      return config;
    }
  } catch (error) {
    logger.warn(`Failed to load configuration: ${error}`);
    const config = { ...DEFAULT_CONFIG };
    loadEnvironmentVariables(config);
    return config;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();
  const configDir = join(configPath, '..');
  
  try {
    // Ensure config directory exists
    await fs.mkdir(configDir, { recursive: true });
    
    // Save configuration
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    logger.info(`Configuration saved to ${configPath}`);
  } catch (error) {
    logger.error(`Failed to save configuration: ${error}`);
    throw error;
  }
}

export function getConfigPath(): string {
  return join(homedir(), '.video-localize', 'config.json');
}

function mergeConfig(defaultConfig: Config, userConfig: any): Config {
  return {
    apiKeys: {
      ...defaultConfig.apiKeys,
      ...userConfig.apiKeys,
    },
    defaults: {
      ...defaultConfig.defaults,
      ...userConfig.defaults,
    },
    ffmpeg: {
      ...defaultConfig.ffmpeg,
      ...userConfig.ffmpeg,
    },
    whisper: {
      ...defaultConfig.whisper,
      ...userConfig.whisper,
    },
    edgeTts: {
      ...defaultConfig.edgeTts,
      ...userConfig.edgeTts,
    },
  };
}

function loadEnvironmentVariables(config: Config): void {
  // Load API keys from environment variables
  if (process.env.CLAUDE_API_KEY) {
    config.apiKeys.claude = process.env.CLAUDE_API_KEY;
  }
  
  if (process.env.OPENAI_API_KEY) {
    config.apiKeys.openai = process.env.OPENAI_API_KEY;
  }
  
  if (process.env.DEEPL_API_KEY) {
    config.apiKeys.deepl = process.env.DEEPL_API_KEY;
  }
  
  // Load other settings from environment
  if (process.env.FFMPEG_PATH) {
    config.ffmpeg.path = process.env.FFMPEG_PATH;
  }
  
  if (process.env.WHISPER_PATH) {
    config.whisper.path = process.env.WHISPER_PATH;
  }
  
  if (process.env.WHISPER_MODEL) {
    config.whisper.model = process.env.WHISPER_MODEL as any;
  }
  
  if (process.env.EDGE_TTS_VOICE) {
    config.edgeTts.defaultVoice = process.env.EDGE_TTS_VOICE;
  }
}

export async function validateConfig(config: Config): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // Check for required tools
  const requiredTools = [
    { name: 'ffmpeg', path: config.ffmpeg.path || 'ffmpeg' },
    { name: 'ffprobe', path: 'ffprobe' },
  ];
  
  if (config.defaults.transcriptionProvider === 'whisper') {
    requiredTools.push({ name: 'whisper', path: config.whisper.path || 'whisper' });
  }
  
  if (config.defaults.ttsProvider === 'edge') {
    requiredTools.push({ name: 'edge-tts', path: 'edge-tts' });
  }
  
  for (const tool of requiredTools) {
    try {
      const { spawn } = await import('child_process');
      await new Promise<void>((resolve, reject) => {
        const process = spawn(tool.path, ['--version'], { stdio: 'pipe' });
        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Command failed with code ${code}`));
          }
        });
        process.on('error', reject);
      });
    } catch (error) {
      errors.push(`${tool.name} is not available at path: ${tool.path}`);
    }
  }
  
  // Check API keys
  if (config.defaults.translationProvider === 'claude' && !config.apiKeys.claude) {
    errors.push('Claude API key is required for translation');
  }
  
  if (config.defaults.translationProvider === 'openai' && !config.apiKeys.openai) {
    errors.push('OpenAI API key is required for translation');
  }
  
  if (config.defaults.translationProvider === 'deepl' && !config.apiKeys.deepl) {
    errors.push('DeepL API key is required for translation');
  }
  
  if (config.defaults.transcriptionProvider === 'openai' && !config.apiKeys.openai) {
    errors.push('OpenAI API key is required for transcription');
  }
  
  if (config.defaults.ttsProvider === 'openai' && !config.apiKeys.openai) {
    errors.push('OpenAI API key is required for TTS');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}