import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { generateSummary } from '@/lib/gemini'

/**
 * POST /api/sessions/[id]/summary?deviceId=...
 * Generates a detailed summary from the session transcript using Gemini AI
 * Updates the session with the generated summary
 */
export async function POST(
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

    // Verify session belongs to user and get transcript
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get transcript from session or request body
    let transcript = session.transcript

    // Allow override from request body (for testing or if transcript needs to be provided)
    try {
      const body = await request.json().catch(() => null)
      if (body && body.transcript) {
        transcript = body.transcript
      }
    } catch {
      // Body parsing failed, use session transcript
    }

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'No transcript available for this session',
          message:
            'Please generate transcript first using /api/sessions/[id]/transcribe',
        },
        { status: 400 }
      )
    }

    console.log(`[Summary API] Generating summary for session ${sessionId}`, {
      transcriptLength: transcript.length,
      wordCount: transcript.split(/\s+/).length,
    })

    // Generate summary using Gemini
    const summary = await generateSummary(transcript)

    if (!summary || summary.trim().length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate summary - empty result from Gemini' },
        { status: 500 }
      )
    }

    // Update session with summary
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        summary: summary.trim(),
        status: 'completed', // Mark as completed
      },
    })

    console.log(
      `[Summary API] Summary generated and saved: ${summary.length} characters`
    )

    return NextResponse.json({
      summary: summary.trim(),
      message: 'Summary generated successfully',
    })
  } catch (error) {
    console.error('Error in POST /api/sessions/[id]/summary:', error)

    // Handle specific Gemini API errors
    if (error instanceof Error) {
      if (error.message.includes('GOOGLE_GEMINI_API_KEY')) {
        return NextResponse.json(
          {
            error: 'Gemini API key not configured',
            details: 'Please set GOOGLE_GEMINI_API_KEY environment variable',
          },
          { status: 500 }
        )
      }
      if (
        error.message.includes('quota') ||
        error.message.includes('rate limit')
      ) {
        return NextResponse.json(
          {
            error: 'Gemini API quota exceeded',
            details: 'Please try again later',
          },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
