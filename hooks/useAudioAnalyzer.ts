'use client'

import { useState, useEffect, useRef } from 'react'
import { AudioAnalyzer, AudioAnalysis } from '@/lib/audio-analyzer'

interface UseAudioAnalyzerReturn {
  volume: number // 0-100
  frequency: number // Hz
  dataArray: Uint8Array | null
  isAnalyzing: boolean
  start: (stream: MediaStream) => Promise<void>
  stop: () => void
}

/**
 * React hook for audio analysis and visualization
 */
export function useAudioAnalyzer(): UseAudioAnalyzerReturn {
  const [analysis, setAnalysis] = useState<AudioAnalysis>({
    volume: 0,
    frequency: 0,
    dataArray: new Uint8Array(0),
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analyzerRef = useRef<AudioAnalyzer | null>(null)

  // Start analysis
  const start = async (stream: MediaStream) => {
    try {
      const analyzer = new AudioAnalyzer()
      await analyzer.initialize(stream)

      // Subscribe to analysis updates
      analyzer.onAnalysis((newAnalysis) => {
        setAnalysis(newAnalysis)
      })

      analyzer.start()
      analyzerRef.current = analyzer
      setIsAnalyzing(true)
    } catch (error) {
      console.error('Failed to start audio analysis:', error)
      throw error
    }
  }

  // Stop analysis
  const stop = () => {
    if (analyzerRef.current) {
      analyzerRef.current.stop()
      analyzerRef.current.cleanup()
      analyzerRef.current = null
    }
    setIsAnalyzing(false)
    setAnalysis({
      volume: 0,
      frequency: 0,
      dataArray: new Uint8Array(0),
    })
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [])

  return {
    volume: analysis.volume,
    frequency: analysis.frequency,
    dataArray: analysis.dataArray,
    isAnalyzing,
    start,
    stop,
  }
}

