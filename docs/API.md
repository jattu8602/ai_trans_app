# API Documentation

Complete reference for all REST API endpoints and Socket.io events in ScribeAI.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: Set via `NEXT_PUBLIC_APP_URL` environment variable

## Authentication

ScribeAI uses **device-based authentication**. All requests require a `deviceId` query parameter or in the request body.

**Device ID Format**: UUID v4

Example: `de582fec-6a50-4d73-89fd-86663ea0230c`

## REST API Endpoints

### User Management

#### Create or Get User by Device ID

```http
POST /api/users/device
Content-Type: application/json

{
  "deviceId": "de582fec-6a50-4d73-89fd-86663ea0230c"
}
```

**Response**:
```json
{
  "user": {
    "id": "clx123...",
    "deviceId": "de582fec-6a50-4d73-89fd-86663ea0230c",
    "name": null,
    "lastSyncedAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "sessions": [...]
}
```

---

### Session Management

#### Get All Sessions

```http
GET /api/sessions?deviceId={deviceId}
```

**Query Parameters**:
- `deviceId` (required): User's device ID

**Response**:
```json
{
  "sessions": [
    {
      "id": "clx123...",
      "title": "Meeting with Team",
      "transcript": null,
      "summary": null,
      "status": "completed",
      "duration": 1800,
      "chunksCount": 60,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Create New Session

```http
POST /api/sessions
Content-Type: application/json

{
  "deviceId": "de582fec-6a50-4d73-89fd-86663ea0230c",
  "title": "Optional Session Title",
  "status": "pending"
}
```

**Response**:
```json
{
  "session": {
    "id": "clx123...",
    "title": "Optional Session Title",
    "status": "pending",
    "chunksCount": 0,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Get Session by ID

```http
GET /api/sessions/{sessionId}?deviceId={deviceId}
```

**Response**:
```json
{
  "session": {
    "id": "clx123...",
    "title": "Meeting with Team",
    "transcript": "Full transcript text...",
    "summary": "AI-generated summary...",
    "status": "completed",
    "duration": 1800,
    "chunksCount": 60,
    "recordingStartedAt": "2024-01-15T10:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Update Session

```http
PUT /api/sessions/{sessionId}
Content-Type: application/json

{
  "deviceId": "de582fec-6a50-4d73-89fd-86663ea0230c",
  "title": "Updated Title",
  "status": "completed",
  "duration": 1800
}
```

**Response**: Updated session object

#### Delete Session

```http
DELETE /api/sessions/{sessionId}?deviceId={deviceId}
```

**Response**:
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

---

### Audio Chunks

#### Upload Audio Chunk

```http
POST /api/sessions/{sessionId}/chunks
Content-Type: multipart/form-data

chunk: [File] (audio/webm)
chunkIndex: 0
duration: 30.5
deviceId: de582fec-6a50-4d73-89fd-86663ea0230c
transcript: null (optional)
```

**Response**:
```json
{
  "chunk": {
    "id": "clx123-0",
    "chunkIndex": 0,
    "duration": 30.5,
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

#### Get All Chunks for Session

```http
GET /api/sessions/{sessionId}/chunks?deviceId={deviceId}
```

**Response**:
```json
{
  "chunks": [
    {
      "id": "clx123-0",
      "chunkIndex": 0,
      "duration": 30.5,
      "timestamp": "2024-01-15T10:00:00Z",
      "audioData": "base64encodedaudio...",
      "transcript": null
    }
  ]
}
```

---

### Transcription

#### Transcribe Session

```http
POST /api/sessions/{sessionId}/transcribe?deviceId={deviceId}
```

**Process**:
1. Fetches all audio chunks for the session
2. Combines chunks into single audio buffer
3. Sends to Deepgram API for transcription
4. Updates session with full transcript
5. Sets status to "transcribed"

**Response**:
```json
{
  "transcript": "Full transcript of the entire session...",
  "status": "transcribed"
}
```

**Error Response**:
```json
{
  "error": "Session not found",
  "status": 404
}
```

#### Direct Transcription (Utility Endpoint)

```http
POST /api/transcribe
Content-Type: multipart/form-data

audio: [File] (audio/webm or audio/wav)
```

**Response**:
```json
{
  "transcript": "Transcribed text from audio file..."
}
```

---

### Summary Generation

#### Generate Summary

```http
POST /api/sessions/{sessionId}/summary?deviceId={deviceId}
```

**Process**:
1. Fetches session transcript
2. Sends to Gemini API with system prompt
3. Updates session with generated summary
4. Sets status to "completed"

**Response**:
```json
{
  "summary": "## Meeting Summary\n\n**Overview/Context:**\n...",
  "status": "completed"
}
```

**Error Response** (if transcript missing):
```json
{
  "error": "Session transcript not found. Please generate transcript first.",
  "status": 400
}
```

---

## Socket.io Events

### Connection

**Server Path**: `/api/socket`

**Client Connection**:
```typescript
import { io } from 'socket.io-client'

const socket = io('/', {
  path: '/api/socket',
  transports: ['websocket', 'polling'],
})
```

### Client → Server Events

#### Join Session Room

```typescript
socket.emit('session:join', sessionId)
```

**Purpose**: Join a Socket.io room to receive session-specific updates

**Parameters**:
- `sessionId` (string): Session ID to join

#### Leave Session Room

```typescript
socket.emit('session:leave', sessionId)
```

**Purpose**: Leave a session room

**Parameters**:
- `sessionId` (string): Session ID to leave

#### Send Transcription Segment

```typescript
socket.emit('transcription:segment', {
  sessionId: 'clx123...',
  chunkIndex: 0,
  transcript: 'Partial transcript...',
  isFinal: false,
  timestamp: Date.now()
})
```

**Purpose**: Send real-time transcription updates (currently not used in on-demand flow)

#### Mark Chunk Complete

```typescript
socket.emit('transcription:chunk-complete', {
  sessionId: 'clx123...',
  chunkIndex: 0,
  transcript: 'Final transcript for chunk...'
})
```

**Purpose**: Mark a chunk's transcription as complete

### Server → Client Events

#### Transcription Updated

```typescript
socket.on('transcription:updated', (data) => {
  console.log(data)
  // {
  //   sessionId: 'clx123...',
  //   chunkIndex: 0,
  //   transcript: 'Transcript text...',
  //   mergedTranscript: 'Full merged transcript...',
  //   isFinal: true
  // }
})
```

**Purpose**: Receive real-time transcript updates

**Data Structure**:
```typescript
{
  sessionId: string
  chunkIndex: number
  transcript: string
  mergedTranscript: string  // All chunks combined
  isFinal: boolean
}
```

#### Transcription Error

```typescript
socket.on('transcription:error', (error) => {
  console.error(error)
  // {
  //   sessionId: 'clx123...',
  //   error: 'Error message...'
  // }
})
```

**Purpose**: Receive transcription error notifications

**Data Structure**:
```typescript
{
  sessionId?: string
  error: string
  details?: any  // Additional error details
}
```

#### Session Status Update

```typescript
socket.on('session:status', (data) => {
  console.log(data)
  // {
  //   sessionId: 'clx123...',
  //   status: 'processing' | 'completed' | 'error'
  // }
})
```

**Purpose**: Receive session status changes

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "status": 400
}
```

### Common Error Codes

- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (missing/invalid deviceId)
- `404`: Not Found (session/user doesn't exist)
- `500`: Internal Server Error

### Error Examples

**Missing deviceId**:
```json
{
  "error": "deviceId query parameter is required",
  "status": 400
}
```

**Session Not Found**:
```json
{
  "error": "Session not found",
  "status": 404
}
```

**Invalid Device ID**:
```json
{
  "error": "Invalid device ID format",
  "status": 400
}
```

---

## Rate Limiting

Currently, there are no rate limits implemented. For production, consider:

- **API Routes**: 100 requests/minute per deviceId
- **Transcription**: 10 transcriptions/hour per deviceId
- **Summary**: 20 summaries/hour per deviceId

---

## Request/Response Examples

### Complete Workflow Example

```typescript
// 1. Create session
const sessionRes = await fetch('/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'de582fec-6a50-4d73-89fd-86663ea0230c',
    title: 'Team Meeting'
  })
})
const { session } = await sessionRes.json()

// 2. Upload chunk
const formData = new FormData()
formData.append('chunk', audioBlob, 'chunk-0.webm')
formData.append('chunkIndex', '0')
formData.append('duration', '30.5')
formData.append('deviceId', 'de582fec-6a50-4d73-89fd-86663ea0230c')

await fetch(`/api/sessions/${session.id}/chunks`, {
  method: 'POST',
  body: formData
})

// 3. Generate transcript
await fetch(
  `/api/sessions/${session.id}/transcribe?deviceId=de582fec-6a50-4d73-89fd-86663ea0230c`,
  { method: 'POST' }
)

// 4. Generate summary
await fetch(
  `/api/sessions/${session.id}/summary?deviceId=de582fec-6a50-4d73-89fd-86663ea0230c`,
  { method: 'POST' }
)
```

---

## Testing

### Test Transcription Script

```bash
pnpm run transcribe-session <sessionId> [deviceId]
```

Example:
```bash
pnpm run transcribe-session cmi91rmes000dn0uuqn95oumu
```

This script:
1. Fetches all chunks for the session
2. Combines audio chunks
3. Sends to transcription API
4. Displays transcript and statistics

---

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Setup Guide](./SETUP.md)
- [Usage Guide](./USAGE.md)
- [Problems & Solutions](./PROBLEMS.md)

