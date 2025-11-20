'use client'

import { Button } from '@/components/ui/button'
import { Timer } from './Timer'
import { PitchVisualizer } from './PitchVisualizer'
import { Pause, Play, Square } from 'lucide-react'

interface RecordingInterfaceProps {
  isPaused: boolean
  duration: number
  volume: number
  dataArray: Uint8Array | null
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function RecordingInterface({
  isPaused,
  duration,
  volume,
  dataArray,
  onPause,
  onResume,
  onStop,
}: RecordingInterfaceProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 p-8">
      {/* Timer */}
      <Timer
        duration={duration}
        isPaused={isPaused}
        className="text-center"
      />

      {/* Pitch Visualizer */}
      <div className="w-full max-w-2xl">
        <PitchVisualizer
          dataArray={dataArray}
          volume={volume}
          className="w-full"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        {isPaused ? (
          <Button
            size="lg"
            onClick={onResume}
            className="gap-2"
          >
            <Play className="h-5 w-5" />
            Resume
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            onClick={onPause}
            className="gap-2"
          >
            <Pause className="h-5 w-5" />
            Pause
          </Button>
        )}

        <Button
          size="lg"
          variant="destructive"
          onClick={onStop}
          className="gap-2"
        >
          <Square className="h-5 w-5" />
          Stop
        </Button>
      </div>
    </div>
  )
}

