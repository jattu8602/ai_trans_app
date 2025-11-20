/**
 * Deepgram service for real-time transcription
 * Handles streaming audio to Deepgram API for transcription
 */

import {
  createClient,
  LiveTranscriptionEvents,
  type ListenLiveClient,
} from '@deepgram/sdk'

export interface TranscriptSegment {
  text: string
  isFinal: boolean
  start?: number
  end?: number
}

export interface DeepgramConnection {
  connection: ListenLiveClient
  sendAudio: (audioData: ArrayBuffer) => void
  close: () => void
}

/**
 * Create a Deepgram live transcription connection
 * @param onTranscript - Callback for transcript segments
 * @param onError - Callback for errors
 * @returns Connection object with methods to send audio and close
 */
export function createDeepgramConnection(
  onTranscript: (segment: TranscriptSegment) => void,
  onError?: (error: Error) => void
): DeepgramConnection | null {
  const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY

  if (!apiKey) {
    console.error(
      '[Deepgram] API key not found. Set NEXT_PUBLIC_DEEPGRAM_API_KEY'
    )
    onError?.(new Error('Deepgram API key not configured'))
    return null
  }

  try {
    const deepgram = createClient(apiKey)

    // Create live connection
    const connection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en', // Primary language (English)
      // Support Hindi and English (auto-detect)
      // Deepgram will auto-detect mixed languages
      smart_format: true,
      punctuate: true,
      diarize: false,
      // Enable interim results for real-time updates
      interim_results: true,
      utterance_end_ms: 1000,
    })

    // Handle connection open
    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log('[Deepgram] Connection opened successfully')
      console.log('[Deepgram] Ready to receive audio data')
    })

    // Handle transcript results
    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      try {
        const transcript = data.channel?.alternatives?.[0]?.transcript

        if (transcript && transcript.trim()) {
          const isFinal = data.is_final || false
          const start = data.start
          const end =
            data.start && data.duration ? data.start + data.duration : undefined

          console.log('[Deepgram] Transcript received:', {
            text: transcript,
            isFinal,
            confidence: data.channel?.alternatives?.[0]?.confidence,
            speech_final: data.speech_final,
          })

          onTranscript({
            text: transcript,
            isFinal,
            start,
            end,
          })
        } else {
          // Log when we receive data but no transcript (might be silence or processing)
          if (data.channel?.alternatives?.[0]) {
            console.log('[Deepgram] Received data but transcript is empty:', {
              hasAlternatives: !!data.channel.alternatives,
              isFinal: data.is_final,
            })
          }
        }
      } catch (error) {
        console.error('[Deepgram] Error processing transcript:', error)
      }
    })

    // Handle errors
    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('[Deepgram] Connection error:', error)
      onError?.(
        new Error(`Deepgram error: ${error.message || 'Unknown error'}`)
      )
    })

    // Handle connection close
    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log('[Deepgram] Connection closed')
    })

    // Handle metadata
    connection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
      console.log('[Deepgram] Metadata:', metadata)
    })

    // Send audio data
    const sendAudio = (audioData: ArrayBuffer) => {
      try {
        const readyState = connection.getReadyState()
        if (readyState === 1) {
          // OPEN state - send audio
          connection.send(audioData)
        } else {
          // Connection not ready - log but don't error (might be connecting)
          if (readyState === 0) {
            // CONNECTING - this is normal, just wait
            return
          }
          console.warn('[Deepgram] Connection not ready, state:', readyState)
        }
      } catch (error) {
        console.error('[Deepgram] Error sending audio:', error)
        // Don't call onError for every send failure - might be temporary
      }
    }

    // Close connection
    const close = () => {
      try {
        if (connection.getReadyState() !== 3) {
          // Not CLOSED
          connection.finish()
        }
      } catch (error) {
        console.error('[Deepgram] Error closing connection:', error)
      }
    }

    return {
      connection,
      sendAudio,
      close,
    }
  } catch (error) {
    console.error('[Deepgram] Failed to create connection:', error)
    onError?.(
      new Error(
        `Failed to create Deepgram connection: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    )
    return null
  }
}
