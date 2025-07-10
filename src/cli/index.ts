#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { VideoLocalizationPipeline } from './pipeline.js';
import { logger, LogLevel } from '../utils/logger.js';
import { fileExists, validateVideoFile } from '../utils/file-utils.js';
import { ProcessingOptions } from '../types/index.js';

const program = new Command();

program
  .name('video-localize')
  .description('Automated video localization pipeline for converting videos to Chinese')
  .version('1.0.0');

program
  .command('process')
  .description('Process a video file through the localization pipeline')
  .argument('<input>', 'Input video file path')
  .option('-o, --output <path>', 'Output video file path')
  .option('-l, --target-lang <lang>', 'Target language (default: Chinese)', 'Chinese')
  .option('--tts-provider <provider>', 'TTS provider: edge, openai', 'edge')
  .option('--transcription-provider <provider>', 'Transcription provider: whisper, openai', 'whisper')
  .option('--translation-provider <provider>', 'Translation provider: claude, openai, deepl', 'claude')
  .option('--audio-quality <quality>', 'Audio quality: high, medium, low', 'high')
  .option('--keep-files', 'Keep intermediate files', false)
  .option('--verbose', 'Enable verbose logging', false)
  .option('--config <path>', 'Configuration file path')
  .action(async (input, options) => {
    try {
      await processVideo(input, options);
    } catch (error) {
      console.error(chalk.red('❌ Processing failed:'), error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Configure API keys and settings')
  .option('--interactive', 'Interactive configuration setup', false)
  .action(async (options) => {
    try {
      await configureSettings(options.interactive);
    } catch (error) {
      console.error(chalk.red('❌ Configuration failed:'), error);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test system dependencies and API connections')
  .action(async () => {
    try {
      await testSystem();
    } catch (error) {
      console.error(chalk.red('❌ System test failed:'), error);
      process.exit(1);
    }
  });

program
  .command('list-voices')
  .description('List available TTS voices')
  .option('--provider <provider>', 'TTS provider: edge, openai', 'edge')
  .option('--language <lang>', 'Filter by language')
  .action(async (options) => {
    try {
      await listVoices(options.provider, options.language);
    } catch (error) {
      console.error(chalk.red('❌ Failed to list voices:'), error);
      process.exit(1);
    }
  });

async function processVideo(input: string, options: any) {
  // Setup logging
  if (options.verbose) {
    logger.setLogLevel(LogLevel.DEBUG);
  }

  console.log(chalk.blue('🎬 Video Localization Pipeline'));
  console.log(chalk.gray(`Input: ${input}`));

  // Validate input file
  if (!(await fileExists(input))) {
    throw new Error(`Input file not found: ${input}`);
  }

  if (!validateVideoFile(input)) {
    throw new Error(`Invalid video file format: ${input}`);
  }

  // Determine output path
  const output = options.output || input.replace(/\.[^/.]+$/, '_localized.mp4');
  console.log(chalk.gray(`Output: ${output}`));

  // Create processing options
  const processingOptions: ProcessingOptions = {
    inputVideo: input,
    outputVideo: output,
    targetLanguage: options.targetLang,
    ttsProvider: options.ttsProvider,
    transcriptionProvider: options.transcriptionProvider,
    translationProvider: options.translationProvider,
    keepIntermediateFiles: options.keepFiles,
    audioQuality: options.audioQuality as 'high' | 'medium' | 'low',
  };

  // Initialize pipeline
  const pipeline = new VideoLocalizationPipeline();

  // Setup progress tracking
  const spinner = ora('Initializing...').start();
  
  pipeline.on('progress', (update) => {
    spinner.text = `${update.stage}: ${update.message} (${Math.round(update.progress)}%)`;
  });

  pipeline.on('stage-complete', (stage) => {
    spinner.succeed(`✅ ${stage} completed`);
    spinner.start('Processing...');
  });

  try {
    // Process the video
    const result = await pipeline.process(processingOptions);

    spinner.stop();

    if (result.success) {
      console.log(chalk.green('🎉 Video localization completed successfully!'));
      console.log(chalk.gray(`Output file: ${result.outputPath}`));
      console.log(chalk.gray(`Processing time: ${Math.round(result.processingTime / 1000)}s`));
      
      if (result.intermediateFiles && result.intermediateFiles.length > 0) {
        console.log(chalk.gray(`Intermediate files: ${result.intermediateFiles.length}`));
      }
    } else {
      throw new Error(result.error || 'Unknown error occurred');
    }
  } catch (error) {
    spinner.fail('Processing failed');
    throw error;
  }
}

async function configureSettings(interactive: boolean) {
  console.log(chalk.blue('⚙️  Configuration Setup'));

  if (interactive) {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'claudeApiKey',
        message: 'Enter your Claude API key (optional):',
        mask: '*',
      },
      {
        type: 'password',
        name: 'openaiApiKey',
        message: 'Enter your OpenAI API key (optional):',
        mask: '*',
      },
      {
        type: 'password',
        name: 'deeplApiKey',
        message: 'Enter your DeepL API key (optional):',
        mask: '*',
      },
      {
        type: 'list',
        name: 'defaultTtsProvider',
        message: 'Choose default TTS provider:',
        choices: ['edge', 'openai'],
        default: 'edge',
      },
      {
        type: 'list',
        name: 'defaultTranscriptionProvider',
        message: 'Choose default transcription provider:',
        choices: ['whisper', 'openai'],
        default: 'whisper',
      },
      {
        type: 'list',
        name: 'defaultTranslationProvider',
        message: 'Choose default translation provider:',
        choices: ['claude', 'openai', 'deepl'],
        default: 'claude',
      },
    ]);

    // Save configuration
    const config = {
      apiKeys: {
        claude: answers.claudeApiKey || undefined,
        openai: answers.openaiApiKey || undefined,
        deepl: answers.deeplApiKey || undefined,
      },
      defaults: {
        ttsProvider: answers.defaultTtsProvider,
        transcriptionProvider: answers.defaultTranscriptionProvider,
        translationProvider: answers.defaultTranslationProvider,
      },
    };

    await saveConfig(config);
    console.log(chalk.green('✅ Configuration saved successfully!'));
  } else {
    console.log(chalk.yellow('Use --interactive flag for guided setup'));
    console.log(chalk.gray('Or manually edit the configuration file at: ~/.video-localize/config.json'));
  }
}

async function testSystem() {
  console.log(chalk.blue('🔧 System Dependency Test'));

  const tests = [
    { name: 'FFmpeg', command: 'ffmpeg -version' },
    { name: 'FFprobe', command: 'ffprobe -version' },
    { name: 'Edge-TTS', command: 'edge-tts --help' },
    { name: 'Whisper', command: 'whisper --help' },
  ];

  for (const test of tests) {
    const spinner = ora(`Testing ${test.name}...`).start();
    
    try {
      const { spawn } = await import('child_process');
      const [command, ...args] = test.command.split(' ');
      
      await new Promise<void>((resolve, reject) => {
        const process = spawn(command, args, { stdio: 'pipe' });
        
        process.on('close', (code) => {
          if (code === 0 || code === 1) { // Some tools return 1 for help
            resolve();
          } else {
            reject(new Error(`Command failed with code ${code}`));
          }
        });
        
        process.on('error', reject);
      });
      
      spinner.succeed(`✅ ${test.name} is available`);
    } catch (error) {
      spinner.fail(`❌ ${test.name} is not available`);
      console.log(chalk.gray(`   Error: ${error}`));
    }
  }

  console.log(chalk.blue('\n📡 API Connection Test'));
  // TODO: Test API connections with dummy requests
}

async function listVoices(provider: string, language?: string) {
  console.log(chalk.blue(`🎤 Available TTS Voices (${provider})`));

  const spinner = ora('Fetching voices...').start();

  try {
    let voices: string[] = [];
    
    if (provider === 'edge') {
      const { EdgeTTS } = await import('../synthesize/edge-tts.js');
      const edgeTTS = new EdgeTTS();
      voices = await edgeTTS.listVoices(language);
    } else if (provider === 'openai') {
      // OpenAI has predefined voices
      voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      if (language && !language.toLowerCase().includes('en')) {
        spinner.warn('OpenAI TTS primarily supports English voices');
      }
    }

    spinner.stop();

    if (voices.length === 0) {
      console.log(chalk.yellow('No voices found'));
      return;
    }

    console.log(chalk.green(`Found ${voices.length} voices:`));
    voices.forEach((voice, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${voice}`));
    });
  } catch (error) {
    spinner.fail('Failed to fetch voices');
    throw error;
  }
}

async function saveConfig(config: any) {
  const { promises: fs } = await import('fs');
  const { join } = await import('path');
  const { homedir } = await import('os');
  
  const configDir = join(homedir(), '.video-localize');
  const configPath = join(configDir, 'config.json');
  
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('❌ Unhandled rejection:'), reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();