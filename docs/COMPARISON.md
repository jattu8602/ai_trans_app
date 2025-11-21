# Architecture Comparison & Decisions

This document outlines key architectural decisions, trade-offs, and comparisons made during ScribeAI development.

## Transcription: Real-Time vs On-Demand

### Real-Time Transcription (Initial Plan)

**Approach**: Transcribe each 30-second chunk immediately as it's recorded.

**Pros**:
- ✅ Immediate feedback
- ✅ Live transcript display
- ✅ Better UX for some use cases

**Cons**:
- ❌ High API costs (60+ calls for 1-hour session)
- ❌ Complex state management
- ❌ Hard to retry failed transcriptions
- ❌ Performance issues with streaming
- ❌ User may not always want transcription

### On-Demand Transcription (Implemented)

**Approach**: Record all chunks, transcribe only when user requests it.

**Pros**:
- ✅ Cost-effective (1 API call per session)
- ✅ User controls when to transcribe
- ✅ Can retry if transcription fails
- ✅ Simpler state management
- ✅ Better for long sessions

**Cons**:
- ❌ No live transcript during recording
- ❌ User must wait for transcription

**Decision**: **On-Demand** - Better cost/benefit ratio and user control.

---

## Transcription API: Gemini vs Deepgram

### Google Gemini (Initial Plan)

**Approach**: Use Gemini API for both transcription and summarization.

**Pros**:
- ✅ Single API to manage
- ✅ Good for summaries
- ✅ Free tier available

**Cons**:
- ❌ Model compatibility issues (404 errors)
- ❌ Not optimized for real-time transcription
- ❌ Higher latency
- ❌ Less accurate for audio transcription

### Deepgram (Implemented)

**Approach**: Use Deepgram for transcription, Gemini for summaries.

**Pros**:
- ✅ Optimized for audio transcription
- ✅ Lower latency
- ✅ Better accuracy
- ✅ Handles multiple languages well
- ✅ Stable API

**Cons**:
- ❌ Separate API to manage
- ❌ Pay-per-minute pricing

**Decision**: **Deepgram for Transcription** - Better performance and accuracy for audio.

---

## Audio Storage: Database vs Cloud Storage

### PostgreSQL Base64 (Current)

**Approach**: Store audio chunks as base64-encoded strings in PostgreSQL.

**Pros**:
- ✅ Simple implementation
- ✅ No additional services needed
- ✅ Easy to query and retrieve
- ✅ Works for development

**Cons**:
- ❌ Database size grows quickly
- ❌ 33% storage overhead (base64)
- ❌ Slower for large files
- ❌ Not scalable for production

### Cloud Storage (Future)

**Approach**: Store audio files in S3/Cloud Storage, store URLs in database.

**Pros**:
- ✅ Scalable storage
- ✅ CDN integration possible
- ✅ Cost-effective for large files
- ✅ Better performance

**Cons**:
- ❌ Additional service to manage
- ❌ More complex implementation
- ❌ Additional costs

**Decision**: **PostgreSQL for MVP** - Simple and sufficient. **Cloud Storage for Production** - Better scalability.

---

## State Management: XState vs React Hooks

### XState (Planned)

**Approach**: Use XState state machine for recording state management.

**Pros**:
- ✅ Formal state machine
- ✅ Better for complex flows
- ✅ Visual state diagrams
- ✅ Predictable transitions

**Cons**:
- ❌ Additional dependency
- ❌ Learning curve
- ❌ Overkill for current complexity

### React Hooks (Implemented)

**Approach**: Use React hooks (useState, useEffect) for state management.

**Pros**:
- ✅ No additional dependencies
- ✅ Simple and familiar
- ✅ Sufficient for current needs
- ✅ Easy to understand

**Cons**:
- ❌ Less formal state management
- ❌ Can become complex with more states

**Decision**: **React Hooks** - Sufficient for current complexity. XState can be added later if needed.

---

## Authentication: Better Auth vs Device-Based

### Better Auth (Planned)

**Approach**: Use Better Auth library for user authentication.

**Pros**:
- ✅ Full authentication system
- ✅ Multiple providers (OAuth, email, etc.)
- ✅ Session management
- ✅ Security best practices

**Cons**:
- ❌ Additional dependency
- ❌ More complex setup
- ❌ Overkill for MVP

### Device-Based (Implemented)

**Approach**: Identify users by device UUID stored in localStorage.

**Pros**:
- ✅ Simple implementation
- ✅ No authentication UI needed
- ✅ Works immediately
- ✅ Sufficient for MVP

**Cons**:
- ❌ No multi-device sync
- ❌ Less secure
- ❌ No user accounts

**Decision**: **Device-Based for MVP** - Simple and sufficient. Better Auth can be added for production.

---

## Audio Capture: WebRTC vs MediaRecorder

### WebRTC (Considered)

**Approach**: Use WebRTC for audio streaming.

**Pros**:
- ✅ Lower latency
- ✅ Better for real-time
- ✅ More control

**Cons**:
- ❌ More complex implementation
- ❌ Requires signaling server
- ❌ Overkill for file-based approach

### MediaRecorder (Implemented)

**Approach**: Use MediaRecorder API for audio capture.

**Pros**:
- ✅ Simple API
- ✅ Built-in chunking
- ✅ File-based output
- ✅ Sufficient for needs

**Cons**:
- ❌ Slightly higher latency
- ❌ Less control over encoding

**Decision**: **MediaRecorder** - Simpler and sufficient for file-based transcription.

---

## Chunking Strategy: 30s vs Variable

### 30-Second Chunks (Implemented)

**Approach**: Fixed 30-second chunk duration.

**Pros**:
- ✅ Predictable chunk sizes
- ✅ Easy to manage
- ✅ Good balance (not too small/large)
- ✅ Consistent API calls

**Cons**:
- ❌ May not align with natural speech boundaries
- ❌ Fixed size regardless of content

### Variable Chunks (Considered)

**Approach**: Chunk based on silence detection or speech boundaries.

**Pros**:
- ✅ More natural boundaries
- ✅ Better for transcription accuracy

**Cons**:
- ❌ More complex implementation
- ❌ Unpredictable chunk sizes
- ❌ Harder to manage

**Decision**: **30-Second Fixed Chunks** - Simpler and sufficient. Variable chunking can be added later.

---

## Summary Generation: Real-Time vs Post-Processing

### Real-Time (Considered)

**Approach**: Generate summary as transcript is being created.

**Pros**:
- ✅ Immediate summary
- ✅ Better UX

**Cons**:
- ❌ Incomplete transcript = incomplete summary
- ❌ Multiple API calls
- ❌ Higher costs

### Post-Processing (Implemented)

**Approach**: Generate summary only after full transcript is complete.

**Pros**:
- ✅ Complete context
- ✅ Single API call
- ✅ Better summary quality
- ✅ Cost-effective

**Cons**:
- ❌ User must wait
- ❌ Not real-time

**Decision**: **Post-Processing** - Better quality and cost-effectiveness.

---

## Socket.io: Real-Time vs Polling

### Socket.io (Implemented)

**Approach**: Use Socket.io for real-time updates.

**Pros**:
- ✅ Real-time communication
- ✅ Efficient (WebSocket)
- ✅ Room-based broadcasting
- ✅ Event-driven

**Cons**:
- ❌ Additional server complexity
- ❌ Connection management needed

### Polling (Considered)

**Approach**: Poll API endpoints for updates.

**Pros**:
- ✅ Simpler (no WebSocket server)
- ✅ Stateless

**Cons**:
- ❌ Higher server load
- ❌ Delayed updates
- ❌ Less efficient

**Decision**: **Socket.io** - Better for real-time updates and user experience.

---

## Database: PostgreSQL vs MongoDB

### PostgreSQL (Implemented)

**Approach**: Use PostgreSQL with Prisma ORM.

**Pros**:
- ✅ Relational data (sessions, chunks, users)
- ✅ ACID transactions
- ✅ Strong consistency
- ✅ Prisma ORM (type-safe)

**Cons**:
- ❌ Less flexible schema
- ❌ Requires migrations

### MongoDB (Considered)

**Approach**: Use MongoDB for document storage.

**Pros**:
- ✅ Flexible schema
- ✅ Good for nested data
- ✅ Easy to scale

**Cons**:
- ❌ Less type safety
- ❌ Weaker consistency
- ❌ Not ideal for relational data

**Decision**: **PostgreSQL** - Better for relational data and type safety.

---

## Summary Table

| Decision | Chosen | Alternative | Reason |
|----------|--------|-------------|--------|
| Transcription Timing | On-Demand | Real-Time | Cost & user control |
| Transcription API | Deepgram | Gemini | Better accuracy & performance |
| Audio Storage | PostgreSQL (MVP) | Cloud Storage | Simplicity for MVP |
| State Management | React Hooks | XState | Sufficient complexity |
| Authentication | Device-Based | Better Auth | Simplicity for MVP |
| Audio Capture | MediaRecorder | WebRTC | Simpler implementation |
| Chunking | 30s Fixed | Variable | Predictable & manageable |
| Summary Timing | Post-Processing | Real-Time | Better quality |
| Real-Time Updates | Socket.io | Polling | Better UX |
| Database | PostgreSQL | MongoDB | Better for relational data |

## Key Principles

1. **Simplicity First**: Choose simpler solutions when they're sufficient
2. **Cost-Effective**: Optimize for API costs (on-demand vs real-time)
3. **User Control**: Give users control over expensive operations
4. **Scalability Ready**: Architecture allows for future improvements
5. **Type Safety**: Prefer type-safe solutions (TypeScript, Prisma)

## Future Improvements

Based on these comparisons, future improvements include:

1. **Cloud Storage**: Move audio to S3/Cloud Storage
2. **Better Auth**: Add proper authentication for production
3. **Variable Chunking**: Implement silence detection
4. **XState**: Add if state management becomes complex
5. **WebRTC**: Consider for real-time use cases

## Lessons Learned

1. **On-demand is often better** than real-time for cost and UX
2. **Right tool for the job**: Deepgram for transcription, Gemini for summaries
3. **Start simple**: Device-based auth sufficient for MVP
4. **Plan for scale**: Architecture allows for future improvements
5. **User control**: Let users decide when to use expensive operations

These decisions balance simplicity, cost, and functionality while maintaining the ability to scale and improve in the future.

