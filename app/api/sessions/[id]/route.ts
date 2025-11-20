import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSessionSchema = z.object({
  deviceId: z.string().uuid(),
  title: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  status: z
    .enum(['pending', 'recording', 'paused', 'processing', 'completed'])
    .optional(),
  duration: z.number().int().nonnegative().nullable().optional(),
})

/**
 * GET /api/sessions/[id]?deviceId=...
 * Fetches a single session by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const deviceId = searchParams.get('deviceId')

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId query parameter is required' },
        { status: 400 }
      )
    }

    // Validate UUID format
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

    // Find session and verify it belongs to this user
    const session = await prisma.session.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        transcript: session.transcript,
        summary: session.summary,
        status: session.status,
        duration: session.duration,
        chunksCount: session.chunksCount,
        recordingStartedAt: session.recordingStartedAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/sessions/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/sessions/[id]
 * Updates a session
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { deviceId, ...updateData } = updateSessionSchema.parse(body)

    // Find user by deviceId
    const user = await prisma.user.findUnique({
      where: { deviceId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify session belongs to this user
    const existingSession = await prisma.session.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Prepare update data
    const dataToUpdate: any = { ...updateData }

    // If status is being set to recording and recordingStartedAt is not set, set it
    if (dataToUpdate.status === 'recording') {
      const session = await prisma.session.findUnique({
        where: { id },
        select: { recordingStartedAt: true },
      })
      if (!session?.recordingStartedAt) {
        dataToUpdate.recordingStartedAt = new Date()
      }
    }

    // Update session
    const session = await prisma.session.update({
      where: { id },
      data: dataToUpdate,
    })

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        transcript: session.transcript,
        summary: session.summary,
        status: session.status,
        duration: session.duration,
        chunksCount: session.chunksCount,
        recordingStartedAt: session.recordingStartedAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error in PUT /api/sessions/[id]:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sessions/[id]?deviceId=...
 * Deletes a session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const deviceId = searchParams.get('deviceId')

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId query parameter is required' },
        { status: 400 }
      )
    }

    // Validate UUID format
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

    // Verify session belongs to this user
    const existingSession = await prisma.session.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Delete session
    await prisma.session.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/sessions/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
