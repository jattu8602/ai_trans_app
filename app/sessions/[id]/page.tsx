'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ArrowLeft,
  Play,
  Pause,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useDevice } from '@/hooks/useDevice'
import { useChunkPlayback } from '@/hooks/useChunkPlayback'
import { useSocket } from '@/hooks/useSocket'
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
  const {
    chunks,
    audioUrl,
    totalDuration,
    isLoading,
    error,
    loadChunks,
    cleanup,
  } = useChunkPlayback()

  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [mergedTranscript, setMergedTranscript] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<
    'idle' | 'transcribing' | 'summarizing' | 'complete'
  >('idle')
  const [generationError, setGenerationError] = useState<string | null>(null)

  // Socket.io for real-time transcript updates
  const {
    on,
    off,
    joinSession,
    leaveSession,
    isConnected: isSocketConnected,
  } = useSocket()

  // Load session data and chunks
  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoadingSession(true)
        const id = getDeviceId()
        const response = await fetch(
          `/api/sessions/${sessionId}?deviceId=${id}`
        )

        if (!response.ok) {
          throw new Error('Failed to load session')
        }

        const data = await response.json()
        setSession(data.session)

        // Set transcript from session if available
        if (data.session.transcript) {
          setMergedTranscript(data.session.transcript)
        }
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

  // Reload session when generation completes
  useEffect(() => {
    if (generationStatus === 'complete' && sessionId) {
      const loadSession = async () => {
        const id = getDeviceId()
        const response = await fetch(
          `/api/sessions/${sessionId}?deviceId=${id}`
        )
        if (response.ok) {
          const data = await response.json()
          setSession(data.session)
          if (data.session.transcript) {
            setMergedTranscript(data.session.transcript)
          }
        }
      }
      loadSession()
    }
  }, [generationStatus, sessionId])

  // Listen for real-time transcript updates via Socket.io
  useEffect(() => {
    if (!sessionId || !isSocketConnected) return

    // Join session room
    joinSession(sessionId)

    // Listen for transcript updates
    const handleTranscriptUpdate = (data: {
      sessionId: string
      chunkIndex: number
      transcript: string
      mergedTranscript: string
      isFinal: boolean
    }) => {
      if (data.sessionId === sessionId) {
        console.log('[SessionDetails] Received transcript update:', data)
        setMergedTranscript(data.mergedTranscript)
      }
    }

    const handleTranscriptError = (data: { error: string }) => {
      console.error('[SessionDetails] Transcript error:', data.error)
    }

    on('transcription:updated', handleTranscriptUpdate)
    on('transcription:error', handleTranscriptError)

    return () => {
      off('transcription:updated', handleTranscriptUpdate)
      off('transcription:error', handleTranscriptError)
      leaveSession(sessionId)
    }
  }, [sessionId, isSocketConnected, on, off, joinSession, leaveSession])

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
      : audioDuration > 0 && isFinite(audioDuration) && !isNaN(audioDuration)
      ? audioDuration
      : totalDuration > 0
      ? totalDuration
      : 0

  // Format markdown summary to HTML with rich text highlighting
  const formatSummaryMarkdown = (markdown: string): string => {
    let html = markdown

    // First, highlight Speaker names before processing other markdown
    // This ensures speaker highlighting is preserved
    html = html.replace(
      /\[Speaker (\d+)\]/gi,
      '<span class="font-bold text-primary bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded inline-block my-1">Speaker $1</span>'
    )
    html = html.replace(
      /\*\*Speaker (\d+)\*\*/gi,
      '<span class="font-bold text-primary bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded inline-block my-1">Speaker $1</span>'
    )

    // Convert markdown headings (process in order: h3, h2, h1)
    html = html.replace(
      /^### (.*)$/gim,
      '<h3 class="text-base font-semibold mt-3 mb-2 text-foreground">$1</h3>'
    )
    html = html.replace(
      /^## (.*)$/gim,
      '<h2 class="text-lg font-bold mt-4 mb-2 text-foreground">$1</h2>'
    )
    html = html.replace(
      /^# (.*)$/gim,
      '<h1 class="text-xl font-bold mt-4 mb-3 text-foreground">$1</h1>'
    )

    // Convert bold text (handle both **text** and __text__) - highlight important points
    html = html.replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="font-bold text-foreground bg-yellow-100 dark:bg-yellow-900 px-1.5 py-0.5 rounded">$1</strong>'
    )
    html = html.replace(
      /__(.*?)__/g,
      '<strong class="font-bold text-foreground bg-yellow-100 dark:bg-yellow-900 px-1.5 py-0.5 rounded">$1</strong>'
    )

    // Convert italic text
    html = html.replace(
      /(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g,
      '<em class="italic text-foreground">$1</em>'
    )
    html = html.replace(
      /(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g,
      '<em class="italic text-foreground">$1</em>'
    )

    // Convert inline code
    html = html.replace(
      /`([^`]+)`/g,
      '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">$1</code>'
    )

    // Convert blockquotes
    html = html.replace(
      /^> (.*)$/gim,
      '<blockquote class="border-l-4 border-primary pl-4 italic text-muted-foreground my-2">$1</blockquote>'
    )

    // Process lists line by line
    const lines = html.split('\n')
    let inUnorderedList = false
    let inOrderedList = false
    let listItems: string[] = []
    let processedLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const unorderedMatch = line.match(/^[\*\-] (.*)$/)
      const orderedMatch = line.match(/^\d+\. (.*)$/)

      if (unorderedMatch) {
        if (!inUnorderedList) {
          if (inOrderedList) {
            processedLines.push(
              `<ol class="list-decimal ml-6 my-2">${listItems.join('')}</ol>`
            )
            listItems = []
            inOrderedList = false
          }
          inUnorderedList = true
          listItems = []
        }
        // Process markdown inside list items
        let itemContent = unorderedMatch[1]
        itemContent = itemContent.replace(
          /\*\*(.*?)\*\*/g,
          '<strong class="font-bold text-foreground bg-yellow-100 dark:bg-yellow-900 px-1.5 py-0.5 rounded">$1</strong>'
        )
        listItems.push(`<li class="my-1.5">${itemContent}</li>`)
      } else if (orderedMatch) {
        if (!inOrderedList) {
          if (inUnorderedList) {
            processedLines.push(
              `<ul class="list-disc ml-6 my-2">${listItems.join('')}</ul>`
            )
            listItems = []
            inUnorderedList = false
          }
          inOrderedList = true
          listItems = []
        }
        // Process markdown inside list items
        let itemContent = orderedMatch[1]
        itemContent = itemContent.replace(
          /\*\*(.*?)\*\*/g,
          '<strong class="font-bold text-foreground bg-yellow-100 dark:bg-yellow-900 px-1.5 py-0.5 rounded">$1</strong>'
        )
        listItems.push(`<li class="my-1.5">${itemContent}</li>`)
      } else {
        // Close any open list
        if (inUnorderedList && listItems.length > 0) {
          processedLines.push(
            `<ul class="list-disc ml-6 my-2">${listItems.join('')}</ul>`
          )
          listItems = []
          inUnorderedList = false
        }
        if (inOrderedList && listItems.length > 0) {
          processedLines.push(
            `<ol class="list-decimal ml-6 my-2">${listItems.join('')}</ol>`
          )
          listItems = []
          inOrderedList = false
        }
        processedLines.push(line)
      }
    }

    // Close any remaining open list
    if (inUnorderedList && listItems.length > 0) {
      processedLines.push(
        `<ul class="list-disc ml-6 my-2">${listItems.join('')}</ul>`
      )
    }
    if (inOrderedList && listItems.length > 0) {
      processedLines.push(
        `<ol class="list-decimal ml-6 my-2">${listItems.join('')}</ol>`
      )
    }

    html = processedLines.join('\n')

    // Convert double line breaks to paragraph breaks
    html = html
      .split(/\n\n+/)
      .map((para) => {
        para = para.trim()
        if (!para) return ''
        // Don't wrap headings, lists, or blockquotes in paragraphs
        if (para.match(/^<(h[1-6]|ul|ol|blockquote|li)/)) {
          return para
        }
        return `<p class="my-2 leading-relaxed">${para}</p>`
      })
      .join('')

    // Convert single line breaks to <br> (but not inside lists or headings)
    html = html.replace(
      /(?<!<li[^>]*>)(?<!<\/h[1-6]>)(?<!<\/ul>)(?<!<\/ol>)\n(?!<[uo]l|<\/li>)/g,
      '<br>'
    )

    // Clean up empty paragraphs and extra breaks
    html = html.replace(/<p class="my-2 leading-relaxed"><\/p>/g, '')
    html = html.replace(/<p class="my-2 leading-relaxed"><br><\/p>/g, '')

    return html
  }

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
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const handleGenerateTranscribeAndSummary = async () => {
    if (!sessionId || !deviceId) return

    setIsGenerating(true)
    setGenerationError(null)
    setGenerationStatus('transcribing')

    try {
      // Step 1: Transcribe
      console.log('[Session] Starting transcription...')
      const transcribeResponse = await fetch(
        `/api/sessions/${sessionId}/transcribe?deviceId=${deviceId}`,
        { method: 'POST' }
      )

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Transcription failed')
      }

      const transcribeData = await transcribeResponse.json()
      const transcript = transcribeData.transcript || ''

      if (!transcript) {
        throw new Error('Transcription returned empty result')
      }

      // Update transcript in UI immediately
      setMergedTranscript(transcript)

      // Reload session to get updated transcript
      const sessionResponse = await fetch(
        `/api/sessions/${sessionId}?deviceId=${deviceId}`
      )
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        setSession(sessionData.session)
      }

      // Step 2: Generate Summary
      console.log('[Session] Starting summary generation...')
      setGenerationStatus('summarizing')

      const summaryResponse = await fetch(
        `/api/sessions/${sessionId}/summary?deviceId=${deviceId}`,
        { method: 'POST' }
      )

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json().catch(() => ({}))
        // If transcription succeeded but summary failed, don't throw - just show error
        // This allows user to retry summary generation separately
        setGenerationError(
          errorData.error || errorData.details || 'Summary generation failed'
        )
        setGenerationStatus('idle')
        return
      }

      const summaryData = await summaryResponse.json()

      // Reload session to get updated summary
      const finalSessionResponse = await fetch(
        `/api/sessions/${sessionId}?deviceId=${deviceId}`
      )
      if (finalSessionResponse.ok) {
        const finalSessionData = await finalSessionResponse.json()
        setSession(finalSessionData.session)
      }

      setGenerationStatus('complete')
      setGenerationError(null) // Clear any previous errors
      console.log('[Session] Generation completed successfully')
    } catch (err) {
      console.error('[Session] Generation error:', err)
      setGenerationError(
        err instanceof Error
          ? err.message
          : 'Failed to generate transcript and summary'
      )
      setGenerationStatus('idle')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateSummaryOnly = async () => {
    if (!sessionId || !deviceId) return

    setIsGenerating(true)
    setGenerationError(null)
    setGenerationStatus('summarizing')

    try {
      console.log('[Session] Starting summary generation only...')
      const summaryResponse = await fetch(
        `/api/sessions/${sessionId}/summary?deviceId=${deviceId}`,
        { method: 'POST' }
      )

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json().catch(() => ({}))
        throw new Error(
          errorData.error || errorData.details || 'Summary generation failed'
        )
      }

      const summaryData = await summaryResponse.json()

      // Reload session to get updated summary
      const sessionResponse = await fetch(
        `/api/sessions/${sessionId}?deviceId=${deviceId}`
      )
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        setSession(sessionData.session)
      }

      setGenerationStatus('complete')
      setGenerationError(null)
      console.log('[Session] Summary generation completed successfully')
    } catch (err) {
      console.error('[Session] Summary generation error:', err)
      setGenerationError(
        err instanceof Error ? err.message : 'Failed to generate summary'
      )
      setGenerationStatus('idle')
    } finally {
      setIsGenerating(false)
    }
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
            Created{' '}
            {formatDistanceToNow(new Date(session.createdAt), {
              addSuffix: true,
            })}
          </div>
          {session.recordingStartedAt && (
            <div>
              Started{' '}
              {formatDistanceToNow(new Date(session.recordingStartedAt), {
                addSuffix: true,
              })}
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
                  {formatDuration(currentTime)} /{' '}
                  {formatDuration(displayDuration)}
                </div>
                {isLoading && (
                  <div className="text-xs text-muted-foreground">
                    Loading...
                  </div>
                )}
              </div>
              <input
                type="range"
                min="0"
                max={displayDuration > 0 ? displayDuration : 1}
                step="0.1"
                value={Math.min(
                  currentTime,
                  displayDuration > 0 ? displayDuration : 0
                )}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                style={{
                  background:
                    displayDuration > 0
                      ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                          (currentTime / displayDuration) * 100
                        }%, #e5e7eb ${
                          (currentTime / displayDuration) * 100
                        }%, #e5e7eb 100%)`
                      : 'linear-gradient(to right, #e5e7eb 0%, #e5e7eb 100%)',
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

      {/* Generate Transcript & Summary Button - Show if both are missing */}
      {!session.transcript && !session.summary && session.chunksCount > 0 && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">
                Generate Transcript & Summary
              </h2>
              <p className="text-sm text-muted-foreground">
                Combine all audio chunks and generate a complete transcript and
                AI-powered summary
              </p>
            </div>
            <Button
              onClick={handleGenerateTranscribeAndSummary}
              disabled={isGenerating}
              size="lg"
              className="ml-4"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {generationStatus === 'transcribing' && 'Transcribing...'}
                  {generationStatus === 'summarizing' &&
                    'Generating Summary...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Transcribe & Summary
                </>
              )}
            </Button>
          </div>
          {generationError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded text-sm text-red-600 dark:text-red-400">
              {generationError}
            </div>
          )}
        </Card>
      )}

      {/* Generate Summary Only Button - Show if transcript exists but summary doesn't */}
      {session.transcript && !session.summary && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Generate Summary</h2>
              <p className="text-sm text-muted-foreground">
                Generate an AI-powered summary from the existing transcript
              </p>
            </div>
            <Button
              onClick={handleGenerateSummaryOnly}
              disabled={isGenerating}
              size="lg"
              className="ml-4"
            >
              {isGenerating && generationStatus === 'summarizing' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Summary
                </>
              )}
            </Button>
          </div>
          {generationError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded text-sm text-red-600 dark:text-red-400">
              {generationError}
            </div>
          )}
        </Card>
      )}

      {/* Transcript Canvas - Scrollable, formatted display */}
      {(mergedTranscript || session.transcript) && (
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Transcript</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto p-4 bg-muted rounded-lg">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {mergedTranscript || session.transcript}
            </div>
          </div>
        </Card>
      )}

      {/* Summary Canvas - Scrollable, formatted display with rich text */}
      {session.summary && (
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Summary</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto p-4 bg-muted rounded-lg">
            <div
              className="prose prose-sm dark:prose-invert max-w-none leading-relaxed
                [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-foreground
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-foreground
                [&_strong]:font-bold [&_strong]:text-foreground [&_strong]:bg-yellow-100 [&_strong]:dark:bg-yellow-900 [&_strong]:px-1 [&_strong]:rounded
                [&_em]:italic [&_em]:text-foreground
                [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
                [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2
                [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2
                [&_li]:my-1
                [&_p]:my-2"
              dangerouslySetInnerHTML={{
                __html: formatSummaryMarkdown(session.summary),
              }}
            />
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
            chunk.blob && chunk.blob.size >= MIN_BLOB_SIZE && chunk.duration > 0
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
          if (session.duration && newCumulative <= session.duration) {
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
