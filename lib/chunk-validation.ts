/**
 * Chunk validation utilities
 * Validates chunk sequences and detects gaps
 */

export interface ChunkSequenceInfo {
  isValid: boolean
  gaps: number[]
  duplicates: number[]
  expectedCount: number
  actualCount: number
  lastIndex: number
}

/**
 * Validate chunk sequence for a session
 */
export function validateChunkSequence(
  chunkIndices: number[],
): ChunkSequenceInfo {
  if (chunkIndices.length === 0) {
    return {
      isValid: true,
      gaps: [],
      duplicates: [],
      expectedCount: 0,
      actualCount: 0,
      lastIndex: -1,
    }
  }

  const sorted = [...chunkIndices].sort((a, b) => a - b)
  const gaps: number[] = []
  const duplicates: number[] = []
  const seen = new Set<number>()

  // Check for duplicates
  for (const index of sorted) {
    if (seen.has(index)) {
      duplicates.push(index)
    }
    seen.add(index)
  }

  // Check for gaps
  const firstIndex = sorted[0]
  const lastIndex = sorted[sorted.length - 1]

  for (let i = firstIndex; i <= lastIndex; i++) {
    if (!seen.has(i)) {
      gaps.push(i)
    }
  }

  const expectedCount = lastIndex - firstIndex + 1
  const actualCount = sorted.length

  return {
    isValid: gaps.length === 0 && duplicates.length === 0,
    gaps,
    duplicates,
    expectedCount,
    actualCount,
    lastIndex,
  }
}

/**
 * Get expected next chunk index
 */
export function getExpectedNextChunkIndex(
  existingIndices: number[],
): number {
  if (existingIndices.length === 0) {
    return 0
  }

  const maxIndex = Math.max(...existingIndices)
  return maxIndex + 1
}

