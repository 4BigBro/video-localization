# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an automated video localization pipeline that converts English videos to Chinese dubbed videos. The workflow includes:

1. **Audio Extraction**: Extract audio tracks from video files using ffmpeg
2. **Transcription**: Convert speech to text using Whisper or OpenAI API
3. **Translation**: Translate subtitles to Chinese using Claude/OpenAI/DeepL
4. **Voice Synthesis**: Generate Chinese speech using TTS (EdgeTTS, IndexTTS)
5. **Video Merging**: Combine new audio with original video and sync subtitles

Target platform: macOS local deployment with high automation and CLI interface.

## Development Commands

Before any code changes, always run these verification commands:

```bash
# Install dependencies
pnpm install

# Code quality checks
pnpm lint
pnpm typecheck
pnpm test

# Build verification
pnpm run build

# Run single test file
pnpm test -- transcribe/whisper.test.ts
```

## Project Architecture

```
/src
├── extract/        # Audio extraction (ffmpeg wrapper)
├── transcribe/     # Speech-to-text (Whisper, OpenAI API)
├── translate/      # Subtitle translation (Claude/OpenAI/DeepL)
├── synthesize/     # Chinese TTS (EdgeTTS, IndexTTS)
├── merge/          # Video/audio synchronization
├── cli/            # Command line interface
└── utils/          # Shared utilities and helpers

/tests              # Unit tests (mirror src structure)
/scripts            # Development and deployment scripts
/configs            # Configuration files (models, TTS settings)
```

## Key Technical Requirements

- **macOS Compatibility**: All tools must work on macOS
- **Local Processing**: No cloud dependencies for core functionality
- **FFmpeg Integration**: Audio/video manipulation via ffmpeg
- **Multiple TTS Providers**: Support EdgeTTS, IndexTTS, and other engines
- **Subtitle Sync**: Accurate timing alignment between audio and subtitles
- **CLI Interface**: Script-based execution for automation

## Testing Strategy

- **Unit Tests**: All modules require 80%+ test coverage
- **Integration Tests**: End-to-end pipeline testing with sample videos
- **Performance Tests**: Audio sync accuracy and processing speed
- **Error Handling**: Robust failure recovery for each pipeline stage

## Validation Workflow

Before any commit or PR:

1. Run `pnpm lint` - must pass
2. Run `pnpm typecheck` - must pass  
3. Run `pnpm test` - must pass
4. Run `pnpm run build` - must pass
5. Test with sample video file if changes affect core pipeline

## Common Development Tasks

```bash
# Set up development environment
pnpm run setup

# Run development server with file watching
pnpm run dev

# Format code
pnpm run format

# Process a test video
pnpm run process -- input.mp4 --output output.mp4 --target-lang zh

# Run specific module tests
pnpm test -- --grep "audio extraction"
```

## Dependencies and Tools

- **ffmpeg**: Audio/video processing (must be installed locally)
- **Whisper**: Speech recognition (OpenAI or local model)
- **TTS Engines**: EdgeTTS, IndexTTS for Chinese synthesis
- **Translation APIs**: Claude, OpenAI, DeepL integration
- **TypeScript**: Type-safe development
- **Vitest**: Testing framework

## Error Handling Patterns

- All async operations must have proper error handling
- Failed pipeline stages should provide clear recovery options
- Audio sync issues should be detected and corrected automatically
- Missing dependencies should show helpful installation instructions

## Performance Considerations

- Large video files require streaming processing
- TTS generation should be batched for efficiency
- Audio sync calculations need frame-accurate timing
- Memory usage should be monitored for long videos

## Commit and PR Standards

- **Commit Messages**: Use conventional commits (feat/fix/test/docs)
- **PR Requirements**: Include test coverage and performance impact
- **Code Review**: All changes must pass CI/CD pipeline
- **Documentation**: Update relevant config files and examples

## GitHub Actions Integration

The CI/CD pipeline automatically runs on push/PR:
- Linting and type checking
- Unit and integration tests
- Build verification
- Performance regression tests
- macOS compatibility checks