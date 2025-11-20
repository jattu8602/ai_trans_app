'use client'

import { useEffect, useState } from 'react'

interface TimerProps {
  duration: number // milliseconds - elapsed time
  isPaused: boolean
  className?: string
}

export function Timer({ duration, isPaused, className }: TimerProps) {
  const [elapsed, setElapsed] = useState(duration)

  useEffect(() => {
    setElapsed(duration)
  }, [duration])

  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 100)
    }, 100)

    return () => clearInterval(interval)
  }, [isPaused])

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className={className}>
      <div className="text-4xl font-mono font-bold tabular-nums">
        {formatTime(elapsed)}
      </div>
    </div>
  )
}

