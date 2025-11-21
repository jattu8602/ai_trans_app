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

    // Log detailed file information
    console.log('[API /transcribe] Processing audio file:', {
      size: audioFile.size,
      sizeMB: (audioFile.size / (1024 * 1024)).toFixed(2),
      mimeType,
      name: audioFile.name,
      lastModified: audioFile.lastModified
        ? new Date(audioFile.lastModified).toISOString()
        : 'unknown',
    })

    // Convert File to Buffer for Deepgram SDK
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log('[API /transcribe] File converted to buffer:', {
      bufferSize: buffer.length,
      bufferSizeMB: (buffer.length / (1024 * 1024)).toFixed(2),
      firstBytes: buffer.slice(0, 20).toString('hex').substring(0, 40) + '...',
    })

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
        bufferSizeMB: (buffer.length / (1024 * 1024)).toFixed(2),
        options: transcriptionOptions,
        languageMode:
          'Hindi with auto-detection (supports English/Hindi/Hinglish)',
      }
    )

    // Add timeout wrapper for Deepgram API call (1 hour max for long recordings)
    const transcriptionPromise = deepgram.listen.prerecorded.transcribeFile(
      buffer,
      transcriptionOptions
    )

    // Calculate timeout based on file size (1 hour max, but scale for smaller files)
    // For very large files (> 10MB), allow up to 1 hour
    // For smaller files, use proportional timeout (minimum 30 seconds)
    const fileSizeMB = audioFile.size / (1024 * 1024)
    const timeoutMs =
      fileSizeMB > 10
        ? 3600000 // 1 hour for large files (> 10MB)
        : Math.max(30000, Math.min(3600000, fileSizeMB * 30000)) // Scale between 30s and 1 hour

    console.log('[API /transcribe] Timeout configured:', {
      fileSizeMB: fileSizeMB.toFixed(2),
      timeoutSeconds: (timeoutMs / 1000).toFixed(0),
      timeoutMinutes: (timeoutMs / 60000).toFixed(1),
    })

    const timeoutPromise = new Promise<{
      result: null
      error: { status: number; message: string }
    }>((resolve) => {
      setTimeout(() => {
        resolve({
          result: null,
          error: {
            status: 408,
            message: `Transcription timeout after ${Math.floor(
              timeoutMs / 1000
            )} seconds (${(timeoutMs / 60000).toFixed(1)} minutes)`,
          },
        })
      }, timeoutMs)
    })

    const result = await Promise.race([
      transcriptionPromise.then((r) => {
        console.log('[API /transcribe] Deepgram response received:', {
          hasResult: !!r.result,
          hasError: !!r.error,
          errorStatus: r.error
            ? 'status' in r.error
              ? r.error.status
              : 'unknown'
            : null,
          errorMessage: r.error
            ? 'message' in r.error
              ? r.error.message
              : String(r.error)
            : null,
        })
        return { result: r.result, error: r.error }
      }),
      timeoutPromise,
    ])

    const { result: finalResult, error } = result

    console.log('[API /transcribe] Transcription result after race:', {
      hasResult: !!finalResult,
      hasError: !!error,
      resultType: finalResult ? typeof finalResult : 'null',
      resultKeys:
        finalResult && typeof finalResult === 'object'
          ? Object.keys(finalResult)
          : [],
      errorType: error ? typeof error : 'null',
    })

    // Log full result structure for debugging
    if (finalResult) {
      console.log(
        '[API /transcribe] Full Deepgram result structure:',
        JSON.stringify(finalResult, null, 2).substring(0, 3000)
      )
    }

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
    console.log('[API /transcribe] Extracting transcript from result:', {
      hasResults: !!finalResult?.results,
      hasChannels: !!finalResult?.results?.channels,
      channelsCount: finalResult?.results?.channels?.length || 0,
      firstChannel: finalResult?.results?.channels?.[0]
        ? {
            hasAlternatives: !!finalResult.results.channels[0].alternatives,
            alternativesCount:
              finalResult.results.channels[0].alternatives?.length || 0,
          }
        : null,
    })

    const transcript =
      finalResult?.results?.channels?.[0]?.alternatives?.[0]?.transcript

    if (!transcript || !transcript.trim()) {
      // Return empty string if no transcript (might be silence)
      console.log(
        '[API /transcribe] ⚠️ No transcript found (silence or empty audio)',
        {
          transcriptValue: transcript,
          transcriptType: typeof transcript,
          rawResult: finalResult
            ? JSON.stringify(finalResult, null, 2).substring(0, 2000)
            : 'null',
          fullResultStructure: finalResult
            ? {
                hasMetadata: !!finalResult.metadata,
                hasResults: !!finalResult.results,
                resultsStructure: finalResult.results
                  ? {
                      hasChannels: !!finalResult.results.channels,
                      channels:
                        finalResult.results.channels?.map(
                          (ch: any, i: number) => ({
                            index: i,
                            hasAlternatives: !!ch.alternatives,
                            alternativesCount: ch.alternatives?.length || 0,
                            firstAlternative: ch.alternatives?.[0]
                              ? {
                                  hasTranscript:
                                    !!ch.alternatives[0].transcript,
                                  transcriptLength:
                                    ch.alternatives[0].transcript?.length || 0,
                                  confidence: ch.alternatives[0].confidence,
                                }
                              : null,
                          })
                        ) || [],
                    }
                  : null,
              }
            : null,
        }
      )
      return NextResponse.json({
        transcript: '',
        warning:
          'No transcript found - audio might be silence, corrupt, or unsupported format',
        debug: {
          hasResult: !!finalResult,
          hasResults: !!finalResult?.results,
          channelsCount: finalResult?.results?.channels?.length || 0,
        },
      })
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
