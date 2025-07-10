#!/usr/bin/env node

const { spawn } = require('child_process');
const { watch } = require('fs');
const { join } = require('path');

const chalk = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
};

let currentProcess = null;
let restartTimer = null;

function startTypeScriptWatch() {
  console.log(chalk.blue('🔄 Starting TypeScript compiler in watch mode...'));
  
  const tscProcess = spawn('npx', ['tsc', '--watch'], {
    stdio: 'pipe',
    cwd: process.cwd(),
  });

  tscProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Found 0 errors')) {
      console.log(chalk.green('✅ TypeScript compilation successful'));
    } else if (output.includes('error')) {
      console.log(chalk.red('❌ TypeScript compilation errors:'));
      console.log(chalk.gray(output));
    }
  });

  tscProcess.stderr.on('data', (data) => {
    console.log(chalk.red('TypeScript error:'), data.toString());
  });

  return tscProcess;
}

function startCLI(args = []) {
  if (currentProcess) {
    console.log(chalk.yellow('⏹️  Stopping previous process...'));
    currentProcess.kill();
  }

  console.log(chalk.blue('🚀 Starting CLI...'));
  
  currentProcess = spawn('node', ['dist/cli/index.js', ...args], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  currentProcess.on('close', (code) => {
    if (code !== null && code !== 0) {
      console.log(chalk.red(`❌ CLI exited with code ${code}`));
    }
    currentProcess = null;
  });

  currentProcess.on('error', (error) => {
    console.log(chalk.red(`❌ CLI error: ${error.message}`));
  });

  return currentProcess;
}

function restartWithDelay() {
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  
  restartTimer = setTimeout(() => {
    const args = process.argv.slice(2);
    startCLI(args);
  }, 1000); // 1 second delay to debounce multiple file changes
}

function setupFileWatcher() {
  const srcDir = join(process.cwd(), 'src');
  
  console.log(chalk.blue('👀 Watching for file changes...'));
  
  const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.ts')) {
      console.log(chalk.yellow(`📝 File changed: ${filename}`));
      restartWithDelay();
    }
  });

  return watcher;
}

function setupSignalHandlers() {
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⏹️  Shutting down development server...'));
    
    if (currentProcess) {
      currentProcess.kill();
    }
    
    if (restartTimer) {
      clearTimeout(restartTimer);
    }
    
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n⏹️  Received SIGTERM, shutting down...'));
    
    if (currentProcess) {
      currentProcess.kill();
    }
    
    process.exit(0);
  });
}

async function checkDistDirectory() {
  const { promises: fs } = require('fs');
  const distDir = join(process.cwd(), 'dist');
  
  try {
    await fs.access(distDir);
    return true;
  } catch {
    return false;
  }
}

async function initialBuild() {
  console.log(chalk.blue('🔨 Running initial TypeScript build...'));
  
  return new Promise((resolve, reject) => {
    const tscProcess = spawn('npx', ['tsc'], {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    let output = '';
    let hasErrors = false;

    tscProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    tscProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('error')) {
        hasErrors = true;
        console.log(chalk.red('❌ TypeScript compilation error:'));
        console.log(chalk.gray(error));
      }
      output += error;
    });

    tscProcess.on('close', (code) => {
      if (code === 0 && !hasErrors) {
        console.log(chalk.green('✅ Initial build completed'));
        resolve();
      } else {
        console.log(chalk.red('❌ Initial build failed'));
        reject(new Error('TypeScript compilation failed'));
      }
    });
  });
}

async function main() {
  console.log(chalk.blue('🎬 Video Localization Development Server'));
  console.log(chalk.gray('Starting development environment with hot reload\n'));

  try {
    // Check if dist directory exists
    const distExists = await checkDistDirectory();
    
    if (!distExists) {
      await initialBuild();
    }

    // Setup signal handlers for graceful shutdown
    setupSignalHandlers();

    // Start TypeScript compiler in watch mode
    const tscWatcher = startTypeScriptWatch();

    // Setup file watcher for source files
    const fileWatcher = setupFileWatcher();

    // Start CLI with provided arguments
    const args = process.argv.slice(2);
    if (args.length > 0) {
      // Wait a bit for initial compilation
      setTimeout(() => {
        startCLI(args);
      }, 2000);
    } else {
      console.log(chalk.yellow('💡 No CLI arguments provided. Use Ctrl+C to exit.'));
      console.log(chalk.gray('   Example: npm run dev process input.mp4'));
    }

    console.log(chalk.green('\n🎯 Development server is running!'));
    console.log(chalk.gray('   - TypeScript compilation: Active'));
    console.log(chalk.gray('   - File watching: Active'));
    console.log(chalk.gray('   - Hot reload: Active'));
    console.log(chalk.gray('   - Press Ctrl+C to stop\n'));

    // Keep the process alive
    process.stdin.resume();

  } catch (error) {
    console.log(chalk.red(`❌ Failed to start development server: ${error.message}`));
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };