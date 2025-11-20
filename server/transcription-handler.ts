/**
 * Server-side transcription handler
 * Handles persisting transcription segments to database
 */

// Lazy import prisma to avoid loading before env vars are set
// import { prisma } from '@/lib/prisma'

export interface TranscriptionSegment {
  sessionId: string
  chunkIndex: number
  transcript: string
  isFinal: boolean
  timestamp?: number
}

/**
 * Persist transcription segment to database
 */
export async function persistTranscriptionSegment(
  segment: TranscriptionSegment
): Promise<{ success: boolean; error?: string }> {
  try {
    // Lazy import prisma to ensure env vars are loaded first
    const { prisma } = await import('@/lib/prisma')
    const { sessionId, chunkIndex, transcript, isFinal } = segment

    // Find or create the chunk
    const chunkId = `${sessionId}-${chunkIndex}`
    const existingChunk = await (prisma as any).audioChunk.findUnique({
      where: { id: chunkId },
      select: { transcript: true },
    })

    let updatedTranscript = transcript

    if (existingChunk?.transcript && !isFinal) {
      // Append to existing transcript for interim results
      updatedTranscript = `${existingChunk.transcript} ${transcript}`.trim()
    } else if (existingChunk?.transcript && isFinal) {
      // For final results, replace interim with final
      // Remove any interim text and add final
      updatedTranscript = `${existingChunk.transcript.replace(/\s+\S+$/, '')} ${transcript}`.trim()
    }

    // Update or create chunk with transcript
    await (prisma as any).audioChunk.upsert({
      where: { id: chunkId },
      update: {
        transcript: updatedTranscript,
        updatedAt: new Date(),
      },
      create: {
        id: chunkId,
        sessionId,
        chunkIndex,
        transcript: updatedTranscript,
        duration: 30, // Default, will be updated when chunk is uploaded
        timestamp: new Date(),
      },
    })

    // Update session transcript by merging all chunks
    await updateSessionTranscript(sessionId)

    return { success: true }
  } catch (error) {
    console.error('[transcription-handler] Error persisting segment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update session transcript by merging all chunk transcripts
 */
async function updateSessionTranscript(sessionId: string): Promise<void> {
  try {
    // Lazy import prisma to ensure env vars are loaded first
    const { prisma } = await import('@/lib/prisma')
    const chunks = await (prisma as any).audioChunk.findMany({
      where: {
        sessionId,
        transcript: { not: null },
      },
      orderBy: { chunkIndex: 'asc' },
      select: { transcript: true },
    })

    const mergedTranscript = chunks
      .map((chunk) => chunk.transcript)
      .filter((t): t is string => t !== null)
      .join(' ')
      .trim()

    if (mergedTranscript) {
      await (prisma as any).session.update({
        where: { id: sessionId },
        data: { transcript: mergedTranscript },
      })
    }
  } catch (error) {
    console.error('[transcription-handler] Error updating session transcript:', error)
    // Don't throw - this is a background operation
  }
}

