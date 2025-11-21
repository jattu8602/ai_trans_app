import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createClient } from '@deepgram/sdk'

/**
 * POST /api/sessions/[id]/transcribe?deviceId=...
 * Combines all audio chunks for a session and transcribes them once
 * Updates the session with the full transcript
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

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'No audio chunks found for this session' },
        { status: 404 }
      )
    }

    // Filter chunks with audio data
    const chunksWithAudio = chunks.filter(
      (chunk) => chunk.audioData && chunk.audioData.length > 0
    )

    if (chunksWithAudio.length === 0) {
      return NextResponse.json(
        { error: 'No chunks with audio data found' },
        { status: 404 }
      )
    }

    console.log(
      `[Transcribe API] Processing ${chunksWithAudio.length} chunks for session ${sessionId}`
    )

    // Convert base64 to buffers and combine
    const audioBuffers = chunksWithAudio.map((chunk) =>
      Buffer.from(chunk.audioData!, 'base64')
    )
    const combinedAudio = Buffer.concat(audioBuffers)

    console.log(
      `[Transcribe API] Combined audio size: ${(
        combinedAudio.length /
        (1024 * 1024)
      ).toFixed(2)} MB`
    )

    // Transcribe using Deepgram SDK directly
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      )
    }

    const deepgram = createClient(apiKey)

    const transcriptionOptions: any = {
      model: 'nova-2',
      language: 'hi', // Hindi (also handles English in mixed content)
      detect_language: true, // Enable auto-detection for mixed English/Hindi (Hinglish)
      smart_format: true,
      punctuate: true,
      diarize: false,
    }

    console.log('[Transcribe API] Sending to Deepgram...', {
      bufferSize: combinedAudio.length,
      bufferSizeMB: (combinedAudio.length / (1024 * 1024)).toFixed(2),
    })

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      combinedAudio,
      transcriptionOptions
    )

    if (error) {
      console.error('[Transcribe API] Deepgram error:', error)
      const errorMessage = 'message' in error ? error.message : String(error)
      return NextResponse.json(
        {
          error: 'Transcription failed',
          details: errorMessage,
        },
        { status: 400 }
      )
    }

    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''

    if (!transcript || transcript.trim().length === 0) {
      console.warn('[Transcribe API] Empty transcript received')
      return NextResponse.json({
        transcript: '',
        warning:
          'Transcription returned empty result (audio might be silence or unsupported format)',
      })
    }

    // Update session with transcript
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: transcript.trim(),
        status: 'processing', // Mark as processing (summary will be generated next)
      },
    })

    console.log(
      `[Transcribe API] Transcript generated and saved: ${transcript.length} characters`
    )

    return NextResponse.json({
      transcript: transcript.trim(),
      message: 'Transcription completed successfully',
    })
  } catch (error) {
    console.error('Error in POST /api/sessions/[id]/transcribe:', error)
    return NextResponse.json(
      {
        error: 'Failed to transcribe session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
