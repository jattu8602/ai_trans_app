'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getChunksForPlayback,
  revokeAudioUrl,
  type ChunkPlaybackData,
} from '@/lib/chunk-playback'
import { getDeviceId } from '@/lib/device'

interface UseChunkPlaybackReturn {
  chunks: ChunkPlaybackData['chunks']
  audioUrl: string | null
  totalDuration: number
  isLoading: boolean
  error: string | null
  loadChunks: (sessionId: string) => Promise<void>
  cleanup: () => void
}

/**
 * React hook for chunk playback
 */
export function useChunkPlayback(): UseChunkPlaybackReturn {
  const [chunks, setChunks] = useState<ChunkPlaybackData['chunks']>([])
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [totalDuration, setTotalDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadChunks = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const deviceId = getDeviceId()
      const result = await getChunksForPlayback(sessionId, deviceId)

      if (result.error) {
        setError(result.error)
        setChunks([])
        setAudioUrl(null)
        setTotalDuration(0)
      } else {
        setChunks(result.chunks)
        setAudioUrl(result.audioUrl)
        setTotalDuration(result.totalDuration)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load chunks'
      setError(message)
      setChunks([])
      setAudioUrl(null)
      setTotalDuration(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const cleanup = useCallback(() => {
    if (audioUrl) {
      revokeAudioUrl(audioUrl)
      setAudioUrl(null)
    }
  }, [audioUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    chunks,
    audioUrl,
    totalDuration,
    isLoading,
    error,
    loadChunks,
    cleanup,
  }
}

