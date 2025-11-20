import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * POST /api/sessions/[id]/chunks
 * Upload a 30-second audio chunk
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const formData = await request.formData()

    const chunk = formData.get('chunk') as File
    const chunkIndexStr = formData.get('chunkIndex') as string
    const durationStr = formData.get('duration') as string
    const deviceId = formData.get('deviceId') as string
    const transcript = formData.get('transcript') as string | null

    if (!chunk || !chunkIndexStr || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required fields: chunk, chunkIndex, deviceId' },
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

    // Convert file to base64 for storage
    // In production, you might want to use cloud storage (S3, etc.)
    const arrayBuffer = await chunk.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')

    const chunkIndex = parseInt(chunkIndexStr, 10)
    const duration = parseFloat(durationStr || '30')

    // Validate chunk index is sequential
    const existingChunks = await prisma.audioChunk.findMany({
      where: { sessionId },
      orderBy: { chunkIndex: 'desc' },
      take: 1,
      select: { chunkIndex: true },
    })

    if (existingChunks.length > 0) {
      const lastChunkIndex = existingChunks[0].chunkIndex
      const expectedIndex = lastChunkIndex + 1

      if (chunkIndex !== expectedIndex) {
        // Log warning but allow continuation (might be retry or out-of-order)
        console.warn(
          `Chunk index mismatch: expected ${expectedIndex}, got ${chunkIndex}. Session: ${sessionId}`
        )

        // If chunk index is way off, reject it
        if (chunkIndex < lastChunkIndex || chunkIndex > expectedIndex + 10) {
          return NextResponse.json(
            {
              error: `Invalid chunk index: expected ${expectedIndex}, got ${chunkIndex}`,
            },
            { status: 400 }
          )
        }
      }
    } else if (chunkIndex !== 0) {
      // First chunk should have index 0
      return NextResponse.json(
        {
          error: `First chunk must have index 0, got ${chunkIndex}`,
        },
        { status: 400 }
      )
    }

    // Check if chunk already exists
    const existingChunk = await prisma.audioChunk.findUnique({
      where: {
        id: `${sessionId}-${chunkIndex}`,
      },
    })

    let audioChunk
    let isNewChunk = false
    if (existingChunk) {
      // Update existing chunk
      audioChunk = await prisma.audioChunk.update({
        where: { id: `${sessionId}-${chunkIndex}` },
        data: {
          audioData: base64Data,
          duration,
          transcript: transcript || null,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new chunk
      isNewChunk = true
      audioChunk = await prisma.audioChunk.create({
        data: {
          id: `${sessionId}-${chunkIndex}`,
          sessionId,
          chunkIndex,
          audioData: base64Data,
          duration,
          transcript: transcript || null,
          timestamp: new Date(),
        },
      })
    }

    // Update session chunks count only if it's a new chunk
    if (isNewChunk) {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          chunksCount: {
            increment: 1,
          },
        },
      })
    }

    return NextResponse.json({
      chunk: {
        id: audioChunk.id,
        chunkIndex: audioChunk.chunkIndex,
        duration: audioChunk.duration,
        timestamp: audioChunk.timestamp,
      },
    })
  } catch (error) {
    console.error('Error in POST /api/sessions/[id]/chunks:', error)
    return NextResponse.json(
      { error: 'Failed to upload chunk' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sessions/[id]/chunks?deviceId=...
 * Get all chunks for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const searchParams = request.nextUrl.searchParams
    const deviceId = searchParams.get('deviceId')

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId query parameter is required' },
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

    // Get all chunks for this session
    const chunks = await prisma.audioChunk.findMany({
      where: { sessionId },
      orderBy: { chunkIndex: 'asc' },
    })

    return NextResponse.json({
      chunks: chunks.map(
        (chunk: {
          id: string
          chunkIndex: number
          duration: number
          timestamp: Date
          audioData: string | null
          transcript: string | null
        }) => ({
          id: chunk.id,
          chunkIndex: chunk.chunkIndex,
          duration: chunk.duration,
          timestamp: chunk.timestamp,
          audioData: chunk.audioData, // Base64 encoded
          transcript: chunk.transcript, // Transcript text
        })
      ),
    })
  } catch (error) {
    console.error('Error in GET /api/sessions/[id]/chunks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chunks' },
      { status: 500 }
    )
  }
}
