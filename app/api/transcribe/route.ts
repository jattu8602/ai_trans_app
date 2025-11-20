import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@deepgram/sdk'

/**
 * POST /api/transcribe
 * Transcribe an audio file/blob using Deepgram's file transcription API
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      )
    }

    // Get audio file from form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Check file size - very small files might be empty or invalid
    if (audioFile.size < 100) {
      console.warn('[API /transcribe] Audio file is very small, likely empty or invalid')
      return NextResponse.json({ transcript: '' })
    }

    // Detect mime type from file
    const mimeType = audioFile.type || 'audio/webm'
    console.log('[API /transcribe] Processing audio file:', {
      size: audioFile.size,
      mimeType,
      name: audioFile.name,
    })

    // Convert File to Buffer for Deepgram SDK
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate buffer is not empty
    if (buffer.length === 0) {
      console.warn('[API /transcribe] Audio buffer is empty')
      return NextResponse.json({ transcript: '' })
    }

    // Create Deepgram client and transcribe
    const deepgram = createClient(apiKey)

    // Prepare transcription options
    const transcriptionOptions: any = {
      model: 'nova-2',
      language: 'en', // Primary language (English)
      // Deepgram will auto-detect Hindi/Hinglish
      smart_format: true,
      punctuate: true,
      diarize: false,
    }

    // Add mime type hint if available (Deepgram can use this to better process the audio)
    // Note: Deepgram's transcribeFile doesn't directly accept mime type in options,
    // but it auto-detects from the file content. We'll rely on that.

    console.log('[API /transcribe] Sending to Deepgram...', {
      bufferSize: buffer.length,
      options: transcriptionOptions,
    })

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      transcriptionOptions
    )

    if (error) {
      console.error('[API /transcribe] Deepgram error:', error)

      // Handle specific error types
      if (error.status === 400) {
        // Bad Request - might be corrupt or unsupported format
        console.error('[API /transcribe] Deepgram 400 error - audio format issue:', {
          errorMessage: error.message,
          mimeType,
          fileSize: audioFile.size,
        })

        // Return empty transcript instead of error for format issues
        // This allows the chunk to still be saved without transcript
        return NextResponse.json({
          transcript: '',
          warning: 'Audio format not supported by Deepgram or corrupt data'
        })
      }

      return NextResponse.json(
        { error: `Deepgram transcription error: ${error.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Extract transcript from response
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript

    if (!transcript || !transcript.trim()) {
      // Return empty string if no transcript (might be silence)
      return NextResponse.json({ transcript: '' })
    }

    return NextResponse.json({ transcript: transcript.trim() })
  } catch (error) {
    console.error('[API /transcribe] Error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to transcribe audio file',
      },
      { status: 500 }
    )
  }
}

