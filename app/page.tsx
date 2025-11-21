'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RecordingPopup } from '@/components/RecordingPopup'
import { RecordingInterface } from '@/components/RecordingInterface'
import { useDevice } from '@/hooks/useDevice'
import { useSessions } from '@/hooks/useSessions'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer'
import { Mic } from 'lucide-react'
import { toast } from 'sonner'


export default function Home() {
  const [showPopup, setShowPopup] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [recordingMode, setRecordingMode] = useState<'mic' | 'system' | null>(
    null
  )

  const { deviceId } = useDevice()
  const { createSession, updateSession } = useSessions()
  const {
    isRecording,
    isPaused,
    duration,
    chunkCount,
    error: recorderError,
    start: startRecording,
    pause: pauseRecording,
    resume: resumeRecording,
    stop: stopRecording,
    getStream,
  } = useAudioRecorder()

  const stream = getStream()
  const {
    volume,
    frequency,
    dataArray,
    isAnalyzing,
    start: startAnalysis,
    stop: stopAnalysis,
  } = useAudioAnalyzer()

  // Start analysis when recording starts
  useEffect(() => {
    if (stream && isRecording && !isAnalyzing) {
      startAnalysis(stream).catch(console.error)
    } else if (!isRecording && isAnalyzing) {
      stopAnalysis()
    }
  }, [stream, isRecording, isAnalyzing, startAnalysis, stopAnalysis])

  // Auto-update session status when recording stops (including on page leave)
  useEffect(() => {
    if (!isRecording && currentSessionId && deviceId) {
      // Recording was stopped (either manually or by page leave)
      // Update session status in background
      const updateSessionStatus = async () => {
        try {
          const sessions = await fetch(
            `/api/sessions?deviceId=${deviceId}`
          ).then((r) => r.json())
          const session = sessions.sessions?.find(
            (s: any) => s.id === currentSessionId
          )

          if (session && session.status === 'recording') {
            // Only update if still in recording state (was stopped by page leave)
            await updateSession({
              ...session,
              status: 'completed',
              duration: Math.floor(duration / 1000),
            })
            toast.info('Recording auto-stopped', {
              description: 'Session saved automatically',
            })
          }
        } catch (error) {
          console.error('Error updating session status:', error)
          toast.error('Failed to save session', {
            description: 'Please check your connection',
          })
        }
      }

      updateSessionStatus()
    }
  }, [isRecording, currentSessionId, deviceId, duration, updateSession])

  // Show toast when chunk count changes (for progress indication)
  useEffect(() => {
    if (isRecording && chunkCount > 0 && chunkCount % 5 === 0) {
      // Show progress every 5 chunks
      toast.info(`Recording in progress`, {
        description: `${chunkCount} chunks saved (${Math.floor(duration / 1000)}s)`,
        duration: 2000,
      })
    }
  }, [chunkCount, isRecording, duration])

  const handleStartClick = () => {
    setShowPopup(true)
  }

  const handleQuickRecord = async () => {
    // Quick record with mic only - no popup
    await handleModeSelect('mic')
  }

  const handleModeSelect = async (mode: 'mic' | 'system') => {
    if (!deviceId) {
      alert('Device not initialized. Please wait...')
      return
    }

    setIsStarting(true)
    setRecordingMode(mode)

    try {
      console.log('Starting recording with mode:', mode)

      // Create new session
      const session = await createSession()
      if (!session) {
        throw new Error('Failed to create session')
      }

      console.log('Session created:', session.id)
      setCurrentSessionId(session.id)
      toast.success('Session created', {
        description: 'Recording session initialized',
      })

      // Update session status to recording
      // Note: recordingStartedAt will be set on the server side
      await updateSession({
        ...session,
        status: 'recording',
      })

      console.log('Session status updated to recording')

      // Start recording
      console.log('Calling startRecording...')
      await startRecording(mode, session.id)
      console.log('Recording started successfully')

      toast.success('Recording started', {
        description: `Mode: ${mode === 'mic' ? 'Microphone' : 'System Audio + Mic'}`,
      })

      setShowPopup(false)
    } catch (error) {
      console.error('Error starting recording:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to start recording. Please check permissions.'

      // Show user-friendly error
      toast.error('Recording failed', {
        description: errorMessage,
        duration: 5000,
      })

      // Reset state
      setCurrentSessionId(null)
      setRecordingMode(null)
    } finally {
      setIsStarting(false)
    }
  }

  const handlePause = () => {
    pauseRecording()
    toast.info('Recording paused', {
      description: 'Audio capture is paused',
    })
  }

  const handleResume = () => {
    resumeRecording()
    toast.success('Recording resumed', {
      description: 'Audio capture continues',
    })
  }

  const handleStop = async () => {
    if (!currentSessionId) return

    try {
      // Stop recording
      const finalBlob = await stopRecording()

      // Stop analysis
      stopAnalysis()

      // Update session status
      const sessions = await fetch(`/api/sessions?deviceId=${deviceId}`).then(
        (r) => r.json()
      )
      const session = sessions.sessions?.find(
        (s: any) => s.id === currentSessionId
      )

      if (session) {
        await updateSession({
          ...session,
          status: 'completed',
          duration: Math.floor(duration / 1000), // Convert to seconds
        })
      }

      const durationSeconds = Math.floor(duration / 1000)
      const minutes = Math.floor(durationSeconds / 60)
      const seconds = durationSeconds % 60

      toast.success('Recording stopped', {
        description: `Duration: ${minutes}:${seconds.toString().padStart(2, '0')} • ${chunkCount} chunks saved`,
        duration: 4000,
      })

      setCurrentSessionId(null)
      setRecordingMode(null)
    } catch (error) {
      console.error('Error stopping recording:', error)
      toast.error('Failed to stop recording', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-full p-8">
        {isRecording ? (
          <RecordingInterface
            isPaused={isPaused}
            duration={duration}
            volume={volume}
            dataArray={dataArray}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
        ) : (
          <div className="text-center space-y-8">
            <h1 className="text-4xl font-bold">ScribeAI</h1>
            <p className="text-muted-foreground text-lg">
              AI-Powered Audio Transcription
            </p>
            <div className="flex flex-col gap-4 items-center">
              <Button
                size="lg"
                onClick={handleQuickRecord}
                className="h-20 w-64 text-xl gap-3"
                disabled={isStarting}
              >
                <Mic className="h-8 w-8" />
                Quick Record (Mic)
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleStartClick}
                className="h-16 w-64 text-lg gap-2"
                disabled={isStarting}
              >
                <Mic className="h-6 w-6" />
                Advanced Options
              </Button>
            </div>
            {recorderError && (
              <div className="text-red-500 text-sm mt-4">{recorderError}</div>
            )}
            {isStarting && (
              <div className="text-muted-foreground text-sm">
                Starting recording...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recording Popup */}
      <RecordingPopup
        open={showPopup}
        onClose={() => {
          if (!isStarting) {
            setShowPopup(false)
          }
        }}
        onSelect={handleModeSelect}
        isLoading={isStarting}
      />
    </>
  )
}
