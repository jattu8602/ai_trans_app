# ScribeAI - AI-Powered Audio Transcription & Meeting Assistant

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-7.0-2D3748?style=flat-square&logo=prisma)

**ScribeAI** is a full-stack web application for capturing, transcribing, and summarizing audio sessions. Perfect for meetings, interviews, and any scenario where you need accurate transcriptions with AI-powered summaries.

## 🚀 Key Features

- **🎤 Multi-Mode Recording**: Record from microphone or capture system audio (Google Meet, Zoom, etc.)
- **⏱️ Long Session Support**: Handle recordings up to 1+ hours with intelligent chunking
- **📝 Real-Time Transcription**: On-demand transcription using Deepgram API
- **🤖 AI Summaries**: Generate comprehensive meeting summaries with Google Gemini
- **💾 Persistent Storage**: IndexedDB caching + PostgreSQL database
- **🔄 Real-Time Updates**: Socket.io for live status updates
- **📊 Rich Text Formatting**: Beautifully formatted transcripts and summaries
- **🌙 Dark Mode**: Comfortable viewing for long sessions

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) folder:

- **[Architecture](./docs/ARCHITECTURE.md)** - System design, diagrams, and data flow
- **[Setup Guide](./docs/SETUP.md)** - Installation and configuration
- **[Usage Guide](./docs/USAGE.md)** - How to use the application
- **[API Documentation](./docs/API.md)** - REST API and Socket.io events
- **[Problems & Solutions](./docs/PROBLEMS.md)** - Issues encountered and fixes
- **[Scalability Analysis](./docs/SCALABILITY.md)** - Long-session handling and performance
- **[Project Structure](./docs/STRUCTURE.md)** - Codebase organization

## 🛠️ Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Set up database
pnpm prisma migrate dev

# Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to start using ScribeAI.

For detailed setup instructions, see [SETUP.md](./docs/SETUP.md).

## 🏗️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Next.js API Routes, Node.js, Socket.io
- **Database**: PostgreSQL with Prisma ORM
- **Audio Processing**: MediaRecorder API, Web Audio API
- **Transcription**: Deepgram API
- **AI Summarization**: Google Gemini API
- **Styling**: Tailwind CSS, Radix UI
- **State Management**: React Hooks, IndexedDB

## 📋 Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL database (local or cloud)
- Deepgram API key
- Google Gemini API key

## 🎯 Core Workflow

1. **Start Recording**: Choose mic or system audio mode
2. **Record Session**: Audio is chunked every 30 seconds
3. **Stop Recording**: Session is saved
4. **Generate Transcript**: On-demand transcription of all chunks
5. **Generate Summary**: AI-powered summary with key points and action items

## 📖 Learn More

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Troubleshooting](./docs/PROBLEMS.md)

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. For questions or issues, please contact the development team.

---

**Built with ❤️ for seamless meeting transcription and summarization**
