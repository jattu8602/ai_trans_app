# Problems Faced & Solutions

This document details the major problems encountered during development and how they were resolved.

## Problem 1: Gemini Model Compatibility Issues

### Issue

When integrating Google Gemini API for summary generation, we encountered 404 errors with different model names:

```
Error: Model "gemini-1.5-flash" not found (404)
Error: Model "gemini-1.5-flash-latest" not found (404)
Error: Model "gemini-pro" not found (404)
```

### Root Cause

1. **API Version Mismatch**: Different Gemini API versions support different models
2. **Model Name Changes**: Google frequently updates model names
3. **SDK Limitations**: The `@google/generative-ai` SDK had compatibility issues

### Solution

**Implemented Model Fallback System** (`lib/gemini.ts`):

```typescript
const modelCandidates = [
  process.env.GEMINI_MODEL_NAME, // User preference first
  'gemini-2.0-flash',            // Latest fast model
  'gemini-1.5-pro',              // Stable pro model
  'gemini-1.5-flash',           // Stable flash model
  'gemini-pro',                  // Original stable model
].filter(Boolean) as string[]
```

**Switched to Direct REST API**:
- Instead of using the SDK, we use `fetch` to call Gemini REST API directly
- More control over API version and model selection
- Better error handling

**404 Error Handling**:
- If a model returns 404, immediately try the next model
- No retries for 404 errors (they won't succeed)
- Clear error messages suggesting alternative models

### Code Reference

- File: `lib/gemini.ts`
- Lines: 77-246
- Key Function: `generateSummary()`

### Lessons Learned

1. Always implement fallback mechanisms for external APIs
2. Direct REST API calls can be more reliable than SDKs
3. Model names change frequently - make them configurable

---

## Problem 2: Transcription Approach Change

### Issue

Initially planned to use **real-time transcription** with Gemini streaming, but encountered:
- High API costs for long sessions
- Performance issues with streaming
- Complex state management
- User didn't always want immediate transcription

### Root Cause

1. **Cost Concerns**: Real-time transcription for 1-hour sessions = 60 API calls
2. **User Experience**: Users prefer to transcribe on-demand
3. **Error Recovery**: Hard to retry failed real-time transcriptions
4. **Gemini Limitations**: Gemini better for summaries than real-time transcription

### Solution

**Switched to On-Demand Transcription**:

1. **Removed Real-Time Transcription** from `useAudioRecorder.ts`:
   - Removed `transcribeAudioFile()` calls during chunk upload
   - Chunks now upload without transcription
   - Transcription happens only when user clicks "Generate"

2. **Created Dedicated Transcription Endpoint**:
   - `POST /api/sessions/[id]/transcribe`
   - Combines all chunks into single audio file
   - Sends to Deepgram API (better for transcription than Gemini)
   - Saves full transcript to database

3. **Better User Control**:
   - User decides when to transcribe
   - Can retry if transcription fails
   - Can transcribe old sessions anytime

### Code Reference

- File: `hooks/useAudioRecorder.ts` (lines 56-126)
- File: `app/api/sessions/[id]/transcribe/route.ts`
- File: `app/sessions/[id]/page.tsx` (Generate button)

### Lessons Learned

1. On-demand is often better than real-time for cost and UX
2. Deepgram is better for transcription, Gemini for summarization
3. Give users control over expensive operations

---

## Problem 3: Database Connection Issues

### Issue

Encountered errors when Prisma tried to connect to PostgreSQL:

```
Error: DATABASE_URL environment variable is not set
Error: Can't reach database server
Error: Connection pool timeout
```

### Root Cause

1. **Environment Variable Loading Order**: `.env` files not loaded before Prisma initialization
2. **Prisma Adapter Setup**: Needed proper PostgreSQL adapter configuration
3. **Connection Pooling**: Default Prisma client doesn't use connection pooling

### Solution

**1. Environment Variable Loading** (`server.ts`):

```typescript
// Load environment variables FIRST - before any other imports
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

// Load .env.local first (Next.js convention), then .env
const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath })
}
if (existsSync(envPath)) {
  config({ path: envPath })
}
```

**2. Prisma Adapter Configuration** (`lib/prisma.ts`):

```typescript
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})
```

**3. Graceful Error Handling**:

- Check for `DATABASE_URL` before initializing Prisma
- Provide clear error messages
- Lazy initialization in test scripts

### Code Reference

- File: `server.ts` (lines 6-23)
- File: `lib/prisma.ts` (lines 1-28)
- File: `test/transcribe-session.ts` (lazy Prisma loading)

### Lessons Learned

1. Always load environment variables before importing modules that use them
2. Use connection pooling for better performance
3. Provide clear error messages for missing configuration

---

## Problem 4: TypeScript/ESLint Errors

### Issue

Multiple TypeScript and ESLint errors during development:

```
Error: Type 'Buffer<ArrayBufferLike>' is not assignable to type 'BlobPart'
Error: Cannot redeclare block-scoped variable 'error'
Error: This regular expression flag is only available when targeting 'es2018' or later
```

### Root Cause

1. **Type Mismatches**: Buffer vs Blob type incompatibilities
2. **Variable Shadowing**: Reusing variable names in nested scopes
3. **Regex Flags**: Using unsupported regex flags for TypeScript target

### Solution

**1. Buffer to Blob Conversion**:

```typescript
// Convert Buffer to Uint8Array before creating Blob
const bytes = new Uint8Array(buffer.length)
for (let i = 0; i < buffer.length; i++) {
  bytes[i] = buffer[i]
}
const blob = new Blob([bytes], { type: 'audio/webm' })
```

**2. Variable Renaming**:

```typescript
// Before: error variable shadowing
catch (error) {
  setError(error) // Conflicts with error state
}

// After: renamed local variable
catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error')
}
```

**3. Regex Pattern Fixes**:

```typescript
// Before: Using 's' flag (not supported)
html.replace(/(<li.*<\/li>)/s, '<ul>$1</ul>')

// After: Process line by line instead
const lines = html.split('\n')
// Process each line individually
```

### Code Reference

- File: `test/transcribe-session.ts` (Buffer conversion)
- File: `app/sessions/[id]/page.tsx` (variable renaming, regex fixes)
- File: `lib/gemini.ts` (template string backtick escaping)

### Lessons Learned

1. Always check TypeScript target version for feature support
2. Avoid variable name shadowing
3. Use proper type conversions for browser APIs

---

## Problem 5: Audio Chunk Upload Failures

### Issue

Large audio chunks causing:
- Memory issues when combining chunks
- Upload timeouts
- Failed chunk uploads
- Incomplete session data

### Root Cause

1. **Large File Sizes**: 30-second chunks can be 1-2MB each
2. **Memory Overflow**: Combining all chunks in memory
3. **Network Timeouts**: Slow uploads for large chunks
4. **No Validation**: Chunks uploaded without size/format checks

### Solution

**1. Base64 Encoding for Storage**:

```typescript
// Convert file to base64 for efficient database storage
const arrayBuffer = await chunk.arrayBuffer()
const buffer = Buffer.from(arrayBuffer)
const base64Data = buffer.toString('base64')

// Store in database as text
await prisma.audioChunk.create({
  data: {
    audioData: base64Data, // Base64 string
    // ...
  }
})
```

**2. IndexedDB Caching**:

```typescript
// Store chunks locally for offline access
await storeChunk({
  id: `${sessionId}-${index}`,
  sessionId: sessionId,
  chunkIndex: index,
  blob: chunk,
  timestamp: Date.now(),
})
```

**3. Chunk Validation**:

```typescript
// Validate chunk before processing
if (chunk.size === 0) {
  console.warn('Empty chunk, skipping')
  return
}

if (chunk.size > MAX_CHUNK_SIZE) {
  throw new Error('Chunk too large')
}
```

**4. Error Handling & Retry Logic**:

```typescript
try {
  await uploadChunk(chunk)
} catch (error) {
  // Log error but don't fail entire recording
  console.error('Chunk upload failed:', error)
  // Chunk is still in IndexedDB, can retry later
}
```

### Code Reference

- File: `app/api/sessions/[id]/chunks/route.ts` (base64 encoding)
- File: `lib/indexeddb.ts` (local storage)
- File: `lib/chunk-playback.ts` (chunk combination)
- File: `hooks/useAudioRecorder.ts` (upload logic)

### Lessons Learned

1. Base64 encoding is efficient for small-medium chunks in database
2. Always cache locally for offline access
3. Validate data before processing
4. Don't fail entire operation if one chunk fails

---

## Problem 6: Socket.io Connection Issues

### Issue

Socket.io connections failing in production:
- CORS errors
- Connection timeouts
- Events not received
- Server not initializing

### Root Cause

1. **CORS Configuration**: Not properly configured for production
2. **Server Initialization Order**: Socket.io initialized before HTTP server ready
3. **Path Configuration**: Socket.io path not matching client expectations

### Solution

**1. Proper CORS Configuration** (`server/socket.ts`):

```typescript
io = new SocketIOServer(httpServer, {
  path: '/api/socket',
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL
      : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
```

**2. Server Initialization Order** (`server.ts`):

```typescript
app.prepare().then(() => {
  const httpServer = createServer(/* ... */)

  // Initialize Socket.io AFTER HTTP server created
  initializeSocketIO(httpServer)

  httpServer.listen(port, () => {
    console.log(`> Socket.io available at http://${hostname}:${port}/api/socket`)
  })
})
```

**3. Client Connection** (`hooks/useSocket.ts`):

```typescript
const socket = io('/', {
  path: '/api/socket',
  transports: ['websocket', 'polling'],
})
```

### Code Reference

- File: `server/socket.ts` (CORS configuration)
- File: `server.ts` (initialization order)
- File: `hooks/useSocket.ts` (client connection)

### Lessons Learned

1. Always configure CORS properly for production
2. Initialize Socket.io after HTTP server is created
3. Match client and server path configurations

---

## Problem 7: Markdown Rendering in Summary

### Issue

Summary text displayed as raw markdown instead of formatted HTML:
- `**bold**` showing as text, not bold
- `## headings` not rendering as headings
- Lists not formatting properly

### Root Cause

Summary stored as markdown, but displayed as plain text without parsing.

### Solution

**Created Markdown to HTML Converter** (`app/sessions/[id]/page.tsx`):

```typescript
const formatSummaryMarkdown = (markdown: string): string => {
  let html = markdown

  // Convert headings
  html = html.replace(/^## (.*)$/gim, '<h2>$1</h2>')

  // Convert bold text with highlighting
  html = html.replace(/\*\*(.*?)\*\*/g,
    '<strong class="bg-yellow-100">$1</strong>')

  // Convert speaker names
  html = html.replace(/\[Speaker (\d+)\]/gi,
    '<span class="bg-blue-100">Speaker $1</span>')

  // Convert lists, blockquotes, etc.
  // ...

  return html
}
```

**Used dangerouslySetInnerHTML** (safe in this context):

```typescript
<div
  dangerouslySetInnerHTML={{
    __html: formatSummaryMarkdown(session.summary)
  }}
/>
```

### Code Reference

- File: `app/sessions/[id]/page.tsx` (lines 294-400)
- Function: `formatSummaryMarkdown()`

### Lessons Learned

1. Parse markdown on client side for better performance
2. Use CSS classes for styling instead of inline styles
3. Sanitize HTML if user-generated content

---

## Summary

These problems taught us:

1. **Always have fallbacks** for external API dependencies
2. **On-demand is often better** than real-time for cost and UX
3. **Environment variables** must load before modules that use them
4. **Type safety** requires careful attention to browser API types
5. **Chunking and caching** are essential for large data
6. **CORS and initialization order** matter for WebSocket connections
7. **Client-side rendering** can simplify markdown display

Most issues were resolved through:
- Better error handling
- Fallback mechanisms
- Proper configuration
- Type safety improvements
- User experience considerations

