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

  // Load persisted state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      // Check if there's a persisted recording state
      // This would be loaded from IndexedDB if needed
    }
    loadPersistedState()
  }, [])

  // Handle chunk upload
  const handleChunk = useCallback(
    async (chunk: Blob, index: number, duration: number) => {
      if (!sessionIdRef.current) return

      try {
        // Store chunk in IndexedDB (with error handling)
        const storeResult = await storeChunk({
          id: `${sessionIdRef.current}-${index}`,
          sessionId: sessionIdRef.current,
          chunkIndex: index,
          blob: chunk,
          timestamp: Date.now(),
        })

        if (!storeResult.success) {
          console.warn('IndexedDB storage failed, using server-only:', storeResult.error)
        }

        // Upload chunk to server (always attempt, even if IndexedDB failed)
        const deviceId = getDeviceId()
        const formData = new FormData()
        formData.append('chunk', chunk, `chunk-${index}.webm`)
        formData.append('chunkIndex', index.toString())
        formData.append('duration', duration.toFixed(2)) // Actual duration in seconds
        formData.append('deviceId', deviceId)

        const response = await fetch(
          `/api/sessions/${sessionIdRef.current}/chunks`,
          {
            method: 'POST',
            body: formData,
          },
        )

        if (!response.ok) {
          console.error('Failed to upload chunk:', response.statusText)
        }
      } catch (error) {
        console.error('Error handling chunk:', error)
      }
    },
    [],
  )

  // Start recording
  const start = useCallback(
    async (mode: RecordingMode, sessionId: string) => {
      try {
        sessionIdRef.current = sessionId

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
          error: error instanceof Error ? error.message : 'Failed to start recording',
          isRecording: false,
        }))
        throw error
      }
    },
    [handleChunk],
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

      // Clean up persisted state
      if (sessionIdRef.current) {
        const deleteResult = await deleteRecordingState(sessionIdRef.current)
        if (!deleteResult.success) {
          console.warn('Failed to delete recording state:', deleteResult.error)
        }
        sessionIdRef.current = null
      }

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

