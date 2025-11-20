/**
 * Socket.io server setup
 * Handles real-time transcription streaming and persistence
 */

import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import { persistTranscriptionSegment } from './transcription-handler'
import { z } from 'zod'

// Schema for transcription segment
const transcriptionSegmentSchema = z.object({
  sessionId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  transcript: z.string(),
  isFinal: z.boolean(),
  timestamp: z.number().optional(),
})

// Schema for chunk complete
const chunkCompleteSchema = z.object({
  sessionId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  transcript: z.string(),
})

let io: SocketIOServer | null = null

/**
 * Initialize Socket.io server
 */
export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.NEXT_PUBLIC_APP_URL
          : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id)

    // Join session room
    socket.on('session:join', (sessionId: string) => {
      if (typeof sessionId === 'string' && sessionId) {
        socket.join(`session:${sessionId}`)
        console.log(
          `[Socket.io] Client ${socket.id} joined session: ${sessionId}`
        )
      }
    })

    // Leave session room
    socket.on('session:leave', (sessionId: string) => {
      if (typeof sessionId === 'string' && sessionId) {
        socket.leave(`session:${sessionId}`)
        console.log(
          `[Socket.io] Client ${socket.id} left session: ${sessionId}`
        )
      }
    })

    // Handle transcription segment
    socket.on('transcription:segment', async (data: unknown) => {
      try {
        const segment = transcriptionSegmentSchema.parse(data)

        console.log('[Socket.io] Received transcription segment:', {
          sessionId: segment.sessionId,
          chunkIndex: segment.chunkIndex,
          isFinal: segment.isFinal,
          transcriptLength: segment.transcript.length,
        })

        // Persist to database
        const result = await persistTranscriptionSegment(segment)

        if (result.success) {
          // Get all chunks for this session to build merged transcript
          const { prisma } = await import('@/lib/prisma')
          // Use type assertion for Prisma client (model name is correct)
          const chunks = await (prisma as any).audioChunk.findMany({
            where: {
              sessionId: segment.sessionId,
              transcript: { not: null },
            },
            orderBy: { chunkIndex: 'asc' },
            select: { transcript: true },
          })

          const mergedTranscript = chunks
            .map((chunk: { transcript: string | null }) => chunk.transcript)
            .filter((t: string | null): t is string => t !== null)
            .join(' ')
            .trim()

          // Broadcast update to all clients in session room
          io?.to(`session:${segment.sessionId}`).emit('transcription:updated', {
            sessionId: segment.sessionId,
            chunkIndex: segment.chunkIndex,
            transcript: segment.transcript,
            mergedTranscript,
            isFinal: segment.isFinal,
          })
        } else {
          socket.emit('transcription:error', {
            sessionId: segment.sessionId,
            error: result.error || 'Failed to persist transcription',
          })
        }
      } catch (error) {
        console.error(
          '[Socket.io] Error handling transcription segment:',
          error
        )
        if (error instanceof z.ZodError) {
          socket.emit('transcription:error', {
            error: 'Invalid transcription segment data',
            details: error.issues,
          })
        } else {
          socket.emit('transcription:error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    })

    // Handle chunk complete
    socket.on('transcription:chunk-complete', async (data: unknown) => {
      try {
        const chunkData = chunkCompleteSchema.parse(data)

        console.log('[Socket.io] Received chunk complete:', {
          sessionId: chunkData.sessionId,
          chunkIndex: chunkData.chunkIndex,
        })

        // Persist final transcript
        const result = await persistTranscriptionSegment({
          sessionId: chunkData.sessionId,
          chunkIndex: chunkData.chunkIndex,
          transcript: chunkData.transcript,
          isFinal: true,
        })

        if (result.success) {
          // Get merged transcript
          const { prisma } = await import('@/lib/prisma')
          const chunks = await (prisma as any).audioChunk.findMany({
            where: {
              sessionId: chunkData.sessionId,
              transcript: { not: null },
            },
            orderBy: { chunkIndex: 'asc' },
            select: { transcript: true },
          })

          const mergedTranscript = chunks
            .map((chunk: { transcript: string | null }) => chunk.transcript)
            .filter((t: string | null): t is string => t !== null)
            .join(' ')
            .trim()

          // Broadcast final update
          io?.to(`session:${chunkData.sessionId}`).emit(
            'transcription:updated',
            {
              sessionId: chunkData.sessionId,
              chunkIndex: chunkData.chunkIndex,
              transcript: chunkData.transcript,
              mergedTranscript,
              isFinal: true,
            }
          )
        }
      } catch (error) {
        console.error('[Socket.io] Error handling chunk complete:', error)
        socket.emit('transcription:error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('[Socket.io] Client disconnected:', socket.id)
    })

    // Handle errors
    socket.on('error', (error) => {
      console.error('[Socket.io] Socket error:', error)
    })
  })

  return io
}

/**
 * Get Socket.io server instance
 */
export function getSocketIO(): SocketIOServer | null {
  return io
}
