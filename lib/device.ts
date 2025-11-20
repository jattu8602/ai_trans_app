/**
 * Device ID management utilities
 * Handles generation, storage, and retrieval of device identifiers
 */

const DEVICE_ID_KEY = 'scribeai_device_id'
const SESSIONS_CACHE_KEY = 'scribeai_sessions'
const LAST_SYNC_KEY = 'scribeai_last_sync'

/**
 * Generates a unique device ID (UUID v4)
 */
export function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Gets or creates a device ID from localStorage
 * If no device ID exists, generates a new one and stores it
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    throw new Error('getDeviceId can only be called in browser environment')
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY)

  if (!deviceId) {
    deviceId = generateDeviceId()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }

  return deviceId
}

/**
 * Gets the device ID without creating a new one if it doesn't exist
 * Returns null if no device ID is found
 */
export function getDeviceIdOrNull(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem(DEVICE_ID_KEY)
}

/**
 * Clears the device ID from localStorage
 * Use with caution - this will create a new device ID on next access
 */
export function clearDeviceId(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(DEVICE_ID_KEY)
  localStorage.removeItem(SESSIONS_CACHE_KEY)
  localStorage.removeItem(LAST_SYNC_KEY)
}

/**
 * Gets cached sessions from localStorage
 */
export function getCachedSessions(): any[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const cached = localStorage.getItem(SESSIONS_CACHE_KEY)
    if (!cached) return []
    return JSON.parse(cached)
  } catch (error) {
    console.error('Error reading cached sessions:', error)
    return []
  }
}

/**
 * Caches sessions in localStorage
 * Limits to last 50 sessions to prevent storage overflow
 */
export function cacheSessions(sessions: any[]): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    // Keep only last 50 sessions
    const limited = sessions.slice(0, 50)
    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(limited))
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
  } catch (error) {
    console.error('Error caching sessions:', error)
    // If storage is full, try to clear and retry with fewer items
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      try {
        const reduced = sessions.slice(0, 25)
        localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(reduced))
      } catch (retryError) {
        console.error('Failed to cache even reduced sessions:', retryError)
      }
    }
  }
}

/**
 * Gets the last sync timestamp from localStorage
 */
export function getLastSyncTime(): Date | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const timestamp = localStorage.getItem(LAST_SYNC_KEY)
    if (!timestamp) return null
    return new Date(timestamp)
  } catch (error) {
    console.error('Error reading last sync time:', error)
    return null
  }
}

/**
 * Checks if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

