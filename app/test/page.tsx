'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Upload,
  FileAudio,
  Loader2,
  CheckCircle,
  XCircle,
  Code,
  Mic,
  Square,
} from 'lucide-react'

export default function TestPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<{
    name: string
    size: number
    type: string
  } | null>(null)

  // Live recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setFileInfo({
        name: file.name,
        size: file.size,
        type: file.type || 'unknown',
      })
      setTranscript(null)
      setError(null)
    }
  }

  const handleTranscribe = async () => {
    if (!selectedFile) {
      setError('Please select an audio file first')
      return
    }

    setIsTranscribing(true)
    setError(null)
    setTranscript(null)

    try {
      const formData = new FormData()
      formData.append('audio', selectedFile)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed')
      }

      setTranscript(data.transcript || '')
      if (data.warning) {
        console.warn('Warning:', data.warning)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to transcribe audio'
      )
    } finally {
      setIsTranscribing(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      setError(null)
      setTranscript(null)
      setRecordedBlob(null)
      setAudioChunks([])
      setRecordingDuration(0)

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Find supported mime type
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else {
          mimeType = '' // Use default
        }
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
      })

      const chunks: Blob[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        setRecordedBlob(blob)
        setAudioChunks(chunks)
        setFileInfo({
          name: `recording-${Date.now()}.webm`,
          size: blob.size,
          type: blob.type || 'audio/webm',
        })
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)

      // Start timer
      const startTime = Date.now()
      const timer = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
      recordingTimerRef.current = timer
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to access microphone. Please check permissions.'
      )
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const handleTranscribeRecording = async () => {
    if (!recordedBlob) {
      setError('No recording available. Please record audio first.')
      return
    }

    setIsTranscribing(true)
    setError(null)
    setTranscript(null)

    try {
      const formData = new FormData()
      const audioFile = new File([recordedBlob], 'recording.webm', {
        type: recordedBlob.type || 'audio/webm',
      })
      formData.append('audio', audioFile)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed')
      }

      setTranscript(data.transcript || '')
      if (data.warning) {
        console.warn('Warning:', data.warning)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to transcribe audio'
      )
    } finally {
      setIsTranscribing(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Deepgram Speech-to-Text Test</h1>
        <p className="text-muted-foreground text-lg">
          Test and understand how Deepgram transcription works
        </p>
      </div>

      {/* How It Works Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Code className="h-6 w-6" />
          How Deepgram Works
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">1. Upload Audio File</h3>
            <p className="text-muted-foreground">
              Select an audio file (WebM, MP4, WAV, etc.) from your device.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. Send to API</h3>
            <p className="text-muted-foreground">
              The file is sent to{' '}
              <code className="bg-muted px-1 rounded">/api/transcribe</code>{' '}
              endpoint, which converts it to a Buffer and sends it to Deepgram.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3. Deepgram Processing</h3>
            <p className="text-muted-foreground">
              Deepgram uses the{' '}
              <code className="bg-muted px-1 rounded">nova-2</code> model to
              transcribe the audio with smart formatting and punctuation.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">4. Get Transcript</h3>
            <p className="text-muted-foreground">
              The transcript is extracted from the response and displayed here.
            </p>
          </div>
        </div>
      </Card>

      {/* Live Recording Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Mic className="h-6 w-6" />
          Live Voice Recording
        </h2>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Record your voice directly from the microphone and transcribe it
              with Deepgram.
            </p>

            {!isRecording && !recordedBlob && (
              <Button
                onClick={startRecording}
                className="w-full"
                size="lg"
                variant="default"
              >
                <Mic className="mr-2 h-4 w-4" />
                Start Recording
              </Button>
            )}

            {isRecording && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-lg font-mono">
                      {formatDuration(recordingDuration)}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={stopRecording}
                  className="w-full"
                  size="lg"
                  variant="destructive"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Recording
                </Button>
              </div>
            )}

            {recordedBlob && !isRecording && (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Recording Complete</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-mono">
                        {formatDuration(recordingDuration)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Size:</span>
                      <span>{formatFileSize(recordedBlob.size)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleTranscribeRecording}
                    disabled={isTranscribing}
                    className="flex-1"
                    size="lg"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <FileAudio className="mr-2 h-4 w-4" />
                        Transcribe Recording
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setRecordedBlob(null)
                      setRecordingDuration(0)
                      setTranscript(null)
                      setError(null)
                    }}
                    variant="outline"
                    size="lg"
                  >
                    Record Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* File Upload Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <FileAudio className="h-6 w-6" />
          Upload Audio File
        </h2>

        <div className="space-y-4">
          {/* File Input */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="audio-file-input"
            />
            <label
              htmlFor="audio-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-12 w-12 text-muted-foreground" />
              <span className="text-sm font-medium">
                {selectedFile ? 'Change File' : 'Choose Audio File'}
              </span>
              <span className="text-xs text-muted-foreground">
                Supports: WebM, MP4, WAV, OGG, and more
              </span>
            </label>
          </div>

          {/* File Info */}
          {fileInfo && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">File Name:</span>
                <span className="text-sm text-muted-foreground">
                  {fileInfo.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">File Size:</span>
                <span className="text-sm text-muted-foreground">
                  {formatFileSize(fileInfo.size)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">File Type:</span>
                <span className="text-sm text-muted-foreground">
                  {fileInfo.type}
                </span>
              </div>
            </div>
          )}

          {/* Transcribe Button */}
          <Button
            onClick={handleTranscribe}
            disabled={!selectedFile || isTranscribing}
            className="w-full"
            size="lg"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <FileAudio className="mr-2 h-4 w-4" />
                Transcribe Audio
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Results Section */}
      {(transcript !== null || error) && (
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Results</h2>

          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-semibold">Error</span>
              </div>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          )}

          {transcript !== null && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Transcription Successful</span>
              </div>

              {transcript ? (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-sm">Transcript:</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {transcript}
                  </p>
                  <div className="mt-3 pt-3 border-t border-muted-foreground/20">
                    <span className="text-xs text-muted-foreground">
                      Length: {transcript.length} characters
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground italic">
                    Empty transcript received. This might be silence or the
                    audio format is not supported.
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Code Example Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Code Example</h2>
        <div className="bg-muted rounded-lg p-4 overflow-x-auto">
          <pre className="text-xs">
            <code>{`// Client-side (this page)
const formData = new FormData()
formData.append('audio', audioFile)

const response = await fetch('/api/transcribe', {
  method: 'POST',
  body: formData,
})

const { transcript } = await response.json()

// Server-side (/api/transcribe/route.ts)
const deepgram = createClient(apiKey)
const buffer = Buffer.from(audioFile)

const { result } = await deepgram.listen.prerecorded.transcribeFile(
  buffer,
  {
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    punctuate: true,
  }
)

const transcript = result?.results?.channels?.[0]
  ?.alternatives?.[0]?.transcript`}</code>
          </pre>
        </div>
      </Card>

      {/* Current App Implementation */}
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-4">
          How It's Used in the App
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-semibold mb-1">Recording Flow:</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-4">
              <li>User records audio (30-second chunks)</li>
              <li>Each chunk is transcribed using this same API</li>
              <li>Chunk + transcript saved together to database</li>
              <li>Transcripts displayed in session details page</li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Files:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
              <li>
                <code className="bg-muted px-1 rounded">
                  app/api/transcribe/route.ts
                </code>{' '}
                - API endpoint
              </li>
              <li>
                <code className="bg-muted px-1 rounded">
                  lib/deepgram-file.ts
                </code>{' '}
                - Client helper
              </li>
              <li>
                <code className="bg-muted px-1 rounded">
                  hooks/useAudioRecorder.ts
                </code>{' '}
                - Uses transcription in recording
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
