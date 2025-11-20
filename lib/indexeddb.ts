/**
 * IndexedDB utilities for persistent audio chunk storage
 */

const DB_NAME = 'ScribeAI'
const DB_VERSION = 1
const STORE_CHUNKS = 'audioChunks'
const STORE_RECORDING = 'recordingState'

interface AudioChunkData {
  id: string
  sessionId: string
  chunkIndex: number
  blob: Blob
  timestamp: number
}

interface RecordingState {
  sessionId: string
  isRecording: boolean
  isPaused: boolean
  startTime: number
  pausedTime: number
  totalPausedDuration: number
  chunkCount: number
  mode: 'mic' | 'system'
}

let db: IDBDatabase | null = null

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create audio chunks store
      if (!database.objectStoreNames.contains(STORE_CHUNKS)) {
        const chunkStore = database.createObjectStore(STORE_CHUNKS, {
          keyPath: 'id',
        })
        chunkStore.createIndex('sessionId', 'sessionId', { unique: false })
        chunkStore.createIndex('chunkIndex', 'chunkIndex', { unique: false })
      }

      // Create recording state store
      if (!database.objectStoreNames.contains(STORE_RECORDING)) {
        database.createObjectStore(STORE_RECORDING, { keyPath: 'sessionId' })
      }
    }
  })
}

/**
 * Store audio chunk with error handling and fallback
 */
export async function storeChunk(
  chunk: AudioChunkData
): Promise<{ success: boolean; error?: string }> {
  if (!isIndexedDBAvailable()) {
    return {
      success: false,
      error: 'IndexedDB not available - using server storage only',
    }
  }

  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_CHUNKS], 'readwrite')
    const store = transaction.objectStore(STORE_CHUNKS)

    return new Promise((resolve) => {
      const request = store.put(chunk)
      request.onsuccess = () => {
        resolve({ success: true })
      }
      request.onerror = () => {
        console.warn(
          'IndexedDB storage failed, falling back to server-only:',
          request.error
        )
        resolve({
          success: false,
          error: 'IndexedDB storage failed - using server storage only',
        })
      }
    })
  } catch (error) {
    console.warn('IndexedDB error, falling back to server-only:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown IndexedDB error',
    }
  }
}

/**
 * Get all chunks for a session with error handling
 */
export async function getChunks(
  sessionId: string
): Promise<{ chunks: AudioChunkData[]; error?: string }> {
  if (!isIndexedDBAvailable()) {
    return {
      chunks: [],
      error: 'IndexedDB not available',
    }
  }

  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_CHUNKS], 'readonly')
    const store = transaction.objectStore(STORE_CHUNKS)
    const index = store.index('sessionId')

    return new Promise((resolve) => {
      const request = index.getAll(sessionId)
      request.onsuccess = () => {
        const chunks = request.result.sort(
          (a, b) => a.chunkIndex - b.chunkIndex
        )
        resolve({ chunks })
      }
      request.onerror = () => {
        console.warn('Failed to get chunks from IndexedDB:', request.error)
        resolve({
          chunks: [],
          error: 'Failed to retrieve chunks from IndexedDB',
        })
      }
    })
  } catch (error) {
    console.warn('IndexedDB error getting chunks:', error)
    return {
      chunks: [],
      error: error instanceof Error ? error.message : 'Unknown IndexedDB error',
    }
  }
}

/**
 * Delete all chunks for a session with error handling
 */
export async function deleteChunks(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isIndexedDBAvailable()) {
    return { success: false, error: 'IndexedDB not available' }
  }

  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_CHUNKS], 'readwrite')
    const store = transaction.objectStore(STORE_CHUNKS)
    const index = store.index('sessionId')

    return new Promise((resolve) => {
      const request = index.openCursor(IDBKeyRange.only(sessionId))
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve({ success: true })
        }
      }
      request.onerror = () => {
        console.warn('Failed to delete chunks from IndexedDB:', request.error)
        resolve({
          success: false,
          error: 'Failed to delete chunks from IndexedDB',
        })
      }
    })
  } catch (error) {
    console.warn('IndexedDB error deleting chunks:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown IndexedDB error',
    }
  }
}

/**
 * Save recording state with error handling
 */
export async function saveRecordingState(
  state: RecordingState
): Promise<{ success: boolean; error?: string }> {
  if (!isIndexedDBAvailable()) {
    return { success: false, error: 'IndexedDB not available' }
  }

  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_RECORDING], 'readwrite')
    const store = transaction.objectStore(STORE_RECORDING)

    return new Promise((resolve) => {
      const request = store.put(state)
      request.onsuccess = () => resolve({ success: true })
      request.onerror = () => {
        console.warn('Failed to save recording state:', request.error)
        resolve({
          success: false,
          error: 'Failed to save recording state',
        })
      }
    })
  } catch (error) {
    console.warn('IndexedDB error saving recording state:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown IndexedDB error',
    }
  }
}

/**
 * Get recording state with error handling
 */
export async function getRecordingState(
  sessionId: string
): Promise<{ state: RecordingState | null; error?: string }> {
  if (!isIndexedDBAvailable()) {
    return { state: null, error: 'IndexedDB not available' }
  }

  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_RECORDING], 'readonly')
    const store = transaction.objectStore(STORE_RECORDING)

    return new Promise((resolve) => {
      const request = store.get(sessionId)
      request.onsuccess = () => {
        resolve({ state: request.result || null })
      }
      request.onerror = () => {
        console.warn('Failed to get recording state:', request.error)
        resolve({
          state: null,
          error: 'Failed to get recording state',
        })
      }
    })
  } catch (error) {
    console.warn('IndexedDB error getting recording state:', error)
    return {
      state: null,
      error: error instanceof Error ? error.message : 'Unknown IndexedDB error',
    }
  }
}

/**
 * Delete recording state with error handling
 */
export async function deleteRecordingState(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isIndexedDBAvailable()) {
    return { success: false, error: 'IndexedDB not available' }
  }

  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_RECORDING], 'readwrite')
    const store = transaction.objectStore(STORE_RECORDING)

    return new Promise((resolve) => {
      const request = store.delete(sessionId)
      request.onsuccess = () => resolve({ success: true })
      request.onerror = () => {
        console.warn('Failed to delete recording state:', request.error)
        resolve({
          success: false,
          error: 'Failed to delete recording state',
        })
      }
    })
  } catch (error) {
    console.warn('IndexedDB error deleting recording state:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown IndexedDB error',
    }
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
