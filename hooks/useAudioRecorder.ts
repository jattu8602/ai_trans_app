'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  AudioRecorder,
  RecordingMode,
  RecordingState,
} from '@/lib/audio-recorder'
import {
  storeChunk,
  saveRecordingState,
  deleteRecordingState,
  getRecordingState,
} from '@/lib/indexeddb'
import { getDeviceId } from '@/lib/device'
import { toast } from 'sonner'

interface UseAudioRecorderReturn {
  isRecording: boolean
  isPaused: boolean
  duration: number
  chunkCount: number
  error: string | null
  start: (mode: RecordingMode, sessionId: string) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<Blob | null>
  getStream: () => MediaStream | null
}

/**
 * React hook for audio recording
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    chunkCount: 0,
    error: null,
  })

  const recorderRef = useRef<AudioRecorder | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const pendingChunksRef = useRef<Set<number>>(new Set()) // Track pending chunk operations

  // Load persisted state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      // Check if there's a persisted recording state
      // This would be loaded from IndexedDB if needed
    }
    loadPersistedState()
  }, [])

  // Handle chunk upload (no transcription - will be done on-demand)
  const handleChunk = useCallback(
    async (chunk: Blob, index: number, duration: number) => {
      // Validate session ID before processing
      if (!sessionIdRef.current) {
        console.error(
          `[useAudioRecorder] Cannot process chunk ${index}: sessionId is null. Skipping chunk.`
        )
        return
      }

      const sessionId = sessionIdRef.current
      console.log(
        `[useAudioRecorder] Processing chunk ${index} for session ${sessionId}, duration: ${duration}s`
      )

      // Track this chunk as pending
      pendingChunksRef.current.add(index)

      try {
        // Store chunk in IndexedDB (with error handling)
        const storeResult = await storeChunk({
          id: `${sessionId}-${index}`,
          sessionId: sessionId,
          chunkIndex: index,
          blob: chunk,
          timestamp: Date.now(),
        })

        if (!storeResult.success) {
          console.warn(
            'IndexedDB storage failed, using server-only:',
            storeResult.error
          )
        }

        // Upload chunk to server IMMEDIATELY (without transcript)
        const deviceId = getDeviceId()
        const formData = new FormData()
        formData.append('chunk', chunk, `chunk-${index}.webm`)
        formData.append('chunkIndex', index.toString())
        formData.append('duration', duration.toFixed(2)) // Actual duration in seconds
        formData.append('deviceId', deviceId)
        // No transcript - will be added later

        console.log(
          `[useAudioRecorder] Uploading chunk ${index} to server (without transcript)...`
        )
        const uploadResponse = await fetch(
          `/api/sessions/${sessionId}/chunks`,
          {
            method: 'POST',
            body: formData,
          }
        )

        if (!uploadResponse.ok) {
          console.error('Failed to upload chunk:', uploadResponse.statusText)
          toast.error(`Chunk ${index + 1} upload failed`, {
            description: uploadResponse.statusText,
            duration: 3000,
          })
        } else {
          console.log(
            `[useAudioRecorder] Chunk ${index} uploaded successfully (transcription will be done on-demand)`
          )
          // Show toast for chunk upload (only for first few chunks to avoid spam)
          if (index < 3) {
            toast.success(`Chunk ${index + 1} saved`, {
              description: `${duration.toFixed(1)}s of audio uploaded`,
              duration: 2000,
            })
          }
        }
      } catch (error) {
        console.error('Error handling chunk:', error)
        toast.error(`Error processing chunk ${index + 1}`, {
          description: error instanceof Error ? error.message : 'Unknown error',
          duration: 3000,
        })
      } finally {
        // Remove from pending chunks
        pendingChunksRef.current.delete(index)
      }
    },
    []
  )

  // Start recording
  const start = useCallback(
    async (mode: RecordingMode, sessionId: string) => {
      try {
        // Validate session ID
        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
          throw new Error(`Invalid session ID: ${sessionId}`)
        }

        // Set session ID before creating recorder to ensure it's available for chunks
        sessionIdRef.current = sessionId
        console.log(
          `[useAudioRecorder] Starting recording with session ID: ${sessionId}`
        )

        const recorder = new AudioRecorder({
          mode,
          chunkDuration: 30000, // 30 seconds
          onChunk: handleChunk,
          onError: (error) => {
            setState((prev) => ({ ...prev, error: error.message }))
          },
        })

        // Subscribe to state changes
        recorder.onStateChange((newState) => {
          setState(newState)

          // Persist state to IndexedDB (with error handling)
          if (sessionIdRef.current) {
            saveRecordingState({
              sessionId: sessionIdRef.current,
              isRecording: newState.isRecording,
              isPaused: newState.isPaused,
              startTime: Date.now() - newState.duration,
              pausedTime: 0,
              totalPausedDuration: 0,
              chunkCount: newState.chunkCount,
              mode,
            }).then((result) => {
              if (!result.success) {
                console.warn('Failed to save recording state:', result.error)
              }
            })
          }
        })

        recorderRef.current = recorder
        await recorder.start()
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to start recording',
          isRecording: false,
        }))
        throw error
      }
    },
    [handleChunk]
  )

  // Pause recording
  const pause = useCallback(() => {
    recorderRef.current?.pause()
  }, [])

  // Resume recording
  const resume = useCallback(() => {
    recorderRef.current?.resume()
  }, [])

  // Stop recording
  const stop = useCallback(async (): Promise<Blob | null> => {
    try {
      if (!recorderRef.current) return null

      const finalBlob = await recorderRef.current.stop()

      // Wait for all pending chunks to complete (with timeout)
      const maxWaitTime = 10000 // 10 seconds max wait
      const startWait = Date.now()
      while (
        pendingChunksRef.current.size > 0 &&
        Date.now() - startWait < maxWaitTime
      ) {
        console.log(
          `[useAudioRecorder] Waiting for ${pendingChunksRef.current.size} pending chunks to complete...`
        )
        await new Promise((resolve) => setTimeout(resolve, 500)) // Check every 500ms
      }

      if (pendingChunksRef.current.size > 0) {
        console.warn(
          `[useAudioRecorder] Some chunks (${pendingChunksRef.current.size}) are still pending after timeout, proceeding with cleanup`
        )
      }

      // Clean up persisted state
      const sessionId = sessionIdRef.current
      if (sessionId) {
        const deleteResult = await deleteRecordingState(sessionId)
        if (!deleteResult.success) {
          console.warn('Failed to delete recording state:', deleteResult.error)
        }
      }

      // Clear session ID and pending chunks after all operations complete
      sessionIdRef.current = null
      pendingChunksRef.current.clear()

      recorderRef.current = null
      return finalBlob
    } catch (error) {
      console.error('Error stopping recording:', error)
      return null
    }
  }, [])

  // Get audio stream for analysis
  const getStream = useCallback((): MediaStream | null => {
    return recorderRef.current?.getStream() || null
  }, [])

  // Stop recording only when website is closed (beforeunload)
  useEffect(() => {
    if (!state.isRecording || !sessionIdRef.current) return

    const handleBeforeUnload = () => {
      // Stop recording when page is unloading (website closed/refreshed)
      if (recorderRef.current) {
        try {
          recorderRef.current.stop().catch(console.error)
        } catch (error) {
          console.error('Error stopping recording on beforeunload:', error)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Note: We don't stop recording here because this cleanup runs on every
      // dependency change. Recording should continue across navigation.
      // Only stop on actual page close (beforeunload) or manual stop.
    }
  }, [state.isRecording])

  return {
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    duration: state.duration,
    chunkCount: state.chunkCount,
    error: state.error,
    start,
    pause,
    resume,
    stop,
    getStream,
  }
}
