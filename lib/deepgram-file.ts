/**
 * Deepgram file transcription service (client-side)
 * Calls the server-side API to transcribe audio files/chunks
 */

/**
 * Transcribe an audio file/blob using Deepgram's file transcription API
 * @param audioBlob - The audio blob to transcribe
 * @returns Promise resolving to the transcript text
 * @throws Error if transcription fails
 */
export async function transcribeAudioFile(audioBlob: Blob): Promise<string> {
  try {
    // Validate blob
    if (!audioBlob || audioBlob.size < 100) {
      console.warn('[Deepgram File] Audio blob is too small or invalid, skipping transcription')
      return ''
    }

    // Detect mime type from blob
    const mimeType = audioBlob.type || 'audio/webm'
    const extension = mimeType.includes('webm')
      ? 'webm'
      : mimeType.includes('mp4')
        ? 'mp4'
        : mimeType.includes('ogg')
          ? 'ogg'
          : 'webm' // Default to webm

    // Convert blob to File for FormData
    const audioFile = new File([audioBlob], `audio.${extension}`, {
      type: mimeType,
    })

    // Create FormData and send to server-side API
    const formData = new FormData()
    formData.append('audio', audioFile)

    console.log('[Deepgram File] Sending audio to transcription API...', {
      size: audioBlob.size,
      mimeType,
      extension,
    })

    // Add timeout to fetch request (slightly less than server timeout)
    // Server timeout is now 1 hour for large files, so we use 59 minutes to be safe
    const controller = new AbortController()
    const fileSizeMB = audioBlob.size / (1024 * 1024)
    const clientTimeoutMs = fileSizeMB > 10
      ? 3540000 // 59 minutes for large files (1 minute buffer before server timeout)
      : Math.max(25000, Math.min(3540000, fileSizeMB * 25000)) // Scale with file size

    const timeoutId = setTimeout(() => controller.abort(), clientTimeoutMs)

    let response: Response
    try {
      response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('[Deepgram File] Transcription request timeout')
        return '' // Return empty transcript on timeout
      }
      throw fetchError
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // If it's a warning (400/408), return empty transcript instead of throwing
      if (errorData.warning) {
        console.warn('[Deepgram File] Transcription warning:', errorData.warning)
        return errorData.transcript || ''
      }
      throw new Error(
        errorData.error || `Transcription API error: ${response.statusText}`
      )
    }

    const data = await response.json()
    const transcript = data.transcript || ''

    if (data.warning) {
      console.warn('[Deepgram File] Transcription warning:', data.warning)
    }

    if (transcript) {
      console.log('[Deepgram File] Transcription successful:', {
        transcriptLength: transcript.length,
        preview: transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''),
      })
    } else {
      console.warn('[Deepgram File] Empty transcript received (might be silence or format issue)')
    }

    return transcript
  } catch (error) {
    console.error('[Deepgram File] Failed to transcribe audio:', error)
    throw error instanceof Error
      ? error
      : new Error('Failed to transcribe audio file')
  }
}

