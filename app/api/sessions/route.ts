import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSessionSchema = z.object({
  deviceId: z.string().uuid(),
  title: z.string().optional(),
  status: z
    .enum(['pending', 'recording', 'paused', 'processing', 'completed'])
    .default('pending'),
})

const updateSessionSchema = z.object({
  deviceId: z.string().uuid(),
  title: z.string().optional(),
  transcript: z.string().optional(),
  summary: z.string().optional(),
  status: z
    .enum(['pending', 'recording', 'paused', 'processing', 'completed'])
    .optional(),
  duration: z.number().int().nonnegative().nullable().optional(),
})

/**
 * GET /api/sessions?deviceId=...
 * Fetches all sessions for a device user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceId = searchParams.get('deviceId')
    const limitParam = searchParams.get('limit')

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

    // Parse limit if provided
    let limit: number | undefined
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit
      }
    }

    // Find user by deviceId
    const user = await prisma.user.findUnique({
      where: { deviceId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please create user first.' },
        { status: 404 }
      )
    }

    // Fetch sessions for this user with optional limit
    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit, // Limit results if provided
    })

    return NextResponse.json({
      sessions: sessions.map((session) => ({
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
      })),
    })
  } catch (error) {
    console.error('Error in GET /api/sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sessions
 * Creates a new session for a device user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, title, status } = createSessionSchema.parse(body)

    // Find or create user by deviceId
    let user = await prisma.user.findUnique({
      where: { deviceId },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          deviceId,
          lastSyncedAt: new Date(),
        },
      })
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        title: title || null,
        status: status || 'pending',
      },
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
    console.error('Error in POST /api/sessions:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
