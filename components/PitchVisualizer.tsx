'use client'

import { useEffect, useRef } from 'react'

interface PitchVisualizerProps {
  dataArray: Uint8Array | null
  volume: number // 0-100
  className?: string
}

export function PitchVisualizer({
  dataArray,
  volume,
  className,
}: PitchVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !dataArray) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const width = canvas.width
      const height = canvas.height

      // Clear canvas
      ctx.fillStyle = 'rgb(0, 0, 0)'
      ctx.fillRect(0, 0, width, height)

      // Draw frequency bars
      const barWidth = width / dataArray.length
      let x = 0

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * height

        // Color based on volume (green to red)
        const hue = (volume / 100) * 120 // 0 (green) to 120 (red)
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`

        ctx.fillRect(x, height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [dataArray, volume])

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full h-full rounded-lg"
      />
      <div className="mt-2 text-center text-sm text-muted-foreground">
        Volume: {Math.round(volume)}%
      </div>
    </div>
  )
}

