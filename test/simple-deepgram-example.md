# Simple Deepgram Speech-to-Text Example

## Basic Usage

### Step 1: Install Dependencies
```bash
pnpm add @deepgram/sdk
```

### Step 2: Get API Key
1. Sign up at https://deepgram.com
2. Get your API key
3. Add to `.env`:
```
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_api_key_here
```

### Step 3: Simple Code Example

```typescript
import { createClient } from '@deepgram/sdk'

// 1. Create client
const deepgram = createClient('your_api_key')

// 2. Read audio file (or get from Blob/File)
const audioBuffer = Buffer.from(audioFile)

// 3. Transcribe
const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
  audioBuffer,
  {
    model: 'nova-2',        // Best accuracy model
    language: 'en',         // Primary language
    smart_format: true,     // Auto-format (capitalization, etc.)
    punctuate: true,        // Add punctuation
  }
)

// 4. Get the transcript
if (error) {
  console.error('Error:', error)
} else {
  const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript
  console.log('Transcript:', transcript)
}
```

## How It Works in Our App

### Current Flow (Chunk-based):

```
1. User records audio
   ↓
2. MediaRecorder creates 30-second chunks
   ↓
3. Each chunk is sent to /api/transcribe
   ↓
4. Server converts Blob → Buffer
   ↓
5. Deepgram transcribes the chunk
   ↓
6. Transcript returned
   ↓
7. Chunk + transcript saved to database
```

### API Endpoint (`/api/transcribe`):

```typescript
// POST /api/transcribe
// Input: FormData with audio file
// Output: { transcript: string }

const formData = new FormData()
formData.append('audio', audioBlob)

const response = await fetch('/api/transcribe', {
  method: 'POST',
  body: formData,
})

const { transcript } = await response.json()
```

## Response Structure

Deepgram returns:
```json
{
  "results": {
    "channels": [{
      "alternatives": [{
        "transcript": "Hello, this is the transcribed text.",
        "confidence": 0.95
      }]
    }]
  }
}
```

We extract: `result.results.channels[0].alternatives[0].transcript`

## Supported Audio Formats

- WebM (what MediaRecorder produces)
- MP4
- WAV
- OGG
- And more...

## Language Support

- Primary: English (`en`)
- Auto-detect: Hindi, Hinglish, and other languages
- Deepgram automatically detects mixed languages

## Error Handling

```typescript
if (error) {
  if (error.status === 400) {
    // Bad format or corrupt data
    // Return empty transcript, still save chunk
  } else {
    // Other errors
    throw error
  }
}
```

## Test It

Run the test file:
```bash
pnpm tsx test/deepgram-test.ts
```

