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
      console.warn(
        '[API /transcribe] Audio file is very small, likely empty or invalid'
      )
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
    // Support both English and Hindi (auto-detect)
    // Deepgram supports: 'en' (English), 'hi' (Hindi)
    // For mixed content (Hinglish), we can either:
    // 1. Use 'hi' for Hindi (will also handle some English)
    // 2. Use language detection (detect_language: true)
    // Using 'hi' as primary since user wants Hindi support, but it handles English too
    const transcriptionOptions: any = {
      model: 'nova-2',
      language: 'hi', // Hindi (also handles English in mixed content)
      detect_language: true, // Enable auto-detection for mixed English/Hindi (Hinglish)
      smart_format: true,
      punctuate: true,
      diarize: false,
    }

    // Add mime type hint if available (Deepgram can use this to better process the audio)
    // Note: Deepgram's transcribeFile doesn't directly accept mime type in options,
    // but it auto-detects from the file content. We'll rely on that.

    console.log(
      '[API /transcribe] Sending to Deepgram (Hindi + English support)...',
      {
        bufferSize: buffer.length,
        options: transcriptionOptions,
        languageMode:
          'Hindi with auto-detection (supports English/Hindi/Hinglish)',
      }
    )

    // Add timeout wrapper for Deepgram API call (30 seconds max)
    const transcriptionPromise = deepgram.listen.prerecorded.transcribeFile(
      buffer,
      transcriptionOptions
    )

    const timeoutPromise = new Promise<{
      result: null
      error: { status: number; message: string }
    }>((resolve) => {
      setTimeout(() => {
        resolve({
          result: null,
          error: {
            status: 408,
            message: 'Transcription timeout after 30 seconds',
          },
        })
      }, 30000) // 30 second timeout
    })

    const result = await Promise.race([
      transcriptionPromise.then((r) => ({ result: r.result, error: r.error })),
      timeoutPromise,
    ])

    const { result: finalResult, error } = result

    if (error) {
      console.error('[API /transcribe] Deepgram error:', error)

      // Extract error status (handle both DeepgramError and our custom error type)
      const errorStatus =
        'status' in error
          ? error.status
          : 'statusCode' in error
          ? error.statusCode
          : null
      const errorMessage = 'message' in error ? error.message : String(error)

      // Handle specific error types
      if (errorStatus === 400) {
        // Bad Request - might be corrupt or unsupported format
        console.error(
          '[API /transcribe] Deepgram 400 error - audio format issue:',
          {
            errorMessage,
            mimeType,
            fileSize: audioFile.size,
          }
        )

        // Return empty transcript instead of error for format issues
        // This allows the chunk to still be saved without transcript
        return NextResponse.json({
          transcript: '',
          warning: 'Audio format not supported by Deepgram or corrupt data',
        })
      }

      if (errorStatus === 408 || errorMessage?.includes('timeout')) {
        // Timeout error - return empty transcript
        console.error('[API /transcribe] Deepgram timeout error:', {
          errorMessage,
          fileSize: audioFile.size,
        })
        return NextResponse.json({
          transcript: '',
          warning:
            'Transcription timeout - audio file may be too large or slow to process',
        })
      }

      // For other errors, return empty transcript to allow chunk saving
      console.error('[API /transcribe] Deepgram error (non-critical):', error)
      return NextResponse.json({
        transcript: '',
        warning: `Transcription failed: ${errorMessage || 'Unknown error'}`,
      })
    }

    // Extract transcript from response
    const transcript =
      finalResult?.results?.channels?.[0]?.alternatives?.[0]?.transcript

    if (!transcript || !transcript.trim()) {
      // Return empty string if no transcript (might be silence)
      console.log(
        '[API /transcribe] No transcript found (silence or empty audio)'
      )
      return NextResponse.json({ transcript: '' })
    }

    const trimmedTranscript = transcript.trim()

    // Log the generated transcript
    console.log('[API /transcribe] ✅ Transcript generated:', {
      length: trimmedTranscript.length,
      wordCount: trimmedTranscript.split(/\s+/).length,
      preview:
        trimmedTranscript.substring(0, 100) +
        (trimmedTranscript.length > 100 ? '...' : ''),
      fullTranscript: trimmedTranscript, // Log full transcript for debugging
    })

    return NextResponse.json({ transcript: trimmedTranscript })
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
