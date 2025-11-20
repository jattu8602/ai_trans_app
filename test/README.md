# Deepgram Test Files

## Simple Deepgram Test

Run the basic Deepgram test to understand how it works:

```bash
pnpm tsx test/deepgram-test.ts
```

This will:
- Verify your API key is set
- Show how Deepgram client is initialized
- Explain how transcription works in the app
- Test API connection

## How Deepgram Works

### 1. File Transcription (Current Implementation)

```typescript
// 1. Create client
const deepgram = createClient(apiKey)

// 2. Read audio file
const buffer = Buffer.from(audioFile)

// 3. Transcribe
const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
  buffer,
  {
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    punctuate: true,
  }
)

// 4. Get transcript
const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript
```

### 2. Live Transcription (Streaming)

```typescript
// 1. Create live connection
const connection = deepgram.listen.live({
  model: 'nova-2',
  language: 'en',
  interim_results: true,
})

// 2. Send audio chunks
connection.send(audioChunk)

// 3. Receive transcripts
connection.on('Transcript', (data) => {
  const transcript = data.channel?.alternatives?.[0]?.transcript
  const isFinal = data.is_final
})
```

## Current App Flow

1. **Recording**: Audio is captured in 30-second chunks
2. **Transcription**: Each chunk is sent to `/api/transcribe` endpoint
3. **Storage**: Chunk + transcript saved to database together
4. **Display**: Transcripts shown in session details page

## Files

- `deepgram-test.ts` - Simple test file
- `lib/deepgram-file.ts` - Client-side file transcription helper
- `lib/deepgram.ts` - Live transcription (for future use)
- `app/api/transcribe/route.ts` - Server-side transcription API

