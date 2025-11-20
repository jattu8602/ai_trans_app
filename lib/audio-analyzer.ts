/**
 * Audio analysis utilities
 * Handles real-time audio analysis for pitch visualization
 */

export interface AudioAnalysis {
  volume: number // 0-100
  frequency: number // Hz
  dataArray: Uint8Array // Raw frequency data
}

/**
 * Audio Analyzer class
 * Analyzes audio stream for visualization
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private dataArray: Uint8Array | null = null
  private animationFrameId: number | null = null
  private listeners: ((analysis: AudioAnalysis) => void)[] = []

  /**
   * Initialize analyzer with audio stream
   */
  async initialize(stream: MediaStream): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)()

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(stream)

      // Connect microphone to analyser
      this.microphone.connect(this.analyser)

      // Create data array
      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)
    } catch (error) {
      throw new Error(
        `Failed to initialize audio analyzer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Subscribe to analysis updates
   */
  onAnalysis(listener: (analysis: AudioAnalysis) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Start analysis loop
   */
  start() {
    if (!this.analyser || !this.dataArray) {
      throw new Error('Analyzer not initialized')
    }

    const analyze = () => {
      if (!this.analyser || !this.dataArray) return

      // Get frequency data
      this.analyser.getByteFrequencyData(this.dataArray)

      // Calculate volume (average of all frequencies)
      let sum = 0
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i]
      }
      const average = sum / this.dataArray.length
      const volume = Math.min(100, (average / 255) * 100)

      // Find dominant frequency
      let maxIndex = 0
      let maxValue = 0
      for (let i = 0; i < this.dataArray.length; i++) {
        if (this.dataArray[i] > maxValue) {
          maxValue = this.dataArray[i]
          maxIndex = i
        }
      }

      // Convert index to frequency (approximate)
      const nyquist = (this.audioContext?.sampleRate || 44100) / 2
      const frequency = (maxIndex * nyquist) / this.dataArray.length

      // Notify listeners
      const analysis: AudioAnalysis = {
        volume,
        frequency,
        dataArray: new Uint8Array(this.dataArray),
      }

      this.listeners.forEach((listener) => listener(analysis))

      // Continue loop
      this.animationFrameId = requestAnimationFrame(analyze)
    }

    analyze()
  }

  /**
   * Stop analysis
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stop()

    if (this.microphone) {
      this.microphone.disconnect()
      this.microphone = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.dataArray = null
    this.listeners = []
  }
}

