'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Play, Pause } from 'lucide-react'
import { useDevice } from '@/hooks/useDevice'
import { useChunkPlayback } from '@/hooks/useChunkPlayback'
import { getDeviceId } from '@/lib/device'
import { formatDistanceToNow } from 'date-fns'

interface Session {
  id: string
  title: string | null
  transcript: string | null
  summary: string | null
  status: string
  duration: number | null
  chunksCount: number
  recordingStartedAt: string | null
  createdAt: string
  updatedAt: string
}

export default function SessionDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const { deviceId } = useDevice()
  const { chunks, audioUrl, totalDuration, isLoading, error, loadChunks, cleanup } = useChunkPlayback()

  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoadingSession(true)
        const id = getDeviceId()
        const response = await fetch(`/api/sessions/${sessionId}?deviceId=${id}`)

        if (!response.ok) {
          throw new Error('Failed to load session')
        }

        const data = await response.json()
        setSession(data.session)
      } catch (error) {
        console.error('Error loading session:', error)
      } finally {
        setIsLoadingSession(false)
      }
    }

    if (sessionId) {
      loadSession()
      loadChunks(sessionId)
    }
  }, [sessionId, loadChunks])

  // Setup audio element with event listeners
  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl)

      // Event handlers
      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime)
      }

      const handleLoadedMetadata = () => {
        const duration = audio.duration
        // Only set duration if it's a valid finite number
        if (isFinite(duration) && !isNaN(duration) && duration > 0) {
          setAudioDuration(duration)
        }
      }

      // Also check duration on canplay event as fallback
      const handleCanPlay = () => {
        const duration = audio.duration
        if (isFinite(duration) && !isNaN(duration) && duration > 0) {
          setAudioDuration(duration)
        }
      }

      const handleEnded = () => {
        setIsPlaying(false)
        setCurrentTime(0)
      }

      const handlePlay = () => {
        setIsPlaying(true)
      }

      const handlePause = () => {
        setIsPlaying(false)
      }

      // Add event listeners
      audio.addEventListener('timeupdate', handleTimeUpdate)
      audio.addEventListener('loadedmetadata', handleLoadedMetadata)
      audio.addEventListener('canplay', handleCanPlay)
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('play', handlePlay)
      audio.addEventListener('pause', handlePause)

      // Load metadata
      audio.load()

      setAudioElement(audio)

      return () => {
        // Remove event listeners
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audio.removeEventListener('canplay', handleCanPlay)
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('play', handlePlay)
        audio.removeEventListener('pause', handlePause)

        audio.pause()
        audio.src = ''
        cleanup()
        setCurrentTime(0)
        setAudioDuration(0)
      }
    } else {
      setAudioElement(null)
      setCurrentTime(0)
      setAudioDuration(0)
    }
  }, [audioUrl, cleanup])

  const handlePlayPause = async () => {
    if (!audioElement) return

    try {
      if (isPlaying) {
        audioElement.pause()
      } else {
        await audioElement.play()
      }
    } catch (error) {
      console.error('Error playing/pausing audio:', error)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioElement) return
    const newTime = parseFloat(e.target.value)
    audioElement.currentTime = newTime
    setCurrentTime(newTime)
  }

  // Get the actual duration to display
  // Priority: 1. session.duration (most accurate), 2. audioDuration, 3. totalDuration
  const displayDuration =
    session?.duration && session.duration > 0
      ? session.duration
      : (audioDuration > 0 && isFinite(audioDuration) && !isNaN(audioDuration)
          ? audioDuration
          : (totalDuration > 0 ? totalDuration : 0))

  const formatDuration = (seconds: number | null | undefined): string => {
    // Handle invalid values
    if (!seconds && seconds !== 0) return '0:00'
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
    if (seconds < 0) return '0:00'

    const totalSeconds = Math.floor(seconds)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-center">
          <div className="text-lg">Loading session...</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-center space-y-4">
          <div className="text-lg text-red-500">Session not found</div>
          <Button onClick={() => router.push('/')}>Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold mb-2">
          {session.title || 'Untitled Session'}
        </h1>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>
            Created {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
          </div>
          {session.recordingStartedAt && (
            <div>
              Started {formatDistanceToNow(new Date(session.recordingStartedAt), { addSuffix: true })}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2">
            <span className="capitalize">{session.status}</span>
            {session.duration && (
              <>
                <span>•</span>
                <span>Duration: {formatDuration(session.duration)}</span>
              </>
            )}
            {session.chunksCount > 0 && (
              <>
                <span>•</span>
                <span>{session.chunksCount} chunks</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              onClick={handlePlayPause}
              disabled={!audioUrl || isLoading}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">
                  {formatDuration(currentTime)} / {formatDuration(displayDuration)}
                </div>
                {isLoading && (
                  <div className="text-xs text-muted-foreground">Loading...</div>
                )}
              </div>
              <input
                type="range"
                min="0"
                max={displayDuration > 0 ? displayDuration : 1}
                step="0.1"
                value={Math.min(currentTime, displayDuration > 0 ? displayDuration : 0)}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                style={{
                  background: displayDuration > 0
                    ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / displayDuration) * 100}%, #e5e7eb ${(currentTime / displayDuration) * 100}%, #e5e7eb 100%)`
                    : 'linear-gradient(to right, #e5e7eb 0%, #e5e7eb 100%)'
                }}
                disabled={!audioElement || isLoading || displayDuration <= 0}
              />
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4 mb-6 bg-red-50 dark:bg-red-950">
          <div className="text-red-600 dark:text-red-400">
            Error loading audio: {error}
          </div>
        </Card>
      )}

      {/* Transcript */}
      {session.transcript && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Transcript</h2>
          <div className="whitespace-pre-wrap text-sm">
            {session.transcript}
          </div>
        </Card>
      )}

      {/* Summary */}
      {session.summary && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Summary</h2>
          <div className="whitespace-pre-wrap text-sm">
            {session.summary}
          </div>
        </Card>
      )}

      {/* Chunks Info */}
      {(() => {
        // Filter chunks based on session duration and meaningful audio data
        const MIN_BLOB_SIZE = 1000 // Minimum blob size in bytes to consider chunk valid

        // First filter: chunks with meaningful audio data
        const chunksWithAudio = chunks.filter(
          (chunk) =>
            chunk.blob &&
            chunk.blob.size >= MIN_BLOB_SIZE &&
            chunk.duration > 0
        )

        // Second filter: filter by cumulative duration not exceeding session duration
        if (!session?.duration || session.duration <= 0) {
          // If no session duration, show all valid chunks
          const validChunks = chunksWithAudio

          return validChunks.length > 0 ? (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Audio Chunks</h2>
              <div className="space-y-2">
                {validChunks.map((chunk) => (
                  <div
                    key={chunk.index}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                  >
                    <div>
                      <div className="font-medium">Chunk {chunk.index + 1}</div>
                      <div className="text-sm text-muted-foreground">
                        Duration: {formatDuration(chunk.duration)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null
        }

        // Filter by cumulative duration
        let cumulativeDuration = 0
        const validChunks = chunksWithAudio.filter((chunk) => {
          const newCumulative = cumulativeDuration + chunk.duration
          // Only include if cumulative duration doesn't exceed session duration
          if (newCumulative <= session.duration) {
            cumulativeDuration = newCumulative
            return true
          }
          return false
        })

        return validChunks.length > 0 ? (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Audio Chunks</h2>
            <div className="space-y-2">
              {validChunks.map((chunk) => (
                <div
                  key={chunk.index}
                  className="flex items-center justify-between p-3 bg-muted rounded"
                >
                  <div>
                    <div className="font-medium">Chunk {chunk.index + 1}</div>
                    <div className="text-sm text-muted-foreground">
                      Duration: {formatDuration(chunk.duration)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null
      })()}

      {!session.transcript && !session.summary && chunks.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">
          No content available for this session yet.
        </Card>
      )}
    </div>
  )
}

