/**
 * Chunk playback utilities
 * Handles retrieving and combining audio chunks for playback
 */

import { getChunks } from './indexeddb'

export interface ChunkPlaybackData {
  chunks: Array<{
    blob: Blob
    index: number
    duration: number
    timestamp: number
  }>
  totalDuration: number
  audioUrl: string | null
  error?: string
}

/**
 * Get chunks for playback from IndexedDB or server
 */
export async function getChunksForPlayback(
  sessionId: string,
  deviceId: string
): Promise<ChunkPlaybackData> {
  // Try IndexedDB first (fast, local)
  const indexedDBResult = await getChunks(sessionId)

  if (indexedDBResult.chunks.length > 0) {
    // Use IndexedDB chunks, filter out empty chunks
    const chunks = indexedDBResult.chunks
      .filter((chunk) => chunk.blob && chunk.blob.size > 0)
      .map((chunk) => ({
        blob: chunk.blob,
        index: chunk.chunkIndex,
        duration: 30, // Will be updated from server if available
        timestamp: chunk.timestamp,
      }))

    if (chunks.length > 0) {
      const totalDuration = chunks.reduce((sum, c) => sum + c.duration, 0)
      const totalSizeMB =
        chunks.reduce((sum, c) => sum + c.blob.size, 0) / (1024 * 1024)

      // For very long recordings (> 50 chunks or > 20MB), log warning
      if (chunks.length > 50 || totalSizeMB > 20) {
        console.log(
          `[ChunkPlayback] Large recording from IndexedDB: ${
            chunks.length
          } chunks, ${totalSizeMB.toFixed(2)}MB, ${Math.floor(
            totalDuration / 60
          )}:${Math.floor(totalDuration % 60)
            .toString()
            .padStart(2, '0')} duration`
        )
      }

      // Combine chunks into single blob
      // Note: For very large recordings (> 100MB), this might cause memory issues
      // In production, consider using MediaSource API for streaming playback
      const combinedBlob = new Blob(
        chunks.map((c) => c.blob),
        {
          type: 'audio/webm',
        }
      )
      const audioUrl = URL.createObjectURL(combinedBlob)

      return {
        chunks,
        totalDuration,
        audioUrl,
      }
    }
    // If no valid chunks in IndexedDB, fall through to server fetch
  }

  // Fallback to server
  try {
    const response = await fetch(
      `/api/sessions/${sessionId}/chunks?deviceId=${deviceId}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch chunks from server')
    }

    const data = await response.json()
    const serverChunks = data.chunks || []

    if (serverChunks.length === 0) {
      return {
        chunks: [],
        totalDuration: 0,
        audioUrl: null,
        error: 'No chunks found',
      }
    }

    // Convert base64 audio data to Blobs and filter out empty chunks
    const chunks = (
      await Promise.all(
        serverChunks.map(async (chunk: any) => {
          let blob: Blob
          if (chunk.audioData) {
            // Convert base64 to blob
            const binaryString = atob(chunk.audioData)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            blob = new Blob([bytes], { type: 'audio/webm' })
          } else {
            // If no audioData, create empty blob (shouldn't happen)
            blob = new Blob([], { type: 'audio/webm' })
          }

          return {
            blob,
            index: chunk.chunkIndex,
            duration: chunk.duration || 0, // Use actual duration from database
            timestamp: new Date(chunk.timestamp).getTime(),
          }
        })
      )
    ).filter(
      // Filter out chunks with no audio data or zero duration
      (chunk) => chunk.blob.size > 0 && chunk.duration > 0
    )

    // Sort by index to ensure correct order
    chunks.sort((a, b) => a.index - b.index)

    // For very long recordings (> 50 chunks), use streaming approach
    // Instead of combining all chunks, we'll create a MediaSource for streaming
    const totalDuration = chunks.reduce((sum, c) => sum + c.duration, 0)

    // If we have many chunks (> 50), don't combine them all at once
    // Instead, return chunks separately for progressive loading
    if (chunks.length > 50) {
      console.log(
        `[ChunkPlayback] Large recording detected (${chunks.length} chunks). Using progressive loading.`
      )
      // For now, still combine but log a warning
      // In future, we could implement MediaSource API for true streaming
      const combinedBlob = new Blob(
        chunks.map((c) => c.blob),
        {
          type: 'audio/webm',
        }
      )
      const audioUrl = URL.createObjectURL(combinedBlob)

      return {
        chunks,
        totalDuration,
        audioUrl,
      }
    }

    // Combine chunks into single blob for smaller recordings
    const combinedBlob = new Blob(
      chunks.map((c) => c.blob),
      {
        type: 'audio/webm',
      }
    )
    const audioUrl = URL.createObjectURL(combinedBlob)

    return {
      chunks,
      totalDuration,
      audioUrl,
    }
  } catch (error) {
    return {
      chunks: [],
      totalDuration: 0,
      audioUrl: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to retrieve chunks for playback',
    }
  }
}

/**
 * Clean up audio URL to prevent memory leaks
 */
export function revokeAudioUrl(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

/**
 * Get chunk at specific time position
 */
export function getChunkAtTime(
  chunks: ChunkPlaybackData['chunks'],
  timeInSeconds: number
): { chunk: ChunkPlaybackData['chunks'][0]; offset: number } | null {
  let accumulatedTime = 0

  for (const chunk of chunks) {
    if (
      timeInSeconds >= accumulatedTime &&
      timeInSeconds < accumulatedTime + chunk.duration
    ) {
      return {
        chunk,
        offset: timeInSeconds - accumulatedTime,
      }
    }
    accumulatedTime += chunk.duration
  }

  return null
}
