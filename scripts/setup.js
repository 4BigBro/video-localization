#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const { promises: fs } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

const chalk = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
};

const ora = {
  start: (text) => {
    process.stdout.write(`⠋ ${text}`);
    return {
      succeed: (message) => console.log(`\r✅ ${message}`),
      fail: (message) => console.log(`\r❌ ${message}`),
      warn: (message) => console.log(`\r⚠️  ${message}`),
      stop: () => process.stdout.write('\r'),
    };
  },
};

async function checkMacOS() {
  const platform = process.platform;
  if (platform !== 'darwin') {
    console.log(chalk.yellow('⚠️  This setup script is optimized for macOS'));
    console.log(chalk.gray('   You may need to install dependencies manually on other platforms'));
  }
  return platform === 'darwin';
}

async function checkHomebrew() {
  try {
    execSync('which brew', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function installHomebrew() {
  console.log(chalk.blue('📦 Installing Homebrew...'));
  console.log(chalk.gray('   This may take a few minutes'));
  
  try {
    execSync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', {
      stdio: 'inherit',
    });
    console.log(chalk.green('✅ Homebrew installed successfully'));
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Failed to install Homebrew'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    return false;
  }
}

async function checkCommand(command, name) {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function installWithBrew(formula, name) {
  const spinner = ora.start(`Installing ${name}...`);
  
  try {
    execSync(`brew install ${formula}`, { stdio: 'pipe' });
    spinner.succeed(`${name} installed successfully`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to install ${name}`);
    console.log(chalk.gray(`   Error: ${error.message}`));
    return false;
  }
}

async function installWithPip(package, name) {
  const spinner = ora.start(`Installing ${name}...`);
  
  try {
    execSync(`pip3 install ${package}`, { stdio: 'pipe' });
    spinner.succeed(`${name} installed successfully`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to install ${name}`);
    console.log(chalk.gray(`   Error: ${error.message}`));
    return false;
  }
}

async function setupDependencies() {
  console.log(chalk.blue('🔧 Setting up dependencies...'));
  
  const dependencies = [
    { command: 'ffmpeg', brew: 'ffmpeg', name: 'FFmpeg' },
    { command: 'python3', brew: 'python@3.11', name: 'Python 3' },
  ];

  for (const dep of dependencies) {
    const spinner = ora.start(`Checking ${dep.name}...`);
    
    if (await checkCommand(dep.command, dep.name)) {
      spinner.succeed(`${dep.name} is already installed`);
    } else {
      spinner.stop();
      if (dep.brew) {
        await installWithBrew(dep.brew, dep.name);
      }
    }
  }

  // Install Python packages
  const pythonPackages = [
    { package: 'edge-tts', name: 'Edge TTS' },
    { package: 'openai-whisper', name: 'OpenAI Whisper' },
  ];

  for (const pkg of pythonPackages) {
    const spinner = ora.start(`Checking ${pkg.name}...`);
    
    try {
      execSync(`pip3 show ${pkg.package.split('==')[0]}`, { stdio: 'pipe' });
      spinner.succeed(`${pkg.name} is already installed`);
    } catch {
      spinner.stop();
      await installWithPip(pkg.package, pkg.name);
    }
  }
}

async function setupConfiguration() {
  console.log(chalk.blue('⚙️  Setting up configuration...'));
  
  const configDir = join(homedir(), '.video-localize');
  const configPath = join(configDir, 'config.json');
  
  try {
    await fs.mkdir(configDir, { recursive: true });
    
    // Check if config already exists
    try {
      await fs.access(configPath);
      console.log(chalk.green('✅ Configuration file already exists'));
      return;
    } catch {
      // Config doesn't exist, create default
    }
    
    const defaultConfig = {
      apiKeys: {
        claude: process.env.CLAUDE_API_KEY || null,
        openai: process.env.OPENAI_API_KEY || null,
        deepl: process.env.DEEPL_API_KEY || null,
      },
      defaults: {
        ttsProvider: 'edge',
        transcriptionProvider: 'whisper',
        translationProvider: 'claude',
        audioQuality: 'high',
      },
      ffmpeg: {
        timeout: 300000,
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
    
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(chalk.green('✅ Default configuration created'));
    console.log(chalk.gray(`   Config location: ${configPath}`));
  } catch (error) {
    console.log(chalk.red('❌ Failed to setup configuration'));
    console.log(chalk.gray(`   Error: ${error.message}`));
  }
}

async function testInstallation() {
  console.log(chalk.blue('🧪 Testing installation...'));
  
  const tests = [
    { command: 'ffmpeg -version', name: 'FFmpeg' },
    { command: 'ffprobe -version', name: 'FFprobe' },
    { command: 'edge-tts --help', name: 'Edge TTS' },
    { command: 'whisper --help', name: 'Whisper' },
    { command: 'python3 --version', name: 'Python 3' },
  ];

  let allPassed = true;

  for (const test of tests) {
    const spinner = ora.start(`Testing ${test.name}...`);
    
    try {
      execSync(test.command, { stdio: 'pipe' });
      spinner.succeed(`${test.name} is working`);
    } catch (error) {
      spinner.fail(`${test.name} test failed`);
      console.log(chalk.gray(`   Command: ${test.command}`));
      console.log(chalk.gray(`   Error: ${error.message}`));
      allPassed = false;
    }
  }

  return allPassed;
}

async function displayNextSteps() {
  console.log(chalk.blue('\n🎉 Setup completed!'));
  console.log(chalk.green('\nNext steps:'));
  console.log(chalk.gray('1. Install Node.js dependencies:'));
  console.log(chalk.yellow('   pnpm install'));
  console.log(chalk.gray('\n2. Configure API keys (optional):'));
  console.log(chalk.yellow('   npx video-localize config --interactive'));
  console.log(chalk.gray('\n3. Test the installation:'));
  console.log(chalk.yellow('   npx video-localize test'));
  console.log(chalk.gray('\n4. Process your first video:'));
  console.log(chalk.yellow('   npx video-localize process input.mp4'));
  
  console.log(chalk.blue('\n📚 Documentation:'));
  console.log(chalk.gray('   Configuration: ~/.video-localize/config.json'));
  console.log(chalk.gray('   Logs: ./logs/'));
  console.log(chalk.gray('   Temp files: ./temp/'));
}

async function main() {
  console.log(chalk.blue('🎬 Video Localization Setup'));
  console.log(chalk.gray('Setting up your macOS environment for video localization\n'));

  try {
    // Check macOS
    const isMacOS = await checkMacOS();
    
    if (isMacOS) {
      // Check and install Homebrew
      if (!(await checkHomebrew())) {
        console.log(chalk.yellow('📦 Homebrew not found'));
        const shouldInstall = process.argv.includes('--auto') || 
          process.env.CI || 
          require('readline-sync')?.keyInYN?.('Install Homebrew? (required for dependencies)');
        
        if (shouldInstall) {
          if (!(await installHomebrew())) {
            process.exit(1);
          }
        } else {
          console.log(chalk.yellow('⚠️  Skipping Homebrew installation. You may need to install dependencies manually.'));
        }
      } else {
        console.log(chalk.green('✅ Homebrew is available'));
      }
    }

    // Setup dependencies
    await setupDependencies();
    
    // Setup configuration
    await setupConfiguration();
    
    // Test installation
    const testsPassed = await testInstallation();
    
    if (testsPassed) {
      await displayNextSteps();
    } else {
      console.log(chalk.red('\n❌ Some tests failed. Please check the installation.'));
      process.exit(1);
    }
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Setup failed: ${error.message}`));
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };