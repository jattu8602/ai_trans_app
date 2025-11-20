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
import { getDeviceId } from '@/lib/device'

export default function Home() {
  const [showPopup, setShowPopup] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [recordingMode, setRecordingMode] = useState<'mic' | 'system' | null>(
    null
  )

  const { deviceId, isLoading: deviceLoading } = useDevice()
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
          }
        } catch (error) {
          console.error('Error updating session status:', error)
        }
      }

      updateSessionStatus()
    }
  }, [isRecording, currentSessionId, deviceId, duration, updateSession])

  const handleStartClick = () => {
    setShowPopup(true)
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

      setShowPopup(false)
    } catch (error) {
      console.error('Error starting recording:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to start recording. Please check permissions.'

      // Show user-friendly error
      alert(`Recording Error: ${errorMessage}`)

      // Reset state
      setCurrentSessionId(null)
      setRecordingMode(null)
    } finally {
      setIsStarting(false)
    }
  }

  const handlePause = () => {
    pauseRecording()
  }

  const handleResume = () => {
    resumeRecording()
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

      setCurrentSessionId(null)
      setRecordingMode(null)
    } catch (error) {
      console.error('Error stopping recording:', error)
      alert('Failed to stop recording')
    }
  }

  if (deviceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg">Initializing...</div>
        </div>
      </div>
    )
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
            <Button
              size="lg"
              onClick={handleStartClick}
              className="h-20 w-64 text-xl gap-3"
            >
              <Mic className="h-8 w-8" />
              Start Recording
            </Button>
            {recorderError && (
              <div className="text-red-500 text-sm mt-4">{recorderError}</div>
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
