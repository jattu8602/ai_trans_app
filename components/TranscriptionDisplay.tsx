'use client'

import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Mic } from 'lucide-react'

interface TranscriptionDisplayProps {
  transcript: string
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

/**
 * Bottom component displaying real-time transcription during recording
 */
export function TranscriptionDisplay({
  transcript,
  isConnected,
  isConnecting,
  error,
}: TranscriptionDisplayProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Debug logging
  useEffect(() => {
    console.log('[TranscriptionDisplay] Props updated:', {
      transcriptLength: transcript?.length || 0,
      transcriptPreview: transcript?.substring(0, 50) || '(empty)',
      isConnected,
      isConnecting,
      error,
    })
  }, [transcript, isConnected, isConnecting, error])

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcript])

  // Always show if connected or connecting (even if transcript is empty)
  if (!isConnected && !isConnecting && !transcript) {
    return null // Don't show if not connected and no transcript
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Live Transcription
            </span>
            {isConnecting && (
              <span className="text-xs text-muted-foreground animate-pulse">
                Connecting...
              </span>
            )}
            {isConnected && (
              <span className="text-xs text-green-600 dark:text-green-400">
                ● Connected
              </span>
            )}
            {error && (
              <span className="text-xs text-red-600 dark:text-red-400">
                Error: {error}
              </span>
            )}
          </div>

          {/* Transcript Content */}
          <div className="max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {transcript && transcript.trim() ? (
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {transcript}
                <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-1" />
              </p>
            ) : isConnected ? (
              <p className="text-sm text-muted-foreground italic">
                Listening... Speak to see transcription
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {isConnecting
                  ? 'Connecting to transcription service...'
                  : 'Waiting for audio...'}
              </p>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </Card>
    </div>
  )
}

