import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * PUT /api/sessions/[id]/chunks/[chunkIndex]/transcript
 * Update transcript for an existing chunk
 */
export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; chunkIndex: string }>
  }
) {
  try {
    const { id: sessionId, chunkIndex: chunkIndexStr } = await params
    const formData = await request.formData()

    const transcript = formData.get('transcript') as string | null
    const deviceId = formData.get('deviceId') as string

    if (!transcript || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required fields: transcript, deviceId' },
        { status: 400 }
      )
    }

    // Validate deviceId
    try {
      z.string().uuid().parse(deviceId)
    } catch {
      return NextResponse.json(
        { error: 'Invalid device ID format' },
        { status: 400 }
      )
    }

    const chunkIndex = parseInt(chunkIndexStr, 10)
    if (isNaN(chunkIndex)) {
      return NextResponse.json(
        { error: 'Invalid chunk index' },
        { status: 400 }
      )
    }

    // Find user by deviceId
    const user = await prisma.user.findUnique({
      where: { deviceId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify session belongs to user
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Find the chunk
    const chunkId = `${sessionId}-${chunkIndex}`
    const existingChunk = await prisma.audioChunk.findUnique({
      where: { id: chunkId },
    })

    if (!existingChunk) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      )
    }

    // Log transcript before saving
    console.log(`[API /chunks/[chunkIndex]/transcript] 💾 Saving transcript for chunk ${chunkIndex} (session: ${sessionId}):`, {
      chunkIndex,
      sessionId,
      transcriptLength: transcript.length,
      wordCount: transcript.split(/\s+/).length,
      preview: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
      fullTranscript: transcript, // Log full transcript for debugging
    })

    // Update chunk with transcript
    const updatedChunk = await prisma.audioChunk.update({
      where: { id: chunkId },
      data: {
        transcript: transcript,
        updatedAt: new Date(),
      },
    })

    // Update session transcript by merging all chunks
    const allChunks = await prisma.audioChunk.findMany({
      where: {
        sessionId,
        transcript: { not: null },
      },
      orderBy: { chunkIndex: 'asc' },
      select: { transcript: true, chunkIndex: true },
    })

    const mergedTranscript = allChunks
      .map((chunk) => chunk.transcript)
      .filter((t): t is string => t !== null)
      .join(' ')
      .trim()

    if (mergedTranscript) {
      console.log(`[API /chunks/[chunkIndex]/transcript] 🔗 Merged session transcript (session: ${sessionId}):`, {
        sessionId,
        totalChunks: allChunks.length,
        chunksWithTranscript: allChunks.filter(c => c.transcript).length,
        mergedLength: mergedTranscript.length,
        mergedWordCount: mergedTranscript.split(/\s+/).length,
        preview: mergedTranscript.substring(0, 200) + (mergedTranscript.length > 200 ? '...' : ''),
        fullMergedTranscript: mergedTranscript, // Log full merged transcript for debugging
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: { transcript: mergedTranscript },
      })
    } else {
      console.log(`[API /chunks/[chunkIndex]/transcript] ⚠️ No merged transcript (no chunks with transcripts)`)
    }

    return NextResponse.json({
      success: true,
      chunk: {
        id: updatedChunk.id,
        chunkIndex: updatedChunk.chunkIndex,
        transcript: updatedChunk.transcript,
      },
    })
  } catch (error) {
    console.error(
      'Error in PUT /api/sessions/[id]/chunks/[chunkIndex]/transcript:',
      error
    )
    return NextResponse.json(
      { error: 'Failed to update chunk transcript' },
      { status: 500 }
    )
  }
}

