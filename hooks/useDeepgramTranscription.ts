'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createDeepgramConnection,
  type TranscriptSegment,
  type DeepgramConnection,
} from '@/lib/deepgram'
import { LiveTranscriptionEvents } from '@deepgram/sdk'
import { useSocket } from './useSocket'

export interface UseDeepgramTranscriptionReturn {
  transcript: string // Current full transcript
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  start: (audioStream: MediaStream, sessionId: string) => Promise<void>
  stop: () => void
  sendAudioChunk: (audioData: ArrayBuffer) => void
  clearTranscript: () => void
  setChunkIndex: (index: number) => void // Update current chunk index
}

/**
 * React hook for Deepgram real-time transcription
 * Streams audio to Deepgram and accumulates transcript segments
 */
export function useDeepgramTranscription(): UseDeepgramTranscriptionReturn {
  const [transcript, setTranscript] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectionRef = useRef<DeepgramConnection | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const transcriptBufferRef = useRef<string>('')
  const sessionIdRef = useRef<string | null>(null)
  const chunkIndexRef = useRef<number>(0)

  // Socket.io connection
  const { emit, isConnected: isSocketConnected } = useSocket()

  // Handle transcript segments
  const handleTranscript = useCallback(
    (segment: TranscriptSegment) => {
      console.log('[useDeepgramTranscription] Received transcript segment:', {
        text:
          segment.text.substring(0, 50) +
          (segment.text.length > 50 ? '...' : ''),
        isFinal: segment.isFinal,
        currentBufferLength: transcriptBufferRef.current.length,
      })

      if (segment.isFinal) {
        // Final transcript - append to buffer
        transcriptBufferRef.current +=
          (transcriptBufferRef.current ? ' ' : '') + segment.text
        const newTranscript = transcriptBufferRef.current
        console.log(
          '[useDeepgramTranscription] Setting final transcript:',
          newTranscript.substring(0, 100)
        )
        setTranscript(newTranscript)

        // Emit to Socket.io for persistence
        if (sessionIdRef.current !== null && isSocketConnected) {
          emit('transcription:segment', {
            sessionId: sessionIdRef.current,
            chunkIndex: chunkIndexRef.current,
            transcript: segment.text,
            isFinal: true,
            timestamp: Date.now(),
          })
        }
      } else {
        // Interim result - show with buffer immediately
        const currentText = transcriptBufferRef.current
        const interimText = segment.text.trim()

        // Only update if we have new interim text
        if (interimText) {
          const displayText = currentText
            ? `${currentText} ${interimText}`
            : interimText
          console.log(
            '[useDeepgramTranscription] Setting interim transcript:',
            displayText.substring(0, 100)
          )
          setTranscript(displayText)
        }

        // Emit interim results to Socket.io
        if (sessionIdRef.current !== null && isSocketConnected) {
          emit('transcription:segment', {
            sessionId: sessionIdRef.current,
            chunkIndex: chunkIndexRef.current,
            transcript: segment.text,
            isFinal: false,
            timestamp: Date.now(),
          })
        }
      }
    },
    [emit, isSocketConnected]
  )

  // Handle errors
  const handleError = useCallback((err: Error) => {
    console.error('[useDeepgramTranscription] Error:', err)
    setError(err.message)
    setIsConnected(false)
    setIsConnecting(false)
  }, [])

  // Set chunk index
  const setChunkIndex = useCallback((index: number) => {
    chunkIndexRef.current = index
  }, [])

  // Start transcription
  const start = useCallback(
    async (audioStream: MediaStream, sessionId: string) => {
      sessionIdRef.current = sessionId
      try {
        setIsConnecting(true)
        setError(null)
        streamRef.current = audioStream

        // Create Deepgram connection
        const connection = createDeepgramConnection(
          handleTranscript,
          handleError
        )

        if (!connection) {
          throw new Error('Failed to create Deepgram connection')
        }

        connectionRef.current = connection

        // Wait for connection to open using a promise
        const connectionOpened = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error(
                'Deepgram connection timeout - connection did not open within 5 seconds'
              )
            )
          }, 5000)

          connection.connection.on(LiveTranscriptionEvents.Open, () => {
            clearTimeout(timeout)
            console.log('[useDeepgramTranscription] Deepgram connection opened')
            resolve()
          })

          connection.connection.on(LiveTranscriptionEvents.Error, (error) => {
            clearTimeout(timeout)
            reject(
              new Error(
                `Deepgram connection error: ${error.message || 'Unknown error'}`
              )
            )
          })
        })

        // Wait for connection to open
        await connectionOpened

        // Set up audio processing after connection is open
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)()
        audioContextRef.current = audioContext

        const source = audioContext.createMediaStreamSource(audioStream)
        const processor = audioContext.createScriptProcessor(4096, 1, 1)

        let audioChunksSent = 0
        processor.onaudioprocess = (e) => {
          if (connectionRef.current) {
            const readyState = connectionRef.current.connection.getReadyState()
            if (readyState === 1) {
              // OPEN state - send audio
              const inputData = e.inputBuffer.getChannelData(0)

              // Always send audio data to Deepgram (let Deepgram handle silence detection)
              // Convert Float32Array to Int16Array for Deepgram
              const int16Array = new Int16Array(inputData.length)
              for (let i = 0; i < inputData.length; i++) {
                // Clamp and convert to 16-bit integer
                const s = Math.max(-1, Math.min(1, inputData[i]))
                int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
              }

              // Send as ArrayBuffer
              connectionRef.current.sendAudio(int16Array.buffer)
              audioChunksSent++

              // Log periodically
              if (audioChunksSent === 1 || audioChunksSent % 100 === 0) {
                // Calculate RMS (root mean square) for audio level
                let sumSquares = 0
                for (let i = 0; i < inputData.length; i++) {
                  sumSquares += inputData[i] * inputData[i]
                }
                const rms = Math.sqrt(sumSquares / inputData.length)
                const db = 20 * Math.log10(rms + 1e-10) // Convert to dB

                console.log(
                  `[useDeepgramTranscription] Sent ${audioChunksSent} audio chunks (RMS: ${rms.toFixed(
                    4
                  )}, dB: ${db.toFixed(1)})`
                )
              }
            } else if (readyState === 0) {
              // CONNECTING - normal, just wait
            } else {
              console.warn(
                '[useDeepgramTranscription] Connection not ready, state:',
                readyState
              )
            }
          }
        }

        source.connect(processor)
        // Connect processor to a dummy destination to enable processing
        // We create a gain node with 0 gain to prevent audio output
        const dummyGain = audioContext.createGain()
        dummyGain.gain.value = 0 // Silent output
        processor.connect(dummyGain)
        dummyGain.connect(audioContext.destination)
        processorRef.current = processor

        setIsConnected(true)
        setIsConnecting(false)
        console.log(
          '[useDeepgramTranscription] Transcription started successfully'
        )
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start transcription'
        handleError(new Error(message))
      }
    },
    [handleTranscript, handleError]
  )

  // Stop transcription
  const stop = useCallback(() => {
    try {
      // Close Deepgram connection
      if (connectionRef.current) {
        connectionRef.current.close()
        connectionRef.current = null
      }

      // Clean up audio processing
      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error)
        audioContextRef.current = null
      }

      setIsConnected(false)
      setIsConnecting(false)
    } catch (err) {
      console.error('[useDeepgramTranscription] Error stopping:', err)
    }
  }, [])

  // Send audio chunk directly (for use with MediaRecorder chunks)
  const sendAudioChunk = useCallback(
    (audioData: ArrayBuffer) => {
      if (connectionRef.current && isConnected) {
        connectionRef.current.sendAudio(audioData)
      }
    },
    [isConnected]
  )

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('')
    transcriptBufferRef.current = ''
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    transcript,
    isConnected,
    isConnecting,
    error,
    start,
    stop,
    sendAudioChunk,
    clearTranscript,
    setChunkIndex,
  }
}
