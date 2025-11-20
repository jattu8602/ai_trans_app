import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const deviceIdSchema = z.object({
  deviceId: z.string().uuid(),
})

/**
 * POST /api/users/device
 * Creates or retrieves a user by device ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId } = deviceIdSchema.parse(body)

    // Find or create user with this deviceId
    let user = await prisma.user.findUnique({
      where: { deviceId },
      include: {
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Limit to recent sessions
        },
      },
    })

    if (!user) {
      // Create new anonymous user
      user = await prisma.user.create({
        data: {
          deviceId,
          lastSyncedAt: new Date(),
        },
        include: {
          sessions: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })
    } else {
      // Update lastSyncedAt
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastSyncedAt: new Date() },
        include: {
          sessions: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        deviceId: user.deviceId,
        name: user.name,
        lastSyncedAt: user.lastSyncedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      sessions: user.sessions.map((session) => ({
        id: session.id,
        title: session.title,
        transcript: session.transcript,
        summary: session.summary,
        status: session.status,
        duration: session.duration,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Error in /api/users/device:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid device ID format', details: error.errors },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { error: 'Failed to create or retrieve user' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/users/device?deviceId=...
 * Retrieves a user by device ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceId = searchParams.get('deviceId')

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId query parameter is required' },
        { status: 400 },
      )
    }

    // Validate UUID format
    try {
      z.string().uuid().parse(deviceId)
    } catch {
      return NextResponse.json(
        { error: 'Invalid device ID format' },
        { status: 400 },
      )
    }

    const user = await prisma.user.findUnique({
      where: { deviceId },
      include: {
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        deviceId: user.deviceId,
        name: user.name,
        lastSyncedAt: user.lastSyncedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      sessions: user.sessions.map((session) => ({
        id: session.id,
        title: session.title,
        transcript: session.transcript,
        summary: session.summary,
        status: session.status,
        duration: session.duration,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Error in GET /api/users/device:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve user' },
      { status: 500 },
    )
  }
}

