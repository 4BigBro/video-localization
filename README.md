# 🎬 Video Localization

An automated video localization pipeline that converts English videos to Chinese dubbed videos with synchronized subtitles.

## ✨ Features

- **🎵 Audio Extraction**: Extract audio tracks from videos using FFmpeg
- **🎤 Speech Recognition**: Convert speech to text using Whisper or OpenAI API
- **🌐 Translation**: Translate subtitles using Claude, OpenAI, or DeepL
- **🗣️ Voice Synthesis**: Generate Chinese speech using EdgeTTS or OpenAI TTS
- **🎬 Video Merging**: Combine new audio with original video and sync subtitles
- **⚡ CLI Interface**: User-friendly command-line tool with progress tracking
- **🔧 Configurable**: Support for multiple providers and quality settings

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/video-localization.git
cd video-localization

# Install dependencies
pnpm install

# Setup macOS environment (installs FFmpeg, Whisper, EdgeTTS)
pnpm setup

# Configure API keys (optional)
npx video-localize config --interactive
```

### Basic Usage

```bash
# Process a video with default settings
npx video-localize process input.mp4

# Process with custom output path
npx video-localize process input.mp4 -o output_chinese.mp4

# Use specific providers
npx video-localize process input.mp4 \
  --tts-provider edge \
  --transcription-provider whisper \
  --translation-provider claude
```

## 📋 Requirements

### System Dependencies

- **macOS** (optimized for, but works on Linux/Windows)
- **Node.js** 18+ 
- **FFmpeg** (for video/audio processing)
- **Python 3** (for EdgeTTS and Whisper)

### Python Packages

- `edge-tts` (for Chinese voice synthesis)
- `openai-whisper` (for speech recognition)

### API Keys (Optional)

- **Claude API** (for translation)
- **OpenAI API** (for transcription/translation/TTS)
- **DeepL API** (for translation)

## 🛠️ Setup

### Automatic Setup (macOS)

```bash
# Install all dependencies automatically
pnpm setup

# Or run in non-interactive mode (CI/Docker)
pnpm setup:auto
```

### Manual Setup

1. **Install FFmpeg**:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

2. **Install Python packages**:
   ```bash
   pip3 install edge-tts openai-whisper
   ```

3. **Configure API keys**:
   ```bash
   # Interactive setup
   npx video-localize config --interactive
   
   # Or set environment variables
   export CLAUDE_API_KEY="your-key"
   export OPENAI_API_KEY="your-key"
   export DEEPL_API_KEY="your-key"
   ```

## 💻 CLI Commands

### Process Videos

```bash
# Basic processing
npx video-localize process input.mp4

# With options
npx video-localize process input.mp4 \
  --output output.mp4 \
  --target-lang Chinese \
  --tts-provider edge \
  --transcription-provider whisper \
  --translation-provider claude \
  --audio-quality high \
  --keep-files \
  --verbose
```

### Configuration

```bash
# Interactive configuration
npx video-localize config --interactive

# View current config
cat ~/.video-localize/config.json
```

### Testing

```bash
# Test system dependencies
npx video-localize test

# List available TTS voices
npx video-localize list-voices --provider edge --language zh-CN
```

## ⚙️ Configuration

Configuration is stored in `~/.video-localize/config.json`:

```json
{
  "apiKeys": {
    "claude": "your-claude-key",
    "openai": "your-openai-key",
    "deepl": "your-deepl-key"
  },
  "defaults": {
    "ttsProvider": "edge",
    "transcriptionProvider": "whisper",
    "translationProvider": "claude",
    "audioQuality": "high"
  },
  "ffmpeg": {
    "timeout": 300000
  },
  "whisper": {
    "model": "base"
  },
  "edgeTts": {
    "defaultVoice": "zh-CN-XiaoxiaoNeural",
    "rate": "+0%",
    "volume": "+0%",
    "pitch": "+0Hz"
  }
}
```

## 🏗️ Development

### Setup Development Environment

```bash
# Install dependencies
pnpm install

# Run development server with hot reload
pnpm dev

# Run tests
pnpm test

# Run with coverage
pnpm test:coverage

# Lint and format
pnpm lint
pnpm format
```

### Project Structure

```
src/
├── extract/        # Audio extraction (FFmpeg wrapper)
├── transcribe/     # Speech-to-text (Whisper, OpenAI)
├── translate/      # Translation (Claude, OpenAI, DeepL)
├── synthesize/     # Text-to-speech (EdgeTTS, OpenAI)
├── merge/          # Video/audio merging and subtitle sync
├── cli/            # Command-line interface
├── utils/          # Shared utilities (logging, file handling)
└── types/          # TypeScript type definitions

tests/              # Unit and integration tests
scripts/            # Development and setup scripts
```

### Adding New Providers

1. **Transcription Provider**:
   ```typescript
   // src/transcribe/new-provider.ts
   export class NewTranscriber {
     async transcribe(audioFile: AudioFile): Promise<TranscriptionResult> {
       // Implementation
     }
   }
   ```

2. **Translation Provider**:
   ```typescript
   // src/translate/new-provider.ts
   export class NewTranslator {
     async translateSegments(segments: SubtitleSegment[]): Promise<SubtitleSegment[]> {
       // Implementation
     }
   }
   ```

3. **TTS Provider**:
   ```typescript
   // src/synthesize/new-provider.ts
   export class NewTTS {
     async synthesizeSegments(segments: SubtitleSegment[], outputDir: string): Promise<TTSResult[]> {
       // Implementation
     }
   }
   ```

## 🎯 Pipeline Overview

1. **Audio Extraction**: Extract audio track from video file
2. **Transcription**: Convert speech to text with timestamps
3. **Translation**: Translate subtitle segments to target language
4. **Voice Synthesis**: Generate Chinese speech audio for each segment
5. **Video Merging**: Combine original video with new audio and subtitles

## 📊 Quality Settings

| Quality | Video CRF | Audio Bitrate | Processing Speed |
|---------|-----------|---------------|------------------|
| High    | 18        | 192k          | Slow             |
| Medium  | 23        | 128k          | Medium           |
| Low     | 28        | 96k           | Fast             |

## 🎤 Supported TTS Voices

### EdgeTTS (Free)
- `zh-CN-XiaoxiaoNeural` (Female, recommended)
- `zh-CN-YunxiNeural` (Male)
- `zh-CN-YunjianNeural` (Male)
- `zh-CN-YunyangNeural` (Male)

### OpenAI TTS (Paid)
- `alloy` (Neutral)
- `echo` (Male)
- `fable` (British)
- `onyx` (Deep male)
- `nova` (Female)
- `shimmer` (Female)

## 🚨 Troubleshooting

### Common Issues

**FFmpeg not found**:
```bash
# Install FFmpeg
brew install ffmpeg  # macOS
sudo apt install ffmpeg  # Ubuntu
```

**EdgeTTS not found**:
```bash
# Install EdgeTTS
pip3 install edge-tts
```

**Whisper not found**:
```bash
# Install Whisper
pip3 install openai-whisper
```

**API key errors**:
```bash
# Configure API keys
npx video-localize config --interactive
```

**Permission denied**:
```bash
# Make CLI executable
chmod +x dist/cli/index.js
```

### Debug Mode

```bash
# Run with verbose logging
npx video-localize process input.mp4 --verbose

# Check logs
tail -f logs/video-localization-$(date +%Y-%m-%d).log
```

## 📝 Examples

### Basic Video Processing
```bash
# Convert English video to Chinese
npx video-localize process lecture.mp4
# Output: lecture_localized.mp4
```

### High Quality Processing
```bash
# Maximum quality with custom output
npx video-localize process presentation.mp4 \
  --output presentation_chinese.mp4 \
  --audio-quality high \
  --tts-provider openai \
  --translation-provider claude
```

### Batch Processing
```bash
# Process multiple videos
for video in *.mp4; do
  npx video-localize process "$video" --output "chinese_$video"
done
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and add tests
4. Run tests: `pnpm test`
5. Commit changes: `git commit -m "Add new feature"`
6. Push to branch: `git push origin feature/new-feature`
7. Create a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [FFmpeg](https://ffmpeg.org/) - Video/audio processing
- [OpenAI Whisper](https://openai.com/whisper/) - Speech recognition
- [Microsoft Edge TTS](https://github.com/rany2/edge-tts) - Text-to-speech
- [Claude AI](https://claude.ai/) - Translation services
- [OpenAI](https://openai.com/) - AI services
- [DeepL](https://deepl.com/) - Translation services

## 🔗 Links

- [Documentation](https://docs.video-localization.com)
- [GitHub Issues](https://github.com/yourusername/video-localization/issues)
- [Discord Community](https://discord.gg/video-localization)

---

Made with ❤️ for the open source community