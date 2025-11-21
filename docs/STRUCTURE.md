# Project Structure

Complete overview of the ScribeAI codebase organization and file purposes.

## Directory Tree

```
ai_trans_app/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── sessions/
│   │   │   ├── [id]/
│   │   │   │   ├── chunks/
│   │   │   │   │   ├── route.ts          # Chunk upload/retrieval
│   │   │   │   │   └── [chunkIndex]/
│   │   │   │   │       └── transcript/
│   │   │   │   │           └── route.ts  # Chunk transcript
│   │   │   │   ├── route.ts              # Session CRUD
│   │   │   │   ├── transcribe/
│   │   │   │   │   └── route.ts          # Transcription endpoint
│   │   │   │   └── summary/
│   │   │   │       └── route.ts          # Summary generation
│   │   │   └── route.ts                  # Sessions list/create
│   │   ├── transcribe/
│   │   │   └── route.ts                  # Direct transcription
│   │   └── users/
│   │       └── device/
│   │           └── route.ts              # Device-based auth
│   ├── sessions/
│   │   └── [id]/
│   │       └── page.tsx                  # Session details page
│   ├── page.tsx                          # Main recording page
│   ├── layout.tsx                         # Root layout
│   └── globals.css                        # Global styles
│
├── components/                            # React Components
│   ├── LayoutWrapper.tsx                  # Main layout with sidebar
│   ├── RecordingInterface.tsx             # Recording controls
│   ├── RecordingPopup.tsx                 # Mode selection dialog
│   ├── SessionSidebar.tsx                 # Session history sidebar
│   ├── Timer.tsx                          # Recording timer
│   ├── PitchVisualizer.tsx                # Audio waveform
│   ├── TranscriptionDisplay.tsx          # Transcript display
│   └── ui/                                # Reusable UI components
│       ├── button.tsx
│       ├── card.tsx
│       └── dialog.tsx
│
├── hooks/                                 # React Hooks
│   ├── useAudioRecorder.ts                # Audio recording logic
│   ├── useAudioAnalyzer.ts                # Audio analysis
│   ├── useChunkPlayback.ts                # Audio playback
│   ├── useDeepgramTranscription.ts        # Deepgram integration
│   ├── useDevice.ts                       # Device ID management
│   ├── useSessions.ts                     # Session data management
│   └── useSocket.ts                       # Socket.io connection
│
├── lib/                                   # Core Libraries
│   ├── audio-recorder.ts                  # AudioRecorder class
│   ├── audio-analyzer.ts                  # Audio analysis utilities
│   ├── chunk-playback.ts                  # Chunk combination/playback
│   ├── chunk-validation.ts                # Chunk validation
│   ├── deepgram.ts                        # Deepgram real-time (unused)
│   ├── deepgram-file.ts                   # Deepgram file transcription
│   ├── device.ts                          # Device ID generation
│   ├── gemini.ts                          # Gemini API integration
│   ├── indexeddb.ts                       # IndexedDB operations
│   ├── prisma.ts                          # Prisma client setup
│   ├── sync.ts                            # Data synchronization
│   └── utils.ts                           # Utility functions
│
├── server/                                # Custom Server
│   ├── socket.ts                          # Socket.io server setup
│   └── transcription-handler.ts          # Transcription persistence
│
├── server.ts                              # Custom HTTP server
│
├── prisma/
│   └── schema.prisma                      # Database schema
│
├── test/                                  # Test Scripts
│   ├── transcribe-session.ts              # Transcription test script
│   ├── deepgram-test.ts                   # Deepgram API test
│   └── README.md                          # Test documentation
│
├── docs/                                  # Documentation
│   ├── ARCHITECTURE.md                    # System architecture
│   ├── SETUP.md                           # Setup instructions
│   ├── USAGE.md                           # Usage guide
│   ├── API.md                             # API documentation
│   ├── PROBLEMS.md                        # Problems & solutions
│   ├── SCALABILITY.md                     # Scalability analysis
│   └── STRUCTURE.md                       # This file
│
├── public/                                # Static Assets
│   └── *.svg                              # Icons and images
│
├── package.json                           # Dependencies & scripts
├── tsconfig.json                          # TypeScript config
├── next.config.ts                         # Next.js config
├── eslint.config.mjs                      # ESLint config
├── postcss.config.mjs                     # PostCSS config
└── README.md                              # Main README
```

## Key Files Explained

### Application Entry Points

#### `server.ts`
Custom Node.js server that:
- Creates HTTP server
- Initializes Socket.io
- Handles Next.js requests
- Manages environment variable loading

**Key Responsibilities**:
- Server initialization
- Socket.io integration
- Request routing to Next.js

#### `app/page.tsx`
Main recording interface:
- Recording controls (start/pause/stop)
- Mode selection (mic/system audio)
- Session creation
- Real-time status updates

**Key Features**:
- Toast notifications
- Audio visualization
- Session management

#### `app/sessions/[id]/page.tsx`
Session details page:
- Audio playback
- Transcript display (with markdown rendering)
- Summary display (with rich formatting)
- Generate transcript/summary buttons

**Key Features**:
- Markdown to HTML conversion
- Rich text formatting
- Scrollable content areas

### Core Libraries

#### `lib/audio-recorder.ts`
**AudioRecorder Class**: Handles all audio recording logic

**Key Methods**:
- `start()`: Begin recording
- `pause()`: Pause recording
- `resume()`: Resume recording
- `stop()`: Stop and finalize recording

**Features**:
- 30-second chunking
- MediaStream management
- System audio + mic mixing
- State management

#### `lib/gemini.ts`
**Gemini API Integration**: Summary generation

**Key Function**:
- `generateSummary(transcript)`: Generate AI summary

**Features**:
- Model fallback system
- Retry logic with exponential backoff
- Rich prompt engineering
- Error handling

#### `lib/indexeddb.ts`
**IndexedDB Operations**: Local chunk storage

**Key Functions**:
- `storeChunk()`: Save chunk locally
- `getChunks()`: Retrieve chunks
- `deleteChunks()`: Clean up chunks

**Purpose**:
- Offline access
- Faster playback
- Backup storage

#### `lib/prisma.ts`
**Prisma Client Setup**: Database connection

**Features**:
- Connection pooling
- PostgreSQL adapter
- Query logging (dev mode)
- Singleton pattern

### React Hooks

#### `hooks/useAudioRecorder.ts`
**Audio Recording Hook**: Main recording interface

**Returns**:
- `isRecording`, `isPaused`, `duration`, `chunkCount`
- `start()`, `pause()`, `resume()`, `stop()`

**Features**:
- State management
- Chunk upload
- Error handling
- Toast notifications

#### `hooks/useDevice.ts`
**Device Management Hook**: Device ID handling

**Returns**:
- `deviceId`, `user`, `isLoading`, `error`
- `initialize()`: Initialize device/user

**Features**:
- UUID generation
- User creation/lookup
- Background initialization

#### `hooks/useSessions.ts`
**Session Management Hook**: Session data

**Returns**:
- `sessions`, `isLoading`, `error`
- `createSession()`, `updateSession()`, `deleteSession()`

**Features**:
- Data fetching
- CRUD operations
- Cache management

### API Routes

#### `app/api/sessions/[id]/transcribe/route.ts`
**Transcription Endpoint**: On-demand transcription

**Process**:
1. Fetch all chunks
2. Combine into single buffer
3. Send to Deepgram
4. Save transcript to database

#### `app/api/sessions/[id]/summary/route.ts`
**Summary Generation Endpoint**: AI summary

**Process**:
1. Fetch session transcript
2. Send to Gemini API
3. Save summary to database

#### `app/api/sessions/[id]/chunks/route.ts`
**Chunk Management**: Upload and retrieve chunks

**POST**: Upload chunk (FormData)
**GET**: Retrieve all chunks for session

### Server Components

#### `server/socket.ts`
**Socket.io Server**: Real-time communication

**Events Handled**:
- `session:join` / `session:leave`
- `transcription:segment`
- `transcription:chunk-complete`

**Features**:
- Room-based broadcasting
- Transcription persistence
- Error handling

### Database Schema

#### `prisma/schema.prisma`
**Database Models**:
- `User`: Device-based users
- `Session`: Recording sessions
- `AudioChunk`: Audio chunks

**Relationships**:
- User → Sessions (one-to-many)
- Session → AudioChunks (one-to-many)

## Component Hierarchy

```
LayoutWrapper
├── SessionSidebar
│   └── SessionCard (multiple)
└── Main Content
    ├── Home Page (app/page.tsx)
    │   ├── RecordingInterface
    │   │   ├── Timer
    │   │   ├── PitchVisualizer
    │   │   └── Controls (Pause/Resume/Stop)
    │   └── RecordingPopup
    │       └── Mode Selection Buttons
    └── Session Page (app/sessions/[id]/page.tsx)
        ├── Audio Player
        ├── Generate Buttons
        ├── Transcript Canvas
        └── Summary Canvas
```

## Data Flow

### Recording Flow
```
User Action
  → useAudioRecorder hook
    → AudioRecorder class
      → MediaRecorder API
        → Chunk created
          → IndexedDB (local)
          → API Route (server)
            → PostgreSQL (database)
```

### Transcription Flow
```
User clicks "Generate"
  → API Route
    → Fetch chunks from DB
      → Combine chunks
        → Deepgram API
          → Save transcript
            → Update UI
```

### Summary Flow
```
User clicks "Generate Summary"
  → API Route
    → Fetch transcript
      → Gemini API
        → Save summary
          → Format markdown
            → Update UI
```

## File Naming Conventions

- **Components**: PascalCase (`RecordingInterface.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAudioRecorder.ts`)
- **Utilities**: camelCase (`audio-recorder.ts`)
- **API Routes**: `route.ts` (Next.js convention)
- **Types**: PascalCase interfaces/types

## Import Patterns

### Component Imports
```typescript
import { ComponentName } from '@/components/ComponentName'
```

### Hook Imports
```typescript
import { useHookName } from '@/hooks/useHookName'
```

### Library Imports
```typescript
import { functionName } from '@/lib/library-name'
```

### API Imports
```typescript
import { NextRequest, NextResponse } from 'next/server'
```

## Configuration Files

### `package.json`
- Dependencies and dev dependencies
- Scripts (dev, build, start, etc.)
- Project metadata

### `tsconfig.json`
- TypeScript compiler options
- Path aliases (`@/` → root)
- Module resolution

### `next.config.ts`
- Next.js configuration
- Build settings

### `.env` / `.env.local`
- Environment variables
- API keys
- Database URLs

## Testing Structure

### `test/transcribe-session.ts`
Standalone script for testing transcription:
- Fetches session chunks
- Combines audio
- Transcribes via API
- Displays results

**Usage**:
```bash
pnpm run transcribe-session <sessionId> [deviceId]
```

## Documentation Structure

All documentation is in the `docs/` folder:
- **ARCHITECTURE.md**: System design and diagrams
- **SETUP.md**: Installation and configuration
- **USAGE.md**: User guide
- **API.md**: API reference
- **PROBLEMS.md**: Issues and solutions
- **SCALABILITY.md**: Performance analysis
- **STRUCTURE.md**: This file

## Best Practices

1. **Modular Structure**: Each file has a single responsibility
2. **Type Safety**: TypeScript throughout
3. **Error Handling**: Try-catch blocks and validation
4. **Code Organization**: Logical grouping by feature
5. **Documentation**: JSDoc comments for complex functions
6. **Consistent Naming**: Follow established conventions

## Future Structure Improvements

1. **Feature Folders**: Group by feature instead of type
2. **Shared Types**: Centralized type definitions
3. **Test Files**: Co-located with source files
4. **Storybook**: Component documentation
5. **API Client**: Centralized API client library

