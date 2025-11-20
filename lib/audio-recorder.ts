/**
 * Audio recording utilities
 * Handles MediaRecorder setup, chunking, and persistence
 */

export type RecordingMode = 'mic' | 'system'

export interface RecordingOptions {
  mode: RecordingMode
  chunkDuration: number // in milliseconds (default: 30000 = 30s)
  onChunk?: (
    chunk: Blob,
    index: number,
    duration: number,
    transcript?: string
  ) => void
  onError?: (error: Error) => void
  onTranscriptUpdate?: (transcript: string) => void // Real-time transcript updates
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number // in milliseconds
  chunkCount: number
  error: string | null
}

/**
 * Audio Recorder class
 * Handles audio capture, chunking, and upload
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioStream: MediaStream | null = null
  private audioContext: AudioContext | null = null // For mixing system audio + mic
  private chunks: Blob[] = []
  private chunkIndex = 0
  private startTime = 0
  private pausedTime = 0
  private totalPausedDuration = 0
  private chunkTimer: NodeJS.Timeout | null = null
  private chunkStartTime = 0 // Track when current chunk started
  private isStopping = false // Track if we're in the process of stopping
  private finalChunkPromise: {
    resolve: (chunk: Blob | null) => void
    reject: (error: Error) => void
  } | null = null
  private options: RecordingOptions
  private state: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    chunkCount: 0,
    error: null,
  }
  private stateListeners: ((state: RecordingState) => void)[] = []

  constructor(options: RecordingOptions) {
    this.options = {
      ...options,
      chunkDuration: options.chunkDuration ?? 30000, // 30 seconds default
    }
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: RecordingState) => void) {
    this.stateListeners.push(listener)
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener)
    }
  }

  private notifyStateChange() {
    this.stateListeners.forEach((listener) => listener({ ...this.state }))
  }

  /**
   * Request microphone access
   */
  private async requestMicrophone(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      return stream
    } catch (error) {
      throw new Error(
        `Microphone access denied: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  /**
   * Request system audio (screen share audio) + microphone
   * Combines both system/tab audio (Google Meet, Zoom, etc.) and microphone
   */
  private async requestSystemAudio(): Promise<MediaStream> {
    let displayStream: MediaStream | null = null
    let micStream: MediaStream | null = null

    try {
      // Step 1: Get display media (tab/system audio)
      try {
        // Try audio-only first (Chrome/Edge support this)
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: true,
          })
        } catch (audioOnlyError) {
          // Fallback: Request with video (required by some browsers)
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Required by some browsers
            audio: true,
          })

          // Stop video tracks immediately (we only need audio)
          displayStream.getVideoTracks().forEach((track) => {
            track.stop()
          })
        }

        // Wait a bit for audio tracks to be added (some browsers add them after user confirms)
        await new Promise((resolve) => setTimeout(resolve, 200))

        // Check if we got audio tracks
        if (!displayStream || displayStream.getAudioTracks().length === 0) {
          throw new Error(
            'No audio tracks available. Please make sure to:\n' +
              '1. Select a tab/window with audio (e.g., Google Meet tab)\n' +
              '2. Check the "Share tab audio" checkbox in the share dialog\n' +
              '3. Click "Share"'
          )
        }
      } catch (displayError) {
        const errorMessage =
          displayError instanceof Error ? displayError.message : 'Unknown error'

        // Provide more helpful error messages
        if (
          errorMessage.includes('NotAllowedError') ||
          errorMessage.includes('Permission denied')
        ) {
          throw new Error(
            'Screen sharing permission denied. Please allow screen sharing and make sure to check "Share tab audio" in the share dialog.'
          )
        } else if (
          errorMessage.includes('NotSupportedError') ||
          errorMessage.includes('Not supported')
        ) {
          throw new Error(
            'System audio capture is not supported in this browser. Please use "System Mic Only" instead.'
          )
        } else {
          throw displayError
        }
      }

      // Step 2: Get microphone audio (mandatory for system mode)
      console.log(
        '[AudioRecorder] Requesting microphone for system audio mode...'
      )
      try {
        micStream = await this.requestMicrophone()
        console.log('[AudioRecorder] Microphone obtained:', {
          tracks: micStream.getAudioTracks().length,
          trackIds: micStream.getAudioTracks().map((t) => t.id),
        })
      } catch (micError) {
        const errorMessage =
          micError instanceof Error ? micError.message : 'Unknown error'
        console.error(
          '[AudioRecorder] Microphone request failed:',
          errorMessage
        )

        // Don't silently fail - user needs to know microphone is required
        if (displayStream) {
          displayStream.getTracks().forEach((track) => track.stop())
        }
        throw new Error(
          `Microphone access is required for "Complete System Voice" mode. ` +
            `Please allow microphone access and try again. Error: ${errorMessage}`
        )
      }

      // Step 3: Mix both streams using AudioContext
      if (!micStream || micStream.getAudioTracks().length === 0) {
        if (displayStream) {
          displayStream.getTracks().forEach((track) => track.stop())
        }
        throw new Error('Microphone stream is empty')
      }

      if (!displayStream || displayStream.getAudioTracks().length === 0) {
        if (micStream) {
          micStream.getTracks().forEach((track) => track.stop())
        }
        throw new Error('System audio stream is empty')
      }

      console.log(
        '[AudioRecorder] Mixing system audio and microphone using AudioContext...'
      )

      // Use AudioContext to properly mix both streams into a single track
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)()
      const destination = this.audioContext.createMediaStreamDestination()

      // Create source nodes for both streams
      const systemAudioSource =
        this.audioContext.createMediaStreamSource(displayStream)
      const micAudioSource =
        this.audioContext.createMediaStreamSource(micStream)

      // Optional: Create gain nodes for volume control (both at 1.0 = full volume)
      const systemGain = this.audioContext.createGain()
      systemGain.gain.value = 1.0

      const micGain = this.audioContext.createGain()
      micGain.gain.value = 1.0

      // Connect: source -> gain -> destination
      systemAudioSource.connect(systemGain)
      systemGain.connect(destination)

      micAudioSource.connect(micGain)
      micGain.connect(destination)

      console.log('[AudioRecorder] Streams mixed successfully:', {
        outputTracks: destination.stream.getAudioTracks().length,
        systemTracks: displayStream.getAudioTracks().length,
        micTracks: micStream.getAudioTracks().length,
      })

      // Return the mixed stream (single audio track with both sources)
      return destination.stream
    } catch (error) {
      // Clean up any streams that were created
      if (displayStream) {
        displayStream.getTracks().forEach((track) => track.stop())
      }
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop())
      }

      throw error
    }
  }

  /**
   * Start recording
   */
  async start(): Promise<void> {
    try {
      this.state.error = null
      console.log(
        '[AudioRecorder] Starting recording with mode:',
        this.options.mode
      )

      // Request appropriate media stream
      if (this.options.mode === 'mic') {
        console.log('[AudioRecorder] Requesting microphone...')
        this.audioStream = await this.requestMicrophone()
        console.log('[AudioRecorder] Microphone stream obtained')
      } else {
        console.log('[AudioRecorder] Requesting system audio...')
        this.audioStream = await this.requestSystemAudio()
        console.log('[AudioRecorder] System audio stream obtained')
      }

      // Verify stream is active
      if (!this.audioStream || this.audioStream.getTracks().length === 0) {
        throw new Error('No active audio tracks in stream')
      }

      const activeTracks = this.audioStream
        .getTracks()
        .filter((track) => track.readyState === 'live')
      if (activeTracks.length === 0) {
        throw new Error('No live audio tracks in stream')
      }

      console.log('[AudioRecorder] Stream verified:', {
        totalTracks: this.audioStream.getTracks().length,
        activeTracks: activeTracks.length,
        trackStates: this.audioStream.getTracks().map((t) => ({
          kind: t.kind,
          readyState: t.readyState,
          enabled: t.enabled,
        })),
      })

      // Determine supported mime type
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Try fallback formats
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg'
        } else {
          // Use default if no specific format is supported
          mimeType = ''
        }
      }

      // Create MediaRecorder with options
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 128000,
      }
      if (mimeType) {
        options.mimeType = mimeType
      }

      try {
        console.log(
          '[AudioRecorder] Creating MediaRecorder with mimeType:',
          mimeType || 'default'
        )
        this.mediaRecorder = new MediaRecorder(this.audioStream, options)
        console.log('[AudioRecorder] MediaRecorder created successfully')
      } catch (error) {
        console.error('[AudioRecorder] Failed to create MediaRecorder:', error)
        throw new Error(
          `Failed to create MediaRecorder: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }

      // Handle data available events
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data)

          // Calculate actual chunk duration
          const now = Date.now()
          const actualDuration =
            this.chunkStartTime > 0
              ? (now - this.chunkStartTime) / 1000 // Convert to seconds
              : this.options.chunkDuration / 1000 // Fallback to expected duration

          // If we're stopping, this is the final chunk
          if (this.isStopping && this.finalChunkPromise) {
            console.log(
              '[AudioRecorder] Final chunk received:',
              actualDuration.toFixed(2),
              'seconds'
            )
            // Process final chunk through onChunk callback with correct index
            if (this.options.onChunk) {
              this.options.onChunk(event.data, this.chunkIndex, actualDuration)
            }
            // Update chunk count for final chunk
            this.chunkIndex++
            this.state.chunkCount = this.chunkIndex
            // Resolve the promise to indicate final chunk is ready
            this.finalChunkPromise.resolve(event.data)
            this.finalChunkPromise = null
          } else if (this.options.onChunk) {
            // Regular chunk processing
            this.options.onChunk(event.data, this.chunkIndex, actualDuration)
            // Reset chunk start time for next chunk
            this.chunkStartTime = now
            this.chunkIndex++
            this.state.chunkCount = this.chunkIndex
          }
        } else if (this.isStopping && this.finalChunkPromise) {
          // If we're stopping and got empty data, there's no final chunk
          console.log('[AudioRecorder] No final chunk data available')
          this.finalChunkPromise.resolve(null)
          this.finalChunkPromise = null
        }
      }

      this.mediaRecorder.onerror = (event) => {
        const error = new Error('MediaRecorder error')
        this.state.error = error.message
        this.notifyStateChange()
        if (this.options.onError) {
          this.options.onError(error)
        }
      }

      // Start recording with timeslice for chunking
      console.log('[AudioRecorder] Starting MediaRecorder...')
      console.log(
        '[AudioRecorder] MediaRecorder state before start:',
        this.mediaRecorder.state
      )

      if (this.mediaRecorder.state !== 'inactive') {
        console.warn(
          '[AudioRecorder] MediaRecorder is not inactive, current state:',
          this.mediaRecorder.state
        )
        // Try to stop and reset if needed
        if (this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop()
        }
      }

      try {
        this.mediaRecorder.start(this.options.chunkDuration)
        console.log(
          '[AudioRecorder] MediaRecorder.start() called, new state:',
          this.mediaRecorder.state
        )
      } catch (startError) {
        console.error(
          '[AudioRecorder] Error calling MediaRecorder.start():',
          startError
        )
        throw new Error(
          `Failed to start MediaRecorder: ${
            startError instanceof Error ? startError.message : 'Unknown error'
          }`
        )
      }

      this.startTime = Date.now()
      this.chunkStartTime = this.startTime // Initialize chunk start time
      this.state.isRecording = true
      this.state.isPaused = false
      console.log('[AudioRecorder] Recording started, state updated')
      this.notifyStateChange()

      // Update duration periodically
      this.updateDuration()
      console.log('[AudioRecorder] Duration update interval started')
    } catch (error) {
      this.state.error =
        error instanceof Error ? error.message : 'Failed to start recording'
      this.state.isRecording = false
      this.notifyStateChange()
      throw error
    }
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (!this.mediaRecorder || this.state.isPaused) return

    this.mediaRecorder.pause()
    this.pausedTime = Date.now()
    // Adjust chunk start time to account for pause
    const pauseDuration = this.pausedTime - this.chunkStartTime
    this.chunkStartTime = this.pausedTime
    this.state.isPaused = true
    this.notifyStateChange()
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (!this.mediaRecorder || !this.state.isPaused) return

    this.mediaRecorder.resume()
    // Add paused duration to total
    const now = Date.now()
    this.totalPausedDuration += now - this.pausedTime
    // Adjust chunk start time to account for pause duration
    this.chunkStartTime = now
    this.pausedTime = 0
    this.state.isPaused = false
    this.notifyStateChange()
  }

  /**
   * Stop recording
   */
  async stop(): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      // Store reference to mediaRecorder at the start to prevent race conditions
      const mediaRecorder = this.mediaRecorder

      if (!mediaRecorder) {
        reject(new Error('No active recording'))
        return
      }

      if (mediaRecorder.state === 'inactive') {
        reject(new Error('Recording is not active'))
        return
      }

      try {
        console.log('[AudioRecorder] Stopping recording...')

        // Set stopping flag
        this.isStopping = true

        // Request final chunk data before stopping
        // This will trigger ondataavailable with any buffered data
        console.log('[AudioRecorder] Requesting final chunk data...')
        mediaRecorder.requestData()

        // Wait for final chunk to be processed (with timeout)
        const finalChunkReceived = new Promise<Blob | null>(
          (resolveChunk, rejectChunk) => {
            this.finalChunkPromise = {
              resolve: resolveChunk,
              reject: rejectChunk,
            }

            // Timeout after 2 seconds if final chunk doesn't arrive
            setTimeout(() => {
              if (this.finalChunkPromise) {
                console.warn(
                  '[AudioRecorder] Timeout waiting for final chunk, proceeding with stop'
                )
                this.finalChunkPromise.resolve(null)
                this.finalChunkPromise = null
              }
            }, 2000)
          }
        )

        // Wait for final chunk to be processed
        const finalChunk = await finalChunkReceived

        if (finalChunk) {
          console.log(
            '[AudioRecorder] Final chunk processed, duration:',
            ((Date.now() - this.chunkStartTime) / 1000).toFixed(2),
            'seconds'
          )
        } else {
          console.log('[AudioRecorder] No final chunk to process')
        }

        // Give a small delay to ensure chunk upload completes
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Re-check mediaRecorder is still valid after async operations
        if (!this.mediaRecorder || this.mediaRecorder !== mediaRecorder) {
          console.warn(
            '[AudioRecorder] MediaRecorder was cleared during stop, cleaning up'
          )
          this.isStopping = false
          this.finalChunkPromise = null
          reject(new Error('Recording was stopped by another operation'))
          return
        }

        // Now actually stop the MediaRecorder
        mediaRecorder.onstop = () => {
          console.log('[AudioRecorder] MediaRecorder stopped')
          // Get final blob from all chunks
          if (this.chunks.length > 0) {
            const finalBlob = new Blob(this.chunks, { type: 'audio/webm' })
            this.cleanup()
            resolve(finalBlob)
          } else {
            this.cleanup()
            reject(new Error('No audio data recorded'))
          }
        }

        mediaRecorder.stop()
        this.state.isRecording = false
        this.notifyStateChange()
      } catch (error) {
        console.error('[AudioRecorder] Error during stop:', error)
        this.isStopping = false
        this.finalChunkPromise = null
        // Only cleanup if mediaRecorder is still the same one we started with
        if (this.mediaRecorder === mediaRecorder) {
          this.cleanup()
        }
        reject(
          error instanceof Error ? error : new Error('Failed to stop recording')
        )
      }
    })
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return { ...this.state }
  }

  /**
   * Get current audio stream (for analysis)
   */
  getStream(): MediaStream | null {
    return this.audioStream
  }

  /**
   * Update duration periodically
   */
  private updateDuration() {
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
    }

    this.chunkTimer = setInterval(() => {
      if (this.state.isRecording && !this.state.isPaused) {
        const elapsed = Date.now() - this.startTime - this.totalPausedDuration
        this.state.duration = elapsed
        this.notifyStateChange()
      }
    }, 100) // Update every 100ms for smooth timer
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
      this.chunkTimer = null
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop())
      this.audioStream = null
    }

    // Close AudioContext if it was created for mixing
    if (this.audioContext) {
      this.audioContext.close().catch((error) => {
        console.warn('[AudioRecorder] Error closing AudioContext:', error)
      })
      this.audioContext = null
    }

    this.mediaRecorder = null
    this.chunks = []
    this.chunkIndex = 0
    this.startTime = 0
    this.chunkStartTime = 0
    this.pausedTime = 0
    this.totalPausedDuration = 0
    this.isStopping = false
    this.finalChunkPromise = null
  }
}
